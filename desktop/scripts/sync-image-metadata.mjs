import {readFile,writeFile} from 'node:fs/promises';
const source=await readFile(new URL('../../src/lib/metadata-strip.js',import.meta.url),'utf8');
const marker='export async function stripOpenXmlMeta';
if(source.indexOf(marker)<0||!source.includes('export async function stripImageMeta'))throw Error('Image metadata source changed; review generator');
await writeFile(new URL('../shared/image-metadata.mjs',import.meta.url),'// Generated from src/lib/metadata-strip.js by sync-image-metadata.mjs.\n'+source.slice(0,source.indexOf(marker)));
