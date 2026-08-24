import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import worker from '../../worker.js';
import { BOOTSTRAP_POPULAR_TOOL_IDS, PUBLISHED_TOOL_IDS } from '../../src/data/popularityRegistry.generated.js';
import { computePopularityRanking } from '../../src/lib/popularity/core.js';

test('cold start returns exactly ten deterministic bootstrap tools', () => {
  const ranking = computePopularityRanking({
    toolIds: PUBLISHED_TOOL_IDS,
    bootstrapIds: BOOTSTRAP_POPULAR_TOOL_IDS,
    usage: [{ id: 'rotate-pdf', success7: 5, success30: 5, success90: 5 }],
    now: new Date('2026-08-23T00:00:00Z'),
  });
  assert.equal(ranking.mode, 'bootstrap');
  assert.deepEqual(ranking.tools, BOOTSTRAP_POPULAR_TOOL_IDS);
  assert.equal(new Set(ranking.tools).size, 10);
});

test('real successes drive a deterministic dynamic top ten without external providers', () => {
  const usage = PUBLISHED_TOOL_IDS.map((id, index) => ({
    id,
    success7: (index + 1) * 7,
    success30: (index + 1) * 11,
    success90: (index + 1) * 13,
  }));
  const input = { toolIds: PUBLISHED_TOOL_IDS, bootstrapIds: BOOTSTRAP_POPULAR_TOOL_IDS, usage, now: new Date('2026-08-23T00:00:00Z') };
  const first = computePopularityRanking(input);
  const second = computePopularityRanking(input);
  assert.equal(first.mode, 'dynamic');
  assert.equal(first.tools.length, 10);
  assert.equal(new Set(first.tools).size, 10);
  assert.deepEqual(first.tools, second.tools);
  assert.equal(first.providers.searchConsole, 'unconfigured');
  assert.equal(first.providers.marketDemand, 'unconfigured');
  assert.equal(first.tools[0], PUBLISHED_TOOL_IDS.at(-1));
});

test('pin and exclude controls remain bounded to published tools', () => {
  const usage = PUBLISHED_TOOL_IDS.map((id, index) => ({ id, success7: index + 5, success30: index + 10, success90: index + 20 }));
  const ranking = computePopularityRanking({
    toolIds: PUBLISHED_TOOL_IDS,
    bootstrapIds: BOOTSTRAP_POPULAR_TOOL_IDS,
    usage,
    pin: 'merge-pdf,unknown-tool',
    exclude: 'pdf-ocr,unknown-tool',
    now: new Date('2026-08-23T00:00:00Z'),
  });
  assert.equal(ranking.tools[0], 'merge-pdf');
  assert.ok(!ranking.tools.includes('pdf-ocr'));
  assert.equal(ranking.tools.length, 10);
});

test('event endpoint accepts only canonical, allowlisted successful processing', async () => {
  const writes = [];
  const db = {
    prepare(sql) {
      return { bind(...values) { return { run() { writes.push({ sql, values }); return Promise.resolve(); } }; } };
    },
  };
  const request = new Request('https://sorafiles.com/__sf/popularity/event', {
    method: 'POST',
    headers: { Origin: 'https://sorafiles.com', 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ tool: 'compress-pdf', event: 'tool_process_success' }),
  });
  const pending = [];
  const response = await worker.fetch(request, { POPULARITY_DB: db }, { waitUntil: (promise) => pending.push(promise) });
  await Promise.all(pending);
  assert.equal(response.status, 204);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].values.slice(1), ['compress-pdf']);

  const rejected = await worker.fetch(new Request('https://sorafiles.com/__sf/popularity/event', {
    method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool: 'compress-pdf', event: 'tool_process_success' }),
  }), { POPULARITY_DB: db }, {});
  assert.equal(rejected.status, 403);
  assert.equal(writes.length, 1);
});

test('shared success hook contains no file or persistent-user telemetry fields', async () => {
  const source = await readFile('src/components/ToolProcessMotion.astro', 'utf8');
  assert.match(source, /tool_process_success/);
  assert.match(source, /location\.origin !== 'https:\/\/sorafiles\.com'/);
  assert.doesNotMatch(source, /fileName|fileSize|fileHash|userId|visitorId|localStorage/);
});
