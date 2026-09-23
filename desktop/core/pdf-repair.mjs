import {fork} from 'node:child_process';import {fileURLToPath} from 'node:url';
export async function repairPdf(bytes,{signal}={}){
 signal?.throwIfAborted();if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>64*1024*1024)throw Error('Choose an unencrypted PDF up to 64 MB');
 return new Promise((resolve,reject)=>{
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['systemroot','windir','temp','tmp','tmpdir'].includes(key.toLowerCase())));
  const child=fork(fileURLToPath(new URL('./pdf-repair-worker.mjs',import.meta.url)),[],{serialization:'advanced',stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,execArgv:['--max-old-space-size=512'],env});
  let result,error,received=false;const stop=reason=>{error??=reason;child.kill();},abort=()=>stop(signal.reason||new DOMException('Cancelled','AbortError'));
  const timer=setTimeout(()=>stop(Error('PDF repair took too long. Try a smaller file.')),120000);signal?.addEventListener('abort',abort,{once:true});
  child.on('error',()=>stop(Error('PDF repair could not start')));
  child.on('message',message=>{
   if(received)return stop(Error('Invalid repair response'));received=true;
   if(!message?.ok||!(message.bytes instanceof Uint8Array)||!message.bytes.length||message.bytes.length>64*1024*1024)return stop(Error('This PDF could not be rewritten safely. Use an unencrypted, unsigned PDF up to 100 pages with readable page content. Missing data cannot be recovered.'));
   result={bytes:message.bytes,extension:'pdf',warnings:['A fresh PDF structure was saved after page checks. This may resolve broken cross-reference information; missing or truncated data cannot be recovered. Review every page, attachment and form before relying on this copy.']};
  });
  child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error||code!==0||!result)reject(error||Error('PDF repair stopped'));else resolve(result);});
  child.send({bytes},error=>{if(error)stop(Error('PDF repair could not start'));});if(signal?.aborted)abort();
 });
}
