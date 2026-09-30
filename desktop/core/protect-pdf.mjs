import {fork} from 'node:child_process';import {fileURLToPath} from 'node:url';
const validPassword=value=>typeof value==='string'&&!!value.trim()&&!/[\u0000-\u001f\u007f]/u.test(value)&&Buffer.byteLength(value.normalize('NFKC'))<=127;
// Restrictions only hold if the permissions (owner) password differs from the
// opening password: whoever opens with the owner password has full rights.
export function protectionOptions({password,ownerPassword,allowPrinting=true,allowCopying=true,allowModifying=true}={}){
 if(!validPassword(password))throw Error('Choose an opening password up to 127 UTF-8 bytes');
 if([allowPrinting,allowCopying,allowModifying].some(value=>typeof value!=='boolean'))throw Error('Choose valid PDF permissions');
 if(ownerPassword!==undefined&&ownerPassword!==''&&(!validPassword(ownerPassword)||ownerPassword===password))throw Error('Use a permissions password that is different from the opening password');
 if((!allowPrinting||!allowCopying||!allowModifying)&&!ownerPassword)throw Error('Set a permissions password to restrict printing, copying or editing');
 return {password,ownerPassword:ownerPassword||undefined,allowPrinting,allowCopying,allowModifying};
}
export async function protectPdf(bytes,{password,ownerPassword,allowPrinting,allowCopying,allowModifying,signal}={}){
 signal?.throwIfAborted();
 const options=protectionOptions({password,ownerPassword,allowPrinting,allowCopying,allowModifying});
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>256*1024*1024)throw Error('Choose an unencrypted PDF up to 256 MB');
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
  child.send({bytes,...options},error=>{if(error)stop(Error('PDF protection could not start'));});if(signal?.aborted)abort();
 });
}
