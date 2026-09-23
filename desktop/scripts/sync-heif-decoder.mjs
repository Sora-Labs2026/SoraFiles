import {readFile,writeFile,copyFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),source=new URL('node_modules/heic-to/src/lib/libheif-without-unsafe-eval.js',root);
const bytes=await readFile(source),text=bytes.toString('utf8');
if(createHash('sha256').update(bytes).digest('hex')!=='356068bb64947a76f1490ee139b2cab52f62e5e60d1945413aed9ab94c09e754')throw Error('Review the changed HEIF decoder before packaging');
if(!text.startsWith('// Build from libheif 1.22.2 with USE_UNSAFE_EVAL=0 and LIBDE265_VERSION=1.0.16')||!text.endsWith('export default buildLibheif\n'))throw Error('Review the installed HEIF decoder before packaging');
// Its Node branch already requires CommonJS globals. Change only the export;
// preserve the installed decoder/WASM bytes and retain its license alongside it.
await writeFile(new URL('../shared/heif-decoder.cjs',import.meta.url),text.replace(/export default buildLibheif\n$/,'module.exports = buildLibheif;\n'));
await copyFile(new URL('node_modules/heic-to/LICENSE',root),new URL('../shared/heif-decoder-LICENSE.txt',import.meta.url));
await writeFile(new URL('../shared/heif-decoder-provenance.json',import.meta.url),JSON.stringify({package:'heic-to',version:'1.5.2',license:'LGPL-3.0',source:'heic-to/src/lib/libheif-without-unsafe-eval.js',sha256:createHash('sha256').update(bytes).digest('hex'),adaptation:'ESM export changed to CommonJS export for existing Node branch',releaseGate:'Complete libheif/libde265 corresponding source and codec/redistribution review required'},null,2)+'\n');
