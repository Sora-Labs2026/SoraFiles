import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('information pages render one visual ordinal without duplicating source numbers', async () => {
  const source = await readFile('src/components/LiveInfoPage.astro', 'utf8');
  assert.ok(source.includes("section.h.replace(/^\\d+\\.\\s*/, '')"));
});

test('share actions keep native links active and Copy link copies only the canonical URL', async () => {
  const source = await readFile('src/components/ShareMenu.astro', 'utf8');
  assert.match(source, /link\.href = targets\[target\]/);
  assert.doesNotMatch(source, /link\.addEventListener\('click', closeMenu\)/);
  assert.match(source, /copyText\(canonical\)/);
  assert.match(source, /Reflect\.get\(document, 'execCommand'\)/);
});
