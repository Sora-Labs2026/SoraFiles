import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const source = new URL('../public/favicon.svg', import.meta.url);
const png512 = new URL('../public/icon-512.png', import.meta.url);
const ico = new URL('../public/favicon.ico', import.meta.url);

const svg = await readFile(source);
const icon512 = await sharp(svg).resize(512, 512).png().toBuffer();
const icon48 = await sharp(svg).resize(48, 48).png().toBuffer();

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

await Promise.all([
  writeFile(png512, icon512),
  writeFile(ico, Buffer.concat([header, icon48])),
]);

console.log('Generated Sora Files favicon.ico and icon-512.png from favicon.svg.');
