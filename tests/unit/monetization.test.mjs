import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('ads.txt declares the verified direct seller', async () => {
  const value = await readFile('public/ads.txt', 'utf8');
  assert.equal(value.trim(), 'google.com, pub-1154591227955054, DIRECT, f08c47fec0942fa0');
});

test('the default test build does not contain live AdSense', async () => {
  const html = await readFile('dist/index.html', 'utf8');
  assert.doesNotMatch(html, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle/);
});
