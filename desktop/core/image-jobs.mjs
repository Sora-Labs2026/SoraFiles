import {dirname} from 'node:path';import {readFile} from 'node:fs/promises';
import {JobQueue} from './queue.mjs';import {verifyEntitlement} from '../shared/entitlement.mjs';import {readLocalInput} from './input.mjs';
import {processImage} from './images.mjs';import {saveOutput} from './output.mjs';
export function createImageJobQueue({resolveSelection,readLicenseState,selectOutputFolder=async source=>dirname(source),writer=saveOutput,onChange=()=>{}}) {
 const engines={};
 for(const [tool,action] of Object.entries({'image-converter':'convert','compress-image':'compress','resize-image':'resize','edit-image':'edit'}))engines[tool]=async(request,{signal,commit})=>{
  if(!request||!Array.isArray(request.selectionIds)||request.selectionIds.length!==1||typeof request.selectionIds[0]!=='string'||request.selectionIds[0].length>128)throw Error('Choose one image per job');
  const paths=await resolveSelection(request.selectionIds);if(!Array.isArray(paths)||paths.length!==1)throw Error('Selection expired');
  const input=await readLocalInput(paths[0],{signal,maxBytes:64*1024*1024}),result=await processImage(input,{...request.options,action,signal});
  const folder=await selectOutputFolder(paths[0]);signal.throwIfAborted();
  return commit(async()=>{const saved=await writer({source:paths[0],folder,tool,extension:result.extension,bytes:result.bytes,signal,validate:async path=>(await readFile(path)).equals(Buffer.from(result.bytes))});return {...saved,warnings:result.warnings};});
 };
 return new JobQueue({engines,authorize:async()=>{const state=await readLicenseState();verifyEntitlement(state.token,state.verification);},concurrency:1,onChange});
}
