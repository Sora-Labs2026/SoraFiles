import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('information pages render one visual ordinal without duplicating source numbers', async () => {
  const source = await readFile('src/components/LiveInfoPage.astro', 'utf8');
  // Headings lose any source number; the page renders its own zero-padded ordinal.
  assert.ok(source.includes("h.replace(/^\\d+\\.\\s*/,'')"));
  assert.match(source, /n:String\(index\+1\)\.padStart\(2,'0'\)/);
});

test('share actions keep native links active and Copy link copies only the canonical URL', async () => {
  const source = await readFile('src/components/ShareMenu.astro', 'utf8');
  assert.match(source, /link\.href = targets\[target\]/);
  assert.doesNotMatch(source, /link\.addEventListener\('click', closeMenu\)/);
  assert.match(source, /copyText\(canonical\)/);
  assert.match(source, /Reflect\.get\(document, 'execCommand'\)/);
});
