import {createPdfJobQueue} from '../core/pdf-jobs.mjs';
import {createImageJobQueue} from '../core/image-jobs.mjs';
import {deviceIdentity} from '../shared/entitlement.mjs';
import {runLicenseAction} from './license-host.mjs';

export const processingTools=Object.freeze(['merge-pdf','split-pdf','rotate-pdf','remove-pages','page-numbers','watermark-pdf','sign-pdf','jpg-to-pdf','image-converter','compress-image','resize-image','edit-image','pdf-to-jpg']);

// Only the native parent supplies paths, destination and protected state. The
// renderer submits selection IDs; it cannot choose a process, key or filesystem path.
export async function runProcessing({tool,paths,options={},folder,state,config,saveState,signal,onChange=()=>{}}){
 if(!processingTools.includes(tool)||!Array.isArray(paths)||!paths.length||paths.length>256||paths.some(path=>typeof path!=='string')
  ||!options||Object.getPrototypeOf(options)!==Object.prototype||JSON.stringify(options).length>12000)throw Error('Invalid processing request');
 signal?.throwIfAborted();
 let current=state;
 const status=await runLicenseAction({action:'status',state:current,config,saveState:async value=>{await saveState(value);current=value;}});
 if(!['active','trial'].includes(status.license))throw Error('Start a trial or check your license before processing');
 signal?.throwIfAborted();
 let finish;const done=new Promise(resolve=>{finish=resolve;});
 const create=tool==='pdf-to-jpg'?(await import('../core/raster-jobs.mjs')).createRasterJobQueue:tool.includes('image')?createImageJobQueue:createPdfJobQueue;
 const queue=create({resolveSelection:async ids=>ids.map(id=>paths[Number(id)]),
  readLicenseState:async()=>({token:current.license.entitlement,verification:{keys:config.keys,deviceId:deviceIdentity(current.device.publicKey),lastTrustedTime:current.license.lastTrustedTime||0}}),
  ...(folder?{selectOutputFolder:async()=>folder}:{}),
  onChange:rows=>{const job=rows[0];if(!job)return;try{onChange({state:job.state});}catch{}if(['completed','failed','cancelled'].includes(job.state))finish(job);}});
 let id;const cancel=()=>{if(id)queue.cancel(id);};signal?.addEventListener('abort',cancel,{once:true});
 try{
  id=await queue.add(tool,{selectionIds:paths.map((_,index)=>String(index)),options});
  if(signal?.aborted)queue.cancel(id);
  const job=await done;
  if(job.state==='failed')throw Error(job.error);
  return job.state==='cancelled'?{state:'cancelled'}:{state:'completed',...job.result};
 }finally{signal?.removeEventListener('abort',cancel);}
}
