import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

test('search automation validates the complete canonical sitemap without network calls', async () => {
  const result = spawnSync(process.execPath, ['scripts/ping-search-engines.js', '--dry-run'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const receipt = JSON.parse(await readFile('.artifacts/search-submission-receipt.json', 'utf8'));
  assert.equal(receipt.canonicalUrlCount, 570);
  assert.equal(receipt.mode, 'dry-run');
  assert.deepEqual(receipt.operations.map(({ provider }) => provider), ['indexnow', 'google-search-console', 'bing-webmaster']);
  assert.equal(JSON.stringify(receipt).includes('TOKEN'), false);
});

test('search automation never calls retired or ineligible Google indexing endpoints', async () => {
  const source = await readFile('scripts/ping-search-engines.js', 'utf8');
  assert.doesNotMatch(source, /google\.com\/ping|bing\.com\/ping|urlNotifications:publish|indexing\.googleapis\.com/);
  assert.match(source, /fc1b21d84d0549ba9d2ab3bea5dc3845/);
  assert.doesNotMatch(source, /88f40a4acee734c99422ce589b85759a47d149d06bbf5bf7fa369787ef4e4e41/);
  assert.match(source, /GOOGLE_APPLICATION_CREDENTIALS/);
  assert.match(source, /webmasters\/v3\/sites/);
  assert.match(source, /https:\/\/www\.bing\.com\/indexnow/);
});
