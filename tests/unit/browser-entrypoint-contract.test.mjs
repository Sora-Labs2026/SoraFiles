import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('site shell lets Playwright choose bundled Chromium unless SORA_BROWSER_PATH is explicit', async () => {
  const source = await readFile(new URL('../e2e/site-shell.mjs', import.meta.url), 'utf8');

  assert.match(source, /browserLaunchOptions/);
  assert.match(source, /chromium\.launch\(browserLaunchOptions\(\)\)/);
  assert.doesNotMatch(source, /Microsoft\\Edge|msedge\.exe/iu);
});

test('tool smoke lets Playwright choose bundled Chromium unless SORA_BROWSER_PATH is explicit', async () => {
  const source = await readFile(new URL('../e2e/tool-flows.mjs', import.meta.url), 'utf8');

  assert.match(source, /SORA_BROWSER_PATH/);
  assert.match(source, /chromium\.launch\(browserLaunchOptions\)/);
  assert.doesNotMatch(source, /Microsoft\\Edge|msedge\.exe/iu);
});
