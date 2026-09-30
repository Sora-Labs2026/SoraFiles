// SoraFiles star ratings: one shared store for the website and the desktop app.
// Aggregates come only from stored ratings (rating_totals is maintained by
// database triggers); clients never send averages or counts.
export const SITE_SUBJECT = 'sorafiles';
export const RATER_ID = /^[A-Za-z0-9_-]{22,64}$/;
export const RATING_LIMITS = Object.freeze([
  { name: 'minute', limit: 8, windowMs: 60_000 },
  { name: 'hour', limit: 40, windowMs: 3_600_000 },
]);

export const isRating = (value) => Number.isInteger(value) && value >= 1 && value <= 5;

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
// Only a domain-separated hash of the anonymous id is stored.
export const raterKey = (raterId) => sha256Hex(`sorafiles-rating-v1:${raterId}`);

export function summarize(subject, row) {
  const count = Number(row?.rating_count ?? 0), sum = Number(row?.rating_sum ?? 0);
  const distribution = [1, 2, 3, 4, 5].map((stars) => Number(row?.[`stars_${stars}`] ?? 0));
  return { subject, count, average: count ? Math.round((sum / count) * 100) / 100 : null, distribution };
}

// Visible summary, shared by the edge renderer and the browser so the page and
// its structured data always show the same numbers.
export function summaryText(templates, aggregate, locale = 'en') {
  if (!aggregate?.count) return templates.none;
  const count = new Intl.NumberFormat(locale).format(aggregate.count);
  const average = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(aggregate.average);
  return (aggregate.count === 1 ? templates.one : templates.many).replace('{average}', average).replace('{count}', count);
}
export const starFill = (aggregate) => (aggregate?.count ? `${Math.round((aggregate.average / 5) * 1000) / 10}%` : '0%');
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const summaryHtml = (templates, aggregate, locale) =>
  `<span class="sf-stars-static" style="--sf-fill:${starFill(aggregate)}" aria-hidden="true">★★★★★</span><span class="sf-rating__text">${escapeHtml(summaryText(templates, aggregate, locale))}</span>`;

export async function readAggregate(db, subject) {
  const row = await db.prepare('SELECT rating_count, rating_sum, stars_1, stars_2, stars_3, stars_4, stars_5 FROM rating_totals WHERE subject = ?1').bind(subject).first();
  return summarize(subject, row);
}

export async function readUserRating(db, subject, rater) {
  const row = await db.prepare('SELECT rating FROM ratings WHERE subject = ?1 AND rater = ?2').bind(subject, rater).first();
  return row ? Number(row.rating) : null;
}

// One active rating per identity and subject: a repeat submission updates it.
export async function saveRating(db, { subject, rater, rating, source, now = new Date() }) {
  if (!isRating(rating) || !['web', 'desktop'].includes(source)) throw new Error('Invalid rating');
  const at = now.toISOString();
  await db.prepare(`
    INSERT INTO ratings (subject, rater, rating, source, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)
    ON CONFLICT (subject, rater) DO UPDATE SET rating = excluded.rating, source = excluded.source, updated_at = excluded.updated_at
    WHERE ratings.rating <> excluded.rating
  `).bind(subject, rater, rating, source, at).run();
}

// Fixed-window counter in one atomic upsert. Returns false once over the limit.
export async function withinLimit(db, key, { limit, windowMs }, now = Date.now()) {
  const row = await db.prepare(`
    INSERT INTO rating_limits (key, hits, window_end) VALUES (?1, 1, ?2)
    ON CONFLICT (key) DO UPDATE SET
      hits = CASE WHEN rating_limits.window_end <= ?3 THEN 1 ELSE rating_limits.hits + 1 END,
      window_end = CASE WHEN rating_limits.window_end <= ?3 THEN ?2 ELSE rating_limits.window_end END
    RETURNING hits
  `).bind(key, now + windowMs, now).first();
  return Number(row?.hits ?? Infinity) <= limit;
}

export const pruneRatingLimits = (db, now = Date.now()) => db.prepare('DELETE FROM rating_limits WHERE window_end <= ?1').bind(now).run();

// Adds a real aggregate to the application node of a JSON-LD document. With
// no ratings the node is left untouched: Google requires a real rating count.
export function withAggregateRating(schema, aggregate) {
  if (!aggregate?.count) return schema;
  const rating = {
    '@type': 'AggregateRating',
    ratingValue: aggregate.average.toFixed(2),
    ratingCount: String(aggregate.count),
    bestRating: '5',
    worstRating: '1',
  };
  const nodes = Array.isArray(schema?.['@graph']) ? schema['@graph'] : [schema];
  for (const node of nodes) {
    const types = [].concat(node?.['@type'] ?? []);
    if (types.includes('WebApplication') || types.includes('SoftwareApplication')) node.aggregateRating = rating;
  }
  return schema;
}
