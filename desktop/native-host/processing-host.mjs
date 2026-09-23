import {createPdfJobQueue} from '../core/pdf-jobs.mjs';
import {createImageJobQueue} from '../core/image-jobs.mjs';
import {deviceIdentity} from '../shared/entitlement.mjs';
import {runLicenseAction} from './license-host.mjs';
import {isDesktopTool} from '../shared/tool-policy.mjs';
import {basename} from 'node:path';

export const processingTools=Object.freeze(['merge-pdf','split-pdf','rotate-pdf','remove-pages','page-numbers','watermark-pdf','sign-pdf','jpg-to-pdf','image-converter','compress-image','resize-image','edit-image','pdf-to-jpg','pdf-ocr','protect-pdf','metadata-remover','pdf-to-excel','pdf-to-word','heic-to-jpg','compress-pdf','repair-pdf','doc-scanner','remove-background']);

// Only the native parent supplies paths, destination and protected state. The
// renderer submits selection IDs; it cannot choose a process, key or filesystem path.
export async function runProcessing({tool,paths,options={},folder,state,config,saveState,signal,onChange=()=>{}}){
 if(!isDesktopTool(tool)||!processingTools.includes(tool)||!Array.isArray(paths)||!paths.length||paths.length>256||paths.some(path=>typeof path!=='string')
  ||!options||Object.getPrototypeOf(options)!==Object.prototype||JSON.stringify(options).length>12000)throw Error('Invalid processing request');
 signal?.throwIfAborted();
 let current=state;
 const status=await runLicenseAction({action:'status',state:current,config,saveState:async value=>{await saveState(value);current=value;}});
 if(!['active','trial'].includes(status.license))throw Error('Start a trial or check your license before processing');
 signal?.throwIfAborted();
 const create=tool==='remove-background'?(await import('../core/background-jobs.mjs')).createBackgroundJobQueue:tool==='doc-scanner'?(await import('../core/scanner-jobs.mjs')).createScannerJobQueue:tool==='repair-pdf'?(await import('../core/pdf-repair-jobs.mjs')).createPdfRepairJobQueue:tool==='compress-pdf'?(await import('../core/pdf-compress-jobs.mjs')).createPdfCompressJobQueue:tool==='heic-to-jpg'?(await import('../core/heic-jobs.mjs')).createHeicJobQueue:tool==='pdf-to-word'?(await import('../core/pdf-word-jobs.mjs')).createPdfWordJobQueue:tool==='pdf-to-excel'?(await import('../core/pdf-excel-jobs.mjs')).createPdfExcelJobQueue:tool==='metadata-remover'?(await import('../core/metadata-jobs.mjs')).createMetadataJobQueue:tool==='protect-pdf'?(await import('../core/protect-jobs.mjs')).createProtectJobQueue:tool==='pdf-ocr'?(await import('../core/ocr-jobs.mjs')).createOcrJobQueue:tool==='pdf-to-jpg'?(await import('../core/raster-jobs.mjs')).createRasterJobQueue:tool.includes('image')?createImageJobQueue:createPdfJobQueue;
 let finish;
 const queue=create({resolveSelection:async ids=>ids.map(id=>paths[Number(id)]),
  readLicenseState:async()=>({token:current.license.entitlement,verification:{keys:config.keys,deviceId:deviceIdentity(current.device.publicKey),lastTrustedTime:current.license.lastTrustedTime||0}}),
  ...(folder?{selectOutputFolder:async()=>folder}:{}),
  onChange:rows=>{const job=rows[0];if(!job)return;try{onChange({state:job.state});}catch{}if(['completed','failed','cancelled'].includes(job.state))finish?.(job);}});
 let id;const cancel=()=>{if(id)queue.cancel(id);};signal?.addEventListener('abort',cancel,{once:true});
 try{
  const batch=paths.length>1&&!['merge-pdf','jpg-to-pdf','sign-pdf','doc-scanner'].includes(tool);
  const groups=batch?paths.map((_,index)=>[String(index)]):[paths.map((_,index)=>String(index))];
  const results=[];
  for(const [index,selectionIds] of groups.entries()){
   if(signal?.aborted){results.push({index,state:'cancelled'});continue;}
   const done=new Promise(resolve=>{finish=resolve;});
   let job;
   try{
    id=await queue.add(tool,{selectionIds,options});
    if(signal?.aborted)queue.cancel(id);
    job=await done;
   }catch(error){
    if(!batch)throw error;
    // Authorization failure stops the remaining batch. Completed outputs remain valid.
    results.push({index,state:signal?.aborted?'cancelled':'failed'});
    for(let rest=index+1;rest<groups.length;rest++)results.push({index:rest,state:'cancelled'});
    break;
   }finally{queue.clearFinished();id=undefined;finish=undefined;}
   if(!batch){
    if(job.state==='failed')throw Error(job.error);
    return job.state==='cancelled'?{state:'cancelled'}:{state:'completed',...job.result};
   }
   if(job.state==='completed'){
    const {path,...saved}=job.result;
    results.push({index,state:'completed',name:basename(path),...saved});
   }else results.push({index,state:job.state});
  }
  return {state:'batch',results};
 }finally{signal?.removeEventListener('abort',cancel);}
}
