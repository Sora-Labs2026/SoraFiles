import {dirname} from 'node:path';import {readFile} from 'node:fs/promises';
import {JobQueue} from './queue.mjs';import {readLocalInput} from './input.mjs';import {saveOutput} from './output.mjs';import {removeBackground} from './background.mjs';import {verifyEntitlement} from '../shared/entitlement.mjs';
export function createBackgroundJobQueue({resolveSelection,readLicenseState,selectOutputFolder=async source=>dirname(source),writer=saveOutput,onChange=()=>{}}){
 return new JobQueue({concurrency:1,onChange,authorize:async()=>{const state=await readLicenseState();verifyEntitlement(state.token,state.verification);},engines:{'remove-background':async(request,{signal,commit})=>{
  if(!Array.isArray(request.selectionIds)||request.selectionIds.length!==1||!request.options||Object.keys(request.options).length)throw Error('Choose one image per job');
  const paths=await resolveSelection(request.selectionIds);if(paths.length!==1)throw Error('Selection expired');
  const result=await removeBackground(await readLocalInput(paths[0],{signal,maxBytes:64*1024*1024}),{signal});
  const folder=await selectOutputFolder(paths[0]);signal.throwIfAborted();
  return commit(async()=>({...await writer({source:paths[0],folder,tool:'remove-background',extension:'png',bytes:result.bytes,signal,validate:async path=>(await readFile(path)).equals(Buffer.from(result.bytes))}),warnings:result.warnings}));
 }}});
}
