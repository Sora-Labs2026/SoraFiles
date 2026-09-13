import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const MAX_IMAGE_BYTES=64*1024*1024,MAX_IMAGE_PIXELS=25_000_000;

// Decode untrusted pixels outside the helper. No selected paths or credentials
// are sent to the process. Cancellation kills it; success waits for its exit.
export function decodeImage(bytes,{signal}={}) {return runImageProcess(bytes,{action:'decode'},{signal});}
export function runImageProcess(bytes,options,{signal}={}) {
 signal?.throwIfAborted();
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>MAX_IMAGE_BYTES)throw Error('Choose an image up to 64 MB');
 return new Promise((resolve,reject)=>{
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['path','systemroot','windir','temp','tmp','tmpdir'].includes(key.toLowerCase())));
  const child=fork(fileURLToPath(new URL('./image-decode-worker.mjs',import.meta.url)),[],{serialization:'advanced',stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,execArgv:[],env});
  let result,error,received=false;
  const stop=reason=>{error??=reason;child.kill();};
  const abort=()=>stop(signal.reason||new DOMException('Cancelled','AbortError'));
  const timer=setTimeout(()=>stop(Error('Image decoding took too long')),120000);
  signal?.addEventListener('abort',abort,{once:true});
  child.on('error',()=>stop(Error('Image decoder unavailable')));
  child.on('message',message=>{
   if(received)return stop(Error('Invalid image decoder response'));received=true;
   if(!message?.ok||!(message.bytes instanceof Uint8Array)||!message.bytes.length||message.bytes.length>MAX_IMAGE_BYTES
    ||!Number.isSafeInteger(message.width)||!Number.isSafeInteger(message.height)||message.width<1||message.height<1||message.width*message.height>MAX_IMAGE_PIXELS)return stop(Error('The image could not be decoded safely'));
   if(!['png','jpeg','webp'].includes(message.format))return stop(Error('Invalid image output format'));
   result={bytes:message.bytes,width:message.width,height:message.height,format:message.format,unchanged:message.unchanged===true};
  });
  child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error||code!==0||!result)reject(error||Error('The image could not be decoded safely'));else resolve(result);});
  child.send({bytes,options},err=>{if(err)stop(Error('Image decoder unavailable'));});
  if(signal?.aborted)abort();
 });
}
