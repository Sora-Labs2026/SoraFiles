import {dirname} from 'node:path';import {readFile} from 'node:fs/promises';
import {JobQueue} from './queue.mjs';import {readLocalInput} from './input.mjs';import {saveOutput} from './output.mjs';import {compressPdf} from './pdf-compress.mjs';import {verifyEntitlement} from '../shared/entitlement.mjs';
export function createPdfCompressJobQueue({resolveSelection,readLicenseState,selectOutputFolder=async source=>dirname(source),writer=saveOutput,onChange=()=>{}}){
 return new JobQueue({concurrency:1,onChange,authorize:async()=>{const state=await readLicenseState();verifyEntitlement(state.token,state.verification);},engines:{'compress-pdf':async(request,{signal,commit})=>{
  // Options: none (structure only) or {strength 0-100, smallest?}; pdfLevel validates the values.
  const options=request.options;
  if(!Array.isArray(request.selectionIds)||request.selectionIds.length!==1||!options||Object.keys(options).some(key=>!['strength','smallest'].includes(key))||'smallest' in options&&!('strength' in options))throw Error('Choose a PDF per job');
  const paths=await resolveSelection(request.selectionIds);if(paths.length!==1)throw Error('Selection expired');
  const result=await compressPdf(await readLocalInput(paths[0],{signal,maxBytes:64*1024*1024}),{signal,...('strength' in options?{strength:options.strength,smallest:options.smallest??false}:{})});
  const folder=await selectOutputFolder(paths[0]);signal.throwIfAborted();
  return commit(async()=>({...await writer({source:paths[0],folder,tool:'compress-pdf',extension:'pdf',bytes:result.bytes,signal,validate:async path=>(await readFile(path)).equals(Buffer.from(result.bytes))}),warnings:result.warnings}));
 }}});
}
