import {fork} from 'node:child_process';import {fileURLToPath} from 'node:url';
export async function scanDocuments(inputs,{filter='enhanced',rotation=0,paper='a4',signal}={}){
 signal?.throwIfAborted();
 if(!Array.isArray(inputs)||!inputs.length||inputs.length>20||inputs.some(bytes=>!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>64*1024*1024)||inputs.reduce((sum,b)=>sum+b.length,0)>256*1024*1024)throw Error('Choose 1 to 20 JPG, PNG or WebP images, up to 64 MB each and 256 MB together');
 if(!['original','enhanced','color','grayscale','bw','contrast','receipt'].includes(filter)||![0,90,180,270].includes(rotation)||!['a4','letter','image'].includes(paper))throw Error('Choose valid scan options');
 return new Promise((resolve,reject)=>{
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['systemroot','windir','temp','tmp','tmpdir'].includes(key.toLowerCase())));
  const child=fork(fileURLToPath(new URL('./scanner-worker.mjs',import.meta.url)),[],{serialization:'advanced',stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,execArgv:['--max-old-space-size=768'],env});
  let result,error,received=false;const stop=reason=>{error??=reason;child.kill();},abort=()=>stop(signal.reason||new DOMException('Cancelled','AbortError'));
  const timer=setTimeout(()=>stop(Error('Document scanning took too long. Try fewer or smaller pages.')),180000);signal?.addEventListener('abort',abort,{once:true});
  child.on('error',()=>stop(Error('Document scanning could not start')));
  child.on('message',message=>{
   if(received)return stop(Error('Invalid scanner response'));received=true;
   if(!message?.ok||!(message.bytes instanceof Uint8Array)||!message.bytes.length||message.bytes.length>256*1024*1024||message.pages!==inputs.length)return stop(Error('Use still JPG, PNG or WebP images up to 12 megapixels each and 60 megapixels together. A page could not be processed safely.'));
   result={bytes:message.bytes,pages:message.pages,warnings:['Saved image-only PDF pages in the selected order. Review fine text, colour and faint markings after filtering. Camera capture, perspective cropping and searchable text are not available in this workflow yet.']};
  });
  child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error||code!==0||!result)reject(error||Error('Document scanning stopped'));else resolve(result);});
  child.send({inputs,options:{filter,rotation,paper}},error=>{if(error)stop(Error('Document scanning could not start'));});if(signal?.aborted)abort();
 });
}
