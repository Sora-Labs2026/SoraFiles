import {fork} from 'node:child_process';import {fileURLToPath} from 'node:url';
export async function removeBackground(bytes,{signal}={}){
 signal?.throwIfAborted();if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>64*1024*1024)throw Error('Choose a still JPG, PNG or WebP up to 64 MB');
 return new Promise((resolve,reject)=>{
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['systemroot','windir','temp','tmp','tmpdir'].includes(key.toLowerCase())));
  const child=fork(fileURLToPath(new URL('./background-worker.mjs',import.meta.url)),[],{serialization:'advanced',stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,execArgv:['--max-old-space-size=768'],env});
  let result,error,received=false;const stop=reason=>{error??=reason;child.kill();},abort=()=>stop(signal.reason||new DOMException('Cancelled','AbortError'));
  const timer=setTimeout(()=>stop(Error('Background removal took too long. Try a smaller image.')),180000);signal?.addEventListener('abort',abort,{once:true});
  child.on('error',()=>stop(Error('Background removal could not start')));
  child.on('message',message=>{
   if(received)return stop(Error('Invalid background response'));received=true;
   if(!message?.ok||!(message.bytes instanceof Uint8Array)||!message.bytes.length||message.bytes.length>64*1024*1024||!Number.isSafeInteger(message.width)||!Number.isSafeInteger(message.height)||message.width<1||message.height<1||message.width*message.height>12_000_000)return stop(Error('This image could not be separated safely. Use a JPG, PNG or WebP up to 12 megapixels with a clear foreground subject, and check the installed model pack.'));
   result={bytes:message.bytes,width:message.width,height:message.height,warnings:['Review the transparent PNG, especially hair, fine edges, glass and low-contrast areas. Automatic masks can omit subject details. Manual mask editing is not available yet.']};
  });
  child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error||code!==0||!result)reject(error||Error('Background removal stopped'));else resolve(result);});
  child.send({bytes},error=>{if(error)stop(Error('Background removal could not start'));});if(signal?.aborted)abort();
 });
}
