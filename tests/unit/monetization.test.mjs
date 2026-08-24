import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const adRuntime = /acscdn\.com\/script|runAutoTag|zoneId:\s*['"]ag86oktn3r|highperformanceformat|effectivecpmnetwork/i;

test('advertising components and routes are absent', async () => {
  await assert.rejects(access('src/components/AdcashAutoTag.astro', constants.F_OK));
  await assert.rejects(access('src/components/AdsterraSlot.astro', constants.F_OK));
  await assert.rejects(access('src/pages/ad-frame/[unit].astro', constants.F_OK));
  assert.doesNotMatch(await readFile('wrangler.jsonc', 'utf8'), /ads\.sorafiles\.com/i);
});

test('every public document is advertising-free', async () => {
  for (const path of ['dist/index.html','dist/tools/index.html','dist/pdf/index.html','dist/ja/tools/index.html','dist/privacy/index.html','dist/terms/index.html','dist/contact/index.html','dist/open-source/index.html','dist/404.html']) {
    const html = await readFile(path, 'utf8');
    assert.doesNotMatch(html, adRuntime, path);
    assert.doesNotMatch(html, /data-ad-placement|data-sf-ad-slot|data-ad-frame/i, path);
  }
});
