import {fork} from 'node:child_process';import {fileURLToPath} from 'node:url';
export async function compressPdf(bytes,{signal}={}){
 signal?.throwIfAborted();if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>64*1024*1024)throw Error('Choose an unencrypted PDF up to 64 MB');
 return new Promise((resolve,reject)=>{
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['systemroot','windir','temp','tmp','tmpdir'].includes(key.toLowerCase())));
  const child=fork(fileURLToPath(new URL('./pdf-compress-worker.mjs',import.meta.url)),[],{serialization:'advanced',stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,execArgv:['--max-old-space-size=512'],env});
  let result,error,received=false;const stop=reason=>{error??=reason;child.kill();},abort=()=>stop(signal.reason||new DOMException('Cancelled','AbortError'));
  const timer=setTimeout(()=>stop(Error('PDF compression took too long. Split the file and try again.')),120000);signal?.addEventListener('abort',abort,{once:true});
  child.on('error',()=>stop(Error('PDF compression could not start')));
  child.on('message',message=>{
   if(received)return stop(Error('Invalid compression response'));received=true;
   if(!message?.ok||!(message.bytes instanceof Uint8Array)||!message.bytes.length||message.bytes.length>bytes.length||typeof message.unchanged!=='boolean')return stop(Error('Use an unencrypted, unsigned PDF up to 1000 pages. This file could not be compressed safely.'));
   result={bytes:message.bytes,extension:'pdf',unchanged:message.unchanged,warnings:[message.unchanged?'No smaller result was found. Saved an unchanged copy.':'PDF structure compressed without reducing image resolution. Review the saved document before sharing.']};
  });
  child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error||code!==0||!result)reject(error||Error('PDF compression stopped'));else resolve(result);});
  child.send({bytes},error=>{if(error)stop(Error('PDF compression could not start'));});if(signal?.aborted)abort();
 });
}
