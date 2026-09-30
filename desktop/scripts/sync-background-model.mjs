import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {backgroundModel as model} from '../shared/background-model.mjs';
const root=new URL('../../',import.meta.url),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const output=new URL('.artifacts/desktop-background-assets/',root);await mkdir(output,{recursive:true});
await mkdir(new URL('.artifacts/desktop-probe-cache/',root),{recursive:true});
async function asset(name,expected){
 const url=model.origin+name,path=new URL('.artifacts/desktop-probe-cache/'+hash(url),root);let bytes;
 try{bytes=await readFile(path);}catch{
  if(!process.argv.includes('--download'))throw Error('Background model cache missing. Run sync-background-model.mjs --download to fetch checksum-pinned public assets.');
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Background model download failed');bytes=Buffer.from(await response.arrayBuffer());
 }
 if(hash(bytes)!==expected)throw Error('Background model checksum mismatch');
 if(process.argv.includes('--download'))await writeFile(path,bytes);
 return bytes;
}
const manifest=await asset('resources.json',model.manifestSha256),entry=JSON.parse(manifest)['/models/isnet_quint8'];
if(entry.size!==model.bytes||entry.chunks.length!==11)throw Error('Unexpected background model manifest');
const parts=[];let end=0;for(const part of entry.chunks){
 if(!/^[a-f0-9]{64}$/.test(part.name)||part.hash!==part.name||part.offsets[0]!==end||part.offsets[1]<=end)throw Error('Invalid model chunk');
 const bytes=await asset(part.name,part.hash);if(bytes.length!==part.offsets[1]-end)throw Error('Invalid model chunk size');parts.push(bytes);end=part.offsets[1];
}
const bytes=Buffer.concat(parts);if(bytes.length!==model.bytes||hash(bytes)!==model.sha256)throw Error('Invalid assembled model');
await writeFile(new URL(model.file,output),bytes);
await writeFile(new URL('provenance.json',output),JSON.stringify({...model,model:'ISNET quantized uint8',supplier:'IMG.LY background-removal-data 1.7.0',license:'MIT according to installed ThirdPartyLicenses.json',releaseGate:'Exact converted-model source/build provenance and redistribution clearance required'},null,2)+'\n');
console.log('Verified background model:',bytes.length,'bytes');
