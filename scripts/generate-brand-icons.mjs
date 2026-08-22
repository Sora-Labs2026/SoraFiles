import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const sourceUrl = new URL('../favicon.png', import.meta.url);
const source = await readFile(sourceUrl);
const sourceMetadata = await sharp(source).metadata();

if (sourceMetadata.format !== 'png' || !sourceMetadata.width || !sourceMetadata.height) {
  throw new Error('The authoritative project-root favicon.png must be a valid PNG image.');
}

const { data: sourcePixels, info: sourceInfo } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const alphaAt = (x, y) => sourcePixels[((y * sourceInfo.width) + x) * sourceInfo.channels + 3];
const transparentPixels = sourcePixels.filter((_, index) => index % sourceInfo.channels === 3 && sourcePixels[index] === 0).length;
const opaquePixels = sourcePixels.filter((_, index) => index % sourceInfo.channels === 3 && sourcePixels[index] === 255).length;
const transparentSamples = [
  [0, 0],
  [sourceInfo.width - 1, 0],
  [0, sourceInfo.height - 1],
  [sourceInfo.width - 1, sourceInfo.height - 1],
  [Math.floor(sourceInfo.width / 2), Math.floor(sourceInfo.height * 0.3)],
  [Math.floor(sourceInfo.width / 2), Math.floor(sourceInfo.height * 0.65)],
];

if (
  !sourceMetadata.hasAlpha
  || transparentPixels < sourceInfo.width * sourceInfo.height * 0.25
  || opaquePixels < sourceInfo.width * sourceInfo.height * 0.25
  || transparentSamples.some(([x, y]) => alphaAt(x, y) > 8)
) {
  throw new Error('favicon.png must preserve the transparent exterior and internal negative space around the gradient S.');
}

const renderPng = (size) => sharp(source)
  .resize(size, size, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    kernel: sharp.kernel.lanczos3,
  })
  .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false, effort: 10 })
  .toBuffer();

const sizes = [16, 32, 48, 96, 180, 192, 512];
const rendered = new Map(await Promise.all(sizes.map(async (size) => [size, await renderPng(size)])));

const ogIcon = await sharp(rendered.get(512))
  .resize(420, 420, { fit: 'contain', kernel: sharp.kernel.lanczos3 })
  .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false, effort: 10 })
  .toBuffer();
const ogOverlay = Buffer.from(`
  <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#111318"/>
    <rect x="64" y="64" width="4" height="502" fill="#22d3ee"/>
    <text x="96" y="218" fill="#f8fafc" font-family="Arial, sans-serif" font-size="76" font-weight="700">SoraFiles</text>
    <text x="96" y="286" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="34">Private PDF &amp; image tools</text>
    <text x="96" y="352" fill="#94a3b8" font-family="Arial, sans-serif" font-size="24">Process files locally in your browser.</text>
    <text x="96" y="524" fill="#64748b" font-family="Arial, sans-serif" font-size="22">Sora Labs</text>
  </svg>
`);
const ogImage = await sharp({
  create: { width: 1200, height: 630, channels: 4, background: { r: 17, g: 19, b: 24, alpha: 1 } },
})
  .composite([{ input: ogOverlay }, { input: ogIcon, left: 700, top: 105 }])
  .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false, effort: 10 })
  .toBuffer();

const icoSizes = [16, 32, 48];
const icoHeader = Buffer.alloc(6 + (16 * icoSizes.length));
icoHeader.writeUInt16LE(0, 0);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(icoSizes.length, 4);

let icoOffset = icoHeader.length;
icoSizes.forEach((size, index) => {
  const image = rendered.get(size);
  const entryOffset = 6 + (16 * index);
  icoHeader.writeUInt8(size, entryOffset);
  icoHeader.writeUInt8(size, entryOffset + 1);
  icoHeader.writeUInt8(0, entryOffset + 2);
  icoHeader.writeUInt8(0, entryOffset + 3);
  icoHeader.writeUInt16LE(1, entryOffset + 4);
  icoHeader.writeUInt16LE(32, entryOffset + 6);
  icoHeader.writeUInt32LE(image.length, entryOffset + 8);
  icoHeader.writeUInt32LE(icoOffset, entryOffset + 12);
  icoOffset += image.length;
});

const outputs = [
  ['../public/favicon.png', rendered.get(512)],
  ['../public/favicon-16x16.png', rendered.get(16)],
  ['../public/favicon-32x32.png', rendered.get(32)],
  ['../public/favicon-48x48.png', rendered.get(48)],
  ['../public/favicon-96x96.png', rendered.get(96)],
  ['../public/apple-touch-icon.png', rendered.get(180)],
  ['../public/icon-192.png', rendered.get(192)],
  ['../public/icon-512.png', rendered.get(512)],
  ['../public/reddit-avatar.png', rendered.get(512)],
  ['../public/og-image.png', ogImage],
  ['../public/favicon.ico', Buffer.concat([icoHeader, ...icoSizes.map((size) => rendered.get(size))])],
];

await Promise.all(outputs.map(([path, data]) => writeFile(new URL(path, import.meta.url), data)));

console.log(`Generated transparent official SoraFiles favicon assets from favicon.png (${sourceMetadata.width}x${sourceMetadata.height}).`);
