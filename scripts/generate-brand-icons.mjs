import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

// Locked owner-approved V10 handoff. Raster bytes are exact; SVG line endings
// are normalized so Windows and Unix checkouts enforce the same artwork.
export const approvedBrandDigests = Object.freeze({
  'sorafiles-app-icon-1024.png':'45eacdab646fc292a1b5e6a511dc38554f7a69d340a9a0344d9e586aaaa5d610',
  'sorafiles-app-icon-512.png':'bf5edab3ac6e93fa2b8a5443d5f89c3e2bbd84496d4ed3bb73c4d574085b7d69',
  'sorafiles-app-icon.svg':'9ce498527d97a04aaf0a0bd156c323cc285d2bac7cdb2ab0e6ef891fb4bad69a',
  'sorafiles-logo-black.svg':'b773b1d368752c657d2f121ea868cc7f2252151ff5a13223c29de5954884bb5f',
  'sorafiles-logo-full-color-dark.svg':'38cdaed45ce199e7e728eefb73a5a639f695786d67dd6b3fefc99ccc5f1dddcf',
  'sorafiles-logo-full-color.svg':'494c6215d2e2fe397d63da226a3852820c990cbd3900f3e9f2f32c8a09ca9629',
  'sorafiles-logo-one-color.svg':'4f03a71401ec212ec1d40d238fb319e4df18be7b3e4516aee4a5f272aa3b45d3',
  'sorafiles-logo-white.svg':'3dc5d8b961d2eea341d7f6bef2600f907170c54c122a8afe22d44a052eee41ff',
  'sorafiles-mark-black.svg':'35c69be0d466102173a0d688e50090760cb0ae7befa50971f0c5c4ffc2ea7b7d',
  'sorafiles-mark-full-color.svg':'03dc7c25bb88689fcf020a17d278e2e77da34116a0efc12e494ea899073fe7b2',
  'sorafiles-mark-one-color.svg':'81a94828cc46b90e476abafdf82fdac7cf6fab302780e895c1e52153759b3311',
  'sorafiles-mark-white.svg':'aa072ed5dbe8f0936b292082514f9865d63f619e40682d05eb2f70486ca9fc3a',
});
export const approvedOgDigest = 'bb9f60b5a6b2ed16cb0733a10bd5ee09153c649422a16235e5e99b337722f508';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export async function readApprovedBrand() {
  const assets = new Map();
  for (const [name, digest] of Object.entries(approvedBrandDigests)) {
    const bytes = await readFile(new URL('../public/brand/'+name, import.meta.url));
    const canonical = name.endsWith('.svg') ? Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n').trim()) : bytes;
    if (hash(canonical) !== digest) throw new Error('public/brand/'+name+' differs from the locked V10 handoff. Restore the approved asset before generating derivatives.');
    assets.set(name, bytes);
  }
  // The approved OG composition is supplied artwork, not a new generated design.
  const og = await readFile(new URL('../public/og-image.png', import.meta.url));
  if (hash(og) !== approvedOgDigest) throw new Error('public/og-image.png differs from the approved V10 composition. Restore it from the locked handoff.');
  return { source:assets.get('sorafiles-app-icon-512.png'), og };
}

export const renderBrandPng = (source, size) => sharp(source)
  .resize(size, size, {fit:'contain',background:{r:0,g:0,b:0,alpha:0},kernel:sharp.kernel.lanczos3})
  .png({compressionLevel:9,adaptiveFiltering:true,palette:false,effort:10})
  .toBuffer();

async function generateBrandIcons() {
  const { source } = await readApprovedBrand();
  const sizes = [16,32,48,96,180,192,512];
  const rendered = new Map(await Promise.all(sizes.map(async size => [size,await renderBrandPng(source,size)])));
  const icoSizes = [16,32,48], header = Buffer.alloc(6+16*icoSizes.length);
  header.writeUInt16LE(1,2);header.writeUInt16LE(icoSizes.length,4);
  let offset = header.length;
  icoSizes.forEach((size,index) => {
    const frame=rendered.get(size),entry=6+16*index;
    header.writeUInt8(size,entry);header.writeUInt8(size,entry+1);
    header.writeUInt16LE(1,entry+4);header.writeUInt16LE(32,entry+6);
    header.writeUInt32LE(frame.length,entry+8);header.writeUInt32LE(offset,entry+12);offset+=frame.length;
  });
  const outputs = [
    ['../favicon.png',source],
    ['../public/favicon.png',rendered.get(512)],
    ['../public/favicon-16x16.png',rendered.get(16)],
    ['../public/favicon-32x32.png',rendered.get(32)],
    ['../public/favicon-48x48.png',rendered.get(48)],
    ['../public/favicon-96x96.png',rendered.get(96)],
    ['../public/apple-touch-icon.png',rendered.get(180)],
    ['../public/icon-192.png',rendered.get(192)],
    ['../public/icon-512.png',rendered.get(512)],
    ['../public/reddit-avatar.png',rendered.get(512)],
    ['../public/favicon.ico',Buffer.concat([header,...icoSizes.map(size=>rendered.get(size))])],
  ];
  await Promise.all(outputs.map(([path,data])=>writeFile(new URL(path,import.meta.url),data)));
  console.log('Generated deterministic SoraFiles icons from the approved amber/white mark on its black tile; preserved the approved V10 Open Graph image.');
}

// Importing the validators/render helper never writes assets.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await generateBrandIcons();
