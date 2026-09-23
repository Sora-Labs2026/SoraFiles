import {dirname} from 'node:path';import {readFile} from 'node:fs/promises';import {PDFDocument} from 'pdf-lib';
import {recognizeDocument} from './ocr.mjs';import {JobQueue} from './queue.mjs';import {readLocalInput} from './input.mjs';import {saveOutput} from './output.mjs';import {verifyEntitlement} from '../shared/entitlement.mjs';
export function createOcrJobQueue({resolveSelection,readLicenseState,selectOutputFolder=async source=>dirname(source),writer=saveOutput,onChange=()=>{}}){
 return new JobQueue({onChange,authorize:async()=>{const state=await readLicenseState();verifyEntitlement(state.token,state.verification);},engines:{'pdf-ocr':async(request,{signal,commit})=>{
  if(!Array.isArray(request.selectionIds)||request.selectionIds.length!==1)throw Error('Choose one file for OCR');
  const paths=await resolveSelection(request.selectionIds);if(paths.length!==1)throw Error('Selection expired');
  const result=await recognizeDocument(await readLocalInput(paths[0],{signal}),{...request.options,signal});
  const folder=await selectOutputFolder(paths[0]);signal.throwIfAborted();
  return commit(async()=>{const saved=await writer({source:paths[0],folder,tool:'pdf-ocr',extension:result.extension,bytes:result.bytes,signal,validate:async path=>{const bytes=await readFile(path);if(!bytes.equals(Buffer.from(result.bytes)))return false;return result.extension==='txt'||(await PDFDocument.load(bytes,{updateMetadata:false})).getPageCount()===result.pages;}});return {...saved,warnings:result.warnings};});
 }}});
}
