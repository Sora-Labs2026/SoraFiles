import {guides} from '../src/data/guides.ts';
import {writeFile} from 'node:fs/promises';
const urls=[...new Set(guides.flatMap(g=>g.references.map(r=>r.url)))];const rows=[];
for(let i=0;i<urls.length;i+=4)rows.push(...await Promise.all(urls.slice(i,i+4).map(async url=>{try{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});await r.arrayBuffer();return {url,status:r.status,finalUrl:r.url}}catch(e){return {url,error:e.message}}})));
await writeFile('.artifacts/astra-guide-references.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));
if(rows.some(r=>r.status!==200))process.exitCode=1;
