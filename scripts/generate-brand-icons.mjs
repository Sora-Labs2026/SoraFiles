import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const source = new URL('../favicon.png', import.meta.url);
const svg = new URL('../public/favicon.svg', import.meta.url);
const png512 = new URL('../public/icon-512.png', import.meta.url);
const ico = new URL('../public/favicon.ico', import.meta.url);

const original = await readFile(source);
const icon512 = await sharp(original)
  .resize(512, 512, { fit: 'cover' })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();
const icon48 = await sharp(original)
  .resize(48, 48, { fit: 'cover' })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();
const svgRaster = await sharp(original)
  .resize(192, 192, { fit: 'cover' })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();
const svgIcon = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="Sora Files">',
  `  <image width="512" height="512" href="data:image/png;base64,${svgRaster.toString('base64')}" />`,
  '</svg>',
  '',
].join('\n');

const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(48, 6);
header.writeUInt8(48, 7);
header.writeUInt8(0, 8);
header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(icon48.length, 14);
header.writeUInt32LE(header.length, 18);

const icoIcon = Buffer.concat([header, icon48]);
const outputs = [
  [svg, Buffer.from(svgIcon)],
  [png512, icon512],
  [ico, icoIcon],
];

if (process.argv.includes('--check')) {
  const checks = await Promise.all(
    outputs.map(async ([path, expected]) => expected.equals(await readFile(path))),
  );

  if (checks.some((matches) => !matches)) {
    throw new Error('Public brand icons are out of date. Run `npm run assets:brand`.');
  }

  console.log('Verified public brand icons match favicon.png.');
} else {
  await Promise.all(outputs.map(([path, contents]) => writeFile(path, contents)));
  console.log('Generated Sora Files favicon.svg, favicon.ico, and icon-512.png from favicon.png.');
}
