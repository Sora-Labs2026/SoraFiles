import {fork} from 'node:child_process';import {fileURLToPath} from 'node:url';
// Same five levels as the website's compression strength, plus the opt-in
// smallest level. dpi caps photo resolution for the document's largest page;
// quality is the JPEG quality for recompressed photos.
export const PDF_LEVELS=Object.freeze({safe:{dpi:240,quality:90},quality:{dpi:230,quality:86},balanced:{dpi:200,quality:84},strong:{dpi:180,quality:82},'max-safe':{dpi:150,quality:76},smallest:{dpi:120,quality:70}});
export function pdfLevel(strength,smallest=false){
 if(!Number.isInteger(strength)||strength<0||strength>100||typeof smallest!=='boolean')throw Error('Choose a compression strength from 0 to 100');
 if(smallest&&strength===100)return 'smallest';
 return strength<=29?'safe':strength<=54?'quality':strength<=74?'balanced':strength<=89?'strong':'max-safe';
}
export async function compressPdf(bytes,{strength,smallest=false,signal}={}){
 signal?.throwIfAborted();if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>64*1024*1024)throw Error('Choose an unencrypted PDF up to 64 MB');
 // No strength: structure only (the original behaviour).
 const name=strength===undefined?null:pdfLevel(strength,smallest),level=name?{name,...PDF_LEVELS[name]}:null;
 return new Promise((resolve,reject)=>{
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['systemroot','windir','temp','tmp','tmpdir'].includes(key.toLowerCase())));
  const child=fork(fileURLToPath(new URL('./pdf-compress-worker.mjs',import.meta.url)),[],{serialization:'advanced',stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,execArgv:['--max-old-space-size=768'],env});
  let result,error,received=false;const stop=reason=>{error??=reason;child.kill();},abort=()=>stop(signal.reason||new DOMException('Cancelled','AbortError'));
  const timer=setTimeout(()=>stop(Error('PDF compression took too long. Split the file and try again.')),300000);signal?.addEventListener('abort',abort,{once:true});
  child.on('error',()=>stop(Error('PDF compression could not start')));
  child.on('message',message=>{
   if(received)return stop(Error('Invalid compression response'));received=true;
   if(!message?.ok||!(message.bytes instanceof Uint8Array)||!message.bytes.length||message.bytes.length>bytes.length||typeof message.unchanged!=='boolean'||!Number.isSafeInteger(message.images)||message.images<0)return stop(Error('Use an unencrypted, unsigned PDF up to 1000 pages. This file could not be compressed safely.'));
   const detail=!level?'PDF structure compressed without reducing image resolution.':message.images?`${message.images} ${message.images===1?'photo was':'photos were'} recompressed (up to ${level.dpi} dpi, JPEG quality ${level.quality}); text and vector content are unchanged.`:'No photos could be reduced safely, so only the PDF structure was compressed.';
   result={bytes:message.bytes,extension:'pdf',unchanged:message.unchanged,warnings:[message.unchanged?'No smaller result was found. Saved an unchanged copy.':`${detail} Review the saved document before sharing.`]};
  });
  child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error||code!==0||!result)reject(error||Error('PDF compression stopped'));else resolve(result);});
  child.send({bytes,level},error=>{if(error)stop(Error('PDF compression could not start'));});if(signal?.aborted)abort();
 });
}
