import {readdir,readFile,stat,unlink,realpath,writeFile} from 'node:fs/promises';
import {join,relative,sep,resolve} from 'node:path';
// Only generated runtime copies are pruned. Repository dependencies and source
// remain intact. Package version changes require reviewing the runtime paths.
const root=await realpath(new URL('../../.artifacts/desktop-license-host/',import.meta.url));
const packages={
 'onnxruntime-web':{version:'1.21.0',keep:path=>['dist/ort.node.min.mjs','dist/ort.node.min.js','dist/ort-wasm-simd-threaded.mjs','dist/ort-wasm-simd-threaded.wasm'].includes(path)},
 'pdf-lib':{version:'1.17.1',keep:path=>path.startsWith('cjs/')&&!/\.d\.ts(?:\.map)?$|\.map$/.test(path)},
 'pdfjs-dist':{version:'6.2.108',keep:path=>!path.endsWith('.map')&&!path.startsWith('types/')},
 'tesseract.js-core':{version:'7.0.0',keep:path=>!path.endsWith('.wasm.js')}
};
const removed=[];let before=0,after=0;
for(const[name,policy]of Object.entries(packages)){
 const directory=join(root,'node_modules',name),meta=JSON.parse(await readFile(join(directory,'package.json'),'utf8'));
 if(meta.version!==policy.version)throw Error('Review generated-package pruning for '+name+' '+meta.version);
 async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){
  const path=join(dir,item.name);if(item.isSymbolicLink())throw Error('Generated package contains a link');
  if(item.isDirectory()){await walk(path);continue;}if(!item.isFile())throw Error('Unexpected generated package entry');
  const local=relative(directory,path).split(sep).join('/'),bytes=(await stat(path)).size;before+=bytes;
  const notice=/(^|\/)(?:license|licence|copying|notice|copyright|thirdparty|third-party)[^/]*$/i.test(local);
  // A package's nested dependency is its own runtime unit. Never apply the
  // parent's file policy to that dependency (pdf-lib embeds tslib).
  if(local.startsWith('node_modules/')||local==='package.json'||notice||policy.keep(local)){after+=bytes;continue;}
  const absolute=await realpath(path);if(!absolute.startsWith(root+sep)||resolve(path)!==absolute)throw Error('Pruning escaped generated pack');
  await unlink(absolute);removed.push({path:relative(root,absolute).split(sep).join('/'),bytes});
 }}await walk(directory);
}
const report={recordedAt:new Date().toISOString(),platform:process.platform,arch:process.arch,scope:'Runtime-only pruning of four version-pinned package copies; notices retained; isolated tests required',beforeBytes:before,afterBytes:after,savedBytes:before-after,removed};
await writeFile(new URL('../../.artifacts/processing-prune-report.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({prunedFiles:removed.length,savedBytes:report.savedBytes}));
