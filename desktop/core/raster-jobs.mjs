import {readFile} from 'node:fs/promises';import {dirname} from 'node:path';import {zipSync} from 'fflate';
import {rasterPdf} from './pdf-raster.mjs';import {readLocalInput} from './input.mjs';import {saveOutput} from './output.mjs';import {JobQueue} from './queue.mjs';import {verifyEntitlement} from '../shared/entitlement.mjs';
export function createRasterJobQueue({resolveSelection,readLicenseState,selectOutputFolder=async source=>dirname(source),writer=saveOutput,onChange=()=>{}}){
 return new JobQueue({concurrency:1,onChange,authorize:async()=>{const state=await readLicenseState();verifyEntitlement(state.token,state.verification);},engines:{'pdf-to-jpg':async(request,{signal,commit})=>{
  if(!Array.isArray(request.selectionIds)||request.selectionIds.length!==1)throw Error('Choose one PDF');
  const paths=await resolveSelection(request.selectionIds);if(paths.length!==1)throw Error('Selection expired');
  const input=await readLocalInput(paths[0],{signal}),pages=await rasterPdf(input,{...request.options,signal});
  const extension=pages.length===1?pages[0].extension:'zip',bytes=pages.length===1?pages[0].bytes:zipSync(Object.fromEntries(pages.map(page=>['page-'+String(page.page).padStart(4,'0')+'.'+page.extension,page.bytes])),{level:0});
  const folder=await selectOutputFolder(paths[0]);signal.throwIfAborted();return commit(()=>writer({source:paths[0],tool:'pdf-to-jpg',folder,extension,bytes,signal,validate:async path=>(await readFile(path)).equals(Buffer.from(bytes))}));
 }}});
}
