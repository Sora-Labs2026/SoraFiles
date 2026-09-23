import {fork} from 'node:child_process';import {fileURLToPath} from 'node:url';
export async function protectPdf(bytes,{password,signal}={}){
 signal?.throwIfAborted();
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>256*1024*1024||typeof password!=='string'||!password.trim()||/[\u0000-\u001f\u007f]/u.test(password)||Buffer.byteLength(password.normalize('NFKC'))>127)throw Error('Choose an opening password up to 127 UTF-8 bytes');
 return new Promise((resolve,reject)=>{
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['systemroot','windir','temp','tmp','tmpdir'].includes(key.toLowerCase())));
  const child=fork(fileURLToPath(new URL('./protect-pdf-worker.mjs',import.meta.url)),[],{serialization:'advanced',stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,execArgv:['--max-old-space-size=768'],env});
  let result,error,received=false;const stop=reason=>{error??=reason;child.kill();},abort=()=>stop(signal.reason||new DOMException('Cancelled','AbortError'));
  const timer=setTimeout(()=>stop(Error('PDF protection took too long')),120000);signal?.addEventListener('abort',abort,{once:true});
  child.on('error',()=>stop(Error('PDF protection could not start')));
  child.on('message',message=>{
   if(received)return stop(Error('Invalid protection response'));received=true;
   if(!message?.ok||!(message.bytes instanceof Uint8Array)||!message.bytes.length||message.bytes.length>256*1024*1024||!Number.isSafeInteger(message.pages)||message.pages<1||message.pages>1000)return stop(Error('PDF protection could not finish. Use an unencrypted PDF and check the password.'));
   result={bytes:message.bytes,pages:message.pages,warnings:['Keep your password safe. SoraFiles cannot recover it. Adding protection may invalidate existing digital signatures.']};
  });
  child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error||code!==0||!result)reject(error||Error('PDF protection stopped'));else resolve(result);});
  child.send({bytes,password},error=>{if(error)stop(Error('PDF protection could not start'));});if(signal?.aborted)abort();
 });
}
