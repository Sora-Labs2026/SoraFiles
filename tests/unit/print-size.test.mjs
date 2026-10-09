import assert from 'node:assert/strict';
import test from 'node:test';
import { toPixels, fromPixels, limitToBytes, jpegWithDpi, pngWithDpi, encodeWithinBytes } from '../../src/lib/image/print-size.ts';

test('physical sizes convert at the print resolution', () => {
  assert.equal(toPixels(35, 'mm', 300), 413); // passport photo width
  assert.equal(toPixels(45, 'mm', 300), 531);
  assert.equal(toPixels(2, 'in', 300), 600);
  assert.equal(toPixels(3.5, 'cm', 300), 413);
  assert.equal(toPixels(800, 'px', 300), 800);
  assert.equal(fromPixels(413, 'mm', 300), 34.97);
  assert.equal(fromPixels(600, 'in', 300), 2);
});

test('size limits use the stricter decimal kilobyte', () => {
  assert.equal(limitToBytes(50, 'KB'), 50_000);
  assert.equal(limitToBytes(2, 'MB'), 2_000_000);
  assert.equal(limitToBytes(0, 'KB'), null);
  assert.equal(limitToBytes(Number.NaN, 'MB'), null);
});

test('JPEG density is written into an existing JFIF segment or a new one', () => {
  const jfif = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
  const out = jpegWithDpi(jfif, 300);
  assert.deepEqual([...out.subarray(13, 18)], [1, 1, 44, 1, 44]);
  const bare = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 2, 0xff, 0xd9]);
  const inserted = jpegWithDpi(bare, 300);
  assert.equal(inserted.length, bare.length + 18);
  assert.equal(String.fromCharCode(...inserted.subarray(6, 10)), 'JFIF');
});

test('PNG gets one pHYs chunk before image data with a valid CRC', () => {
  const chunk = (type, data = []) => { const body = [...type].map((c) => c.charCodeAt(0)).concat(data); const len = [0, 0, 0, data.length]; return [...len, ...body, 0, 0, 0, 0]; };
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', Array(13).fill(0)), ...chunk('IDAT', [1, 2]), ...chunk('IEND')]);
  const once = pngWithDpi(png, 300), twice = pngWithDpi(once, 300);
  const text = String.fromCharCode(...once);
  assert.ok(text.indexOf('pHYs') > 0 && text.indexOf('pHYs') < text.indexOf('IDAT'));
  assert.equal(twice.length, once.length, 'replaces instead of duplicating');
  const view = new DataView(once.buffer); const at = text.indexOf('pHYs') - 4;
  assert.equal(view.getUint32(at + 8), 11811); // 300 dpi in pixels per metre
});

test('size limits pick the highest fitting quality and report unreachable limits', async () => {
  const encode = async (q) => new Blob([new Uint8Array(Math.round(1000 + q * 9000))]);
  const fit = await encodeWithinBytes(encode, 5000);
  assert.ok(fit.fits && fit.blob.size <= 5000 && fit.blob.size > 4500);
  const miss = await encodeWithinBytes(encode, 500);
  assert.equal(miss.fits, false);
});

test('fitting a file lowers quality first, then pixels, and keeps the aspect ratio', async () => {
  const { fitImageToBytes } = await import('../../src/lib/image/print-size.ts');
  // Fake encoder: bytes grow with pixels and quality.
  const encodeAt = async (w, h, q) => new Blob([new Uint8Array(Math.round(w * h * (0.05 + q * 0.5)))]);
  const easy = await fitImageToBytes({ width: 1000, height: 500 }, encodeAt, 200_000);
  assert.ok(easy.fits && !easy.scaled && easy.width === 1000);
  const hard = await fitImageToBytes({ width: 4000, height: 3000 }, encodeAt, 50_000);
  assert.ok(hard.fits && hard.scaled && hard.blob.size <= 50_000);
  assert.ok(Math.abs(hard.width / hard.height - 4 / 3) < 0.01);
  const png = await fitImageToBytes({ width: 2000, height: 2000 }, encodeAt, 100_000, { lossy: false });
  assert.ok(png.fits && png.scaled && png.quality === 1);
  const impossible = await fitImageToBytes({ width: 100, height: 100 }, encodeAt, 10);
  assert.equal(impossible.fits, false);
  // Flat artwork: bytes fall steeply with pixels, so a scale step overshoots; the result should
  // still be close to the largest size that fits (here w*h <= 1,000,000 → 1333 × 750).
  const steep = async (w, h) => new Blob([new Uint8Array(Math.round(1500 + (w * h) ** 1.6 / 2e6))]);
  const flat = await fitImageToBytes({ width: 3200, height: 1800 }, steep, Math.round(1500 + 1e6 ** 1.6 / 2e6), { lossy: false });
  assert.ok(flat.fits && flat.width <= 1334 && flat.width >= 1200, `width ${flat.width}`);
});
