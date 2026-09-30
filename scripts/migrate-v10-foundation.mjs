// One-time, reviewable migration from the owner-supplied locked visual handoff.
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import sharp from 'sharp';
const prototype='.artifacts/v10-handoff/sorafiles-tools-desktop-subpages-prototype-launchit-inspired-v2';
const tokens=(await readFile(prototype+'/src/styles/tokens.css','utf8')).replace('[data-theme="dark"] {',':root.dark, [data-theme="dark"] {').replace('[data-theme="dark"] .on-dark {',':root.dark .on-dark, [data-theme="dark"] .on-dark {');
await writeFile('src/styles/v10-tokens.css',tokens+'\n:root { --ink-secondary:var(--ink-2); --ink-muted:var(--ink-3); }\n');
await copyFile(prototype+'/src/styles/atmosphere.css','src/styles/v10-atmosphere.css');
await copyFile(prototype+'/src/components/home/product-window.css','src/styles/v10-product-window.css');
await mkdir('public/brand',{recursive:true});
const {readdir}=await import('node:fs/promises');
for(const name of await readdir(prototype+'/public/brand'))await copyFile(prototype+'/public/brand/'+name,'public/brand/'+name);
await copyFile(prototype+'/public/og-image.png','public/og-image.png');
await copyFile(prototype+'/public/brand/sorafiles-app-icon-512.png','favicon.png');
const source=await readFile('favicon.png');
const frames=new Map();
for(const [name,size] of [['favicon-16x16.png',16],['favicon-32x32.png',32],['favicon-48x48.png',48],['favicon-96x96.png',96],['apple-touch-icon.png',180],['icon-192.png',192],['favicon.png',512],['icon-512.png',512],['reddit-avatar.png',512]]){
 const png=await sharp(source).resize(size,size,{fit:'contain',background:{r:0,g:0,b:0,alpha:0},kernel:sharp.kernel.lanczos3}).png({compressionLevel:9,adaptiveFiltering:true,palette:false,effort:10}).toBuffer();await writeFile('public/'+name,png);frames.set(size,png);
}
const sizes=[16,32,48],header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;
sizes.forEach((size,i)=>{const pos=6+i*16,frame=frames.get(size);header[pos]=size;header[pos+1]=size;header.writeUInt16LE(1,pos+4);header.writeUInt16LE(32,pos+6);header.writeUInt32LE(frame.length,pos+8);header.writeUInt32LE(offset,pos+12);offset+=frame.length;});
await writeFile('public/favicon.ico',Buffer.concat([header,...sizes.map(size=>frames.get(size))]));
const manifest=JSON.parse(await readFile('public/site.webmanifest','utf8'));manifest.background_color='#ffffff';manifest.theme_color='#09090b';await writeFile('public/site.webmanifest',JSON.stringify(manifest,null,2)+'\n');
console.log('Imported V10 tokens, atmosphere and exact approved brand assets; generated existing icon sizes.');
