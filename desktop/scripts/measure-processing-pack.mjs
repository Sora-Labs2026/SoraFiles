import {readdir,stat,writeFile,readFile} from 'node:fs/promises';import {resolve,join,relative,sep} from 'node:path';
const root=resolve('.artifacts/desktop-license-host'),groups=new Map();let bytes=0,files=0;
async function visit(directory){for(const entry of await readdir(directory,{withFileTypes:true})){
 if(entry.isSymbolicLink())throw Error('Unexpected link in generated pack');const path=join(directory,entry.name);
 if(entry.isDirectory()){await visit(path);continue;}if(!entry.isFile())throw Error('Unexpected generated pack entry');
 const size=(await stat(path)).size,parts=relative(root,path).split(sep);
 const group=parts[0]==='node_modules'?parts.slice(0,parts[1].startsWith('@')?3:2).join('/'):parts[0]==='assets'?parts.slice(0,2).join('/'):parts[0];
 files++;bytes+=size;groups.set(group,(groups.get(group)||0)+size);
}}
await visit(root);const baseline=JSON.parse(await readFile('desktop/audit/pack-size-baseline.json','utf8'));
const report={recordedAt:new Date().toISOString(),platform:process.platform,arch:process.arch,scope:'Generated resource pack; not installer size or measured installed footprint',bytes,files,groups:[...groups].sort((a,b)=>b[1]-a[1]),...(baseline.platform===process.platform&&baseline.arch===process.arch?{baselineBytes:baseline.bytes,savedBytes:baseline.bytes-bytes,reductionPercent:(baseline.bytes-bytes)/baseline.bytes*100}:{})};
await writeFile('.artifacts/processing-pack-size.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
