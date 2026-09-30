import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { handleRatings } from '../../worker.js';
import { summaryText, withAggregateRating } from '../../src/lib/ratings/core.js';

// A D1-compatible adapter over the real migration SQL, so triggers and
// constraints are exercised exactly as they run in production.
async function database() {
  const db = new DatabaseSync(':memory:');
  for (const file of ['migrations/0001_popularity.sql', 'migrations/0002_ratings.sql']) db.exec(await readFile(file, 'utf8'));
  // D1 binds ?NNN by number, even when one is repeated. Older node:sqlite
  // binds positionally, so expand each ?N into a plain ? with its own value.
  const prepare = (sql) => {
    const order = [...sql.matchAll(/\?(\d+)/g)].map((match) => Number(match[1]) - 1);
    const statement = db.prepare(sql.replace(/\?\d+/g, '?'));
    return { bind: (...values) => { const args = order.length ? order.map((index) => values[index]) : values; return {
      first: async () => statement.get(...args) ?? null,
      run: async () => statement.run(...args),
      all: async () => ({ results: statement.all(...args) }),
    }; } };
  };
  return { raw: db, env: { POPULARITY_DB: { prepare } } };
}
const rater = (n) => `rater-${String(n).padStart(2, '0')}-abcdefghijklmnopqrstuv`;
let ip = 0;
function request(subject, body, { client = 'web', address } = {}) {
  const headers = { 'Content-Type': 'application/json', 'CF-Connecting-IP': address ?? `198.51.100.${++ip % 250}` };
  if (client === 'web') Object.assign(headers, { Origin: 'https://sorafiles.com', 'Sec-Fetch-Site': 'same-origin' });
  if (client === 'desktop') headers['X-SoraFiles-Client'] = 'desktop';
  if (client === 'evil') headers.Origin = 'https://evil.example';
  return new Request(`https://sorafiles.com/__sf/ratings/${subject}`, { method: 'POST', headers, body: JSON.stringify(body) });
}
const send = async (env, subject, body, options) => { const response = await handleRatings(request(subject, body, options), env, subject); return { status: response.status, body: response.status === 200 ? await response.json() : null }; };

test('first rating, change and duplicate keep one vote per identity with exact aggregates', async () => {
  const { env, raw } = await database();
  let result = await send(env, 'compress-pdf', { rater: rater(1), rating: 5 });
  assert.equal(result.status, 200);
  assert.deepEqual([result.body.count, result.body.average, result.body.userRating], [1, 5, 5]);
  result = await send(env, 'compress-pdf', { rater: rater(1), rating: 4 });
  assert.deepEqual([result.body.count, result.body.average, result.body.userRating], [1, 4, 4], 'changing a rating updates it');
  result = await send(env, 'compress-pdf', { rater: rater(1), rating: 4 });
  assert.equal(result.body.count, 1, 'a repeated submission is not a new vote');
  await send(env, 'compress-pdf', { rater: rater(2), rating: 5 });
  result = await send(env, 'compress-pdf', { rater: rater(3), rating: 5 });
  assert.deepEqual([result.body.count, result.body.average], [3, 4.67]);
  assert.deepEqual(result.body.distribution, [0, 0, 0, 1, 2]);
  const totals = raw.prepare('SELECT COUNT(*) AS n, SUM(rating) AS s FROM ratings WHERE subject = ?').get('compress-pdf');
  assert.deepEqual([totals.n, totals.s], [3, 14], 'trigger-maintained totals match the stored ratings');
  assert.equal(JSON.stringify(raw.prepare('SELECT rater FROM ratings').all()).includes('rater-01'), false, 'only hashed identities are stored');
});

test('web and desktop ratings for the same tool share one aggregate', async () => {
  const { env, raw } = await database();
  await send(env, 'compress-pdf', { rater: rater(1), rating: 5 }, { client: 'web' });
  const desktop = await send(env, 'compress-pdf', { rater: rater(2), rating: 4 }, { client: 'desktop' });
  assert.deepEqual([desktop.body.count, desktop.body.average], [2, 4.5]);
  const web = await handleRatings(new Request('https://sorafiles.com/__sf/ratings/compress-pdf'), env, 'compress-pdf');
  const aggregate = await web.json();
  assert.deepEqual([aggregate.count, aggregate.average], [2, 4.5]);
  assert.deepEqual(raw.prepare('SELECT source FROM ratings ORDER BY source').all().map((row) => row.source), ['desktop', 'web']);
  const other = await send(env, 'merge-pdf', { rater: rater(1), rating: 2 });
  assert.equal(other.body.count, 1, 'each tool has its own aggregate');
});

test('invalid ratings, identities, subjects and origins are refused server-side', async () => {
  const { env } = await database();
  for (const rating of [0, 6, 2.5, '5', null, -1]) assert.equal((await send(env, 'compress-pdf', { rater: rater(1), rating })).status, 400, `rating ${rating}`);
  for (const bad of ['short', 'has spaces in the identifier 123456', 'x'.repeat(65)]) assert.equal((await send(env, 'compress-pdf', { rater: bad, rating: 5 })).status, 400);
  assert.equal((await send(env, 'compress-pdf', { rater: rater(1), rating: 5, average: 5 })).status, 400, 'no extra fields such as averages');
  assert.equal((await send(env, 'not-a-tool', { rater: rater(1), rating: 5 })).status, 404);
  assert.equal((await send(env, 'compress-pdf', { rater: rater(1), rating: 5 }, { client: 'evil' })).status, 403);
  assert.equal((await send(env, 'compress-pdf', { rater: rater(1), rating: 5 }, { client: 'none' })).status, 403, 'non-browser clients must identify as the desktop app');
  const stored = await send(env, 'compress-pdf', { rater: rater(1) });
  assert.equal(stored.body.count, 0, 'nothing was stored');
});

test('lookups return the current rating without voting', async () => {
  const { env } = await database();
  assert.equal((await send(env, 'sorafiles', { rater: rater(9) })).body.userRating, null);
  await send(env, 'sorafiles', { rater: rater(9), rating: 3 });
  const lookup = await send(env, 'sorafiles', { rater: rater(9) });
  assert.deepEqual([lookup.body.userRating, lookup.body.count], [3, 1]);
});

test('rapid automated submissions from one address are rate limited', async () => {
  const { env } = await database();
  const statuses = [];
  for (let n = 0; n < 10; n++) statuses.push((await send(env, 'split-pdf', { rater: rater(n + 10), rating: 5 }, { address: '203.0.113.7' })).status);
  assert.deepEqual(statuses.slice(0, 8), Array(8).fill(200));
  assert.deepEqual(statuses.slice(8), [429, 429]);
  assert.equal((await send(env, 'split-pdf', { rater: rater(40), rating: 5 }, { address: '203.0.113.8' })).status, 200, 'other addresses are unaffected');
  const bot = request('split-pdf', { rater: rater(41), rating: 5 });
  bot.headers.set('User-Agent', 'Mozilla/5.0 (compatible; HeadlessChrome)');
  assert.equal((await handleRatings(bot, env, 'split-pdf')).status, 403);
});

test('structured data gets aggregateRating only from real ratings', () => {
  const page = () => ({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage' }, { '@type': 'WebApplication', name: 'Compress PDF - SoraFiles', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } }] });
  const empty = withAggregateRating(page(), { count: 0, average: null });
  assert.equal(JSON.stringify(empty).includes('aggregateRating'), false, 'zero ratings: no AggregateRating');
  const rated = withAggregateRating(page(), { count: 1284, average: 4.82 });
  assert.deepEqual(rated['@graph'][1].aggregateRating, { '@type': 'AggregateRating', ratingValue: '4.82', ratingCount: '1284', bestRating: '5', worstRating: '1' });
  assert.equal(rated['@graph'][0].aggregateRating, undefined, 'only the application carries the rating');
  const templates = { one: '{average} out of 5 · {count} rating', many: '{average} out of 5 · {count} ratings', none: 'No ratings yet' };
  assert.equal(summaryText(templates, { count: 1284, average: 4.82 }, 'en'), '4.8 out of 5 · 1,284 ratings', 'visible text shows the same aggregate');
  assert.equal(summaryText(templates, { count: 0, average: null }, 'en'), 'No ratings yet');
});
