import {dirname} from 'node:path';import {readFile} from 'node:fs/promises';
import {JobQueue} from './queue.mjs';import {readLocalInput} from './input.mjs';import {saveOutput} from './output.mjs';import {scanDocuments} from './scanner.mjs';import {verifyEntitlement} from '../shared/entitlement.mjs';
export function createScannerJobQueue({resolveSelection,readLicenseState,selectOutputFolder=async source=>dirname(source),writer=saveOutput,onChange=()=>{}}){
 return new JobQueue({concurrency:1,onChange,authorize:async()=>{const state=await readLicenseState();verifyEntitlement(state.token,state.verification);},engines:{'doc-scanner':async(request,{signal,commit})=>{
  if(!Array.isArray(request.selectionIds)||!request.selectionIds.length||request.selectionIds.length>20||!request.options||Object.keys(request.options).some(key=>!['filter','rotation','paper'].includes(key)))throw Error('Choose up to 20 images and valid scan options');
  const paths=await resolveSelection(request.selectionIds);if(paths.length!==request.selectionIds.length)throw Error('Selection expired');
  const inputs=[];let bytes=0;for(const path of paths){const input=await readLocalInput(path,{signal,maxBytes:Math.min(64*1024*1024,256*1024*1024-bytes)});inputs.push(input);bytes+=input.length;}
  const result=await scanDocuments(inputs,{...request.options,signal});
  const folder=await selectOutputFolder(paths[0]);signal.throwIfAborted();
  return commit(async()=>({...await writer({source:paths[0],folder,tool:'doc-scanner',extension:'pdf',bytes:result.bytes,signal,validate:async path=>(await readFile(path)).equals(Buffer.from(result.bytes))}),warnings:result.warnings}));
 }}});
}
