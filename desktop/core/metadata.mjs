import {fork} from 'node:child_process';import {fileURLToPath} from 'node:url';
export async function removeMetadata(bytes,{signal}={}){
 signal?.throwIfAborted();
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>64*1024*1024)throw Error('Choose a PDF, JPG, PNG, WebP, DOCX, XLSX or PPTX up to 64 MB');
 return new Promise((resolve,reject)=>{
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['systemroot','windir','temp','tmp','tmpdir'].includes(key.toLowerCase())));
  const child=fork(fileURLToPath(new URL('./metadata-worker.mjs',import.meta.url)),[],{serialization:'advanced',stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,execArgv:['--max-old-space-size=768'],env});
  let result,error,received=false;const stop=reason=>{error??=reason;child.kill();},abort=()=>stop(signal.reason||new DOMException('Cancelled','AbortError'));
  const timer=setTimeout(()=>stop(Error('Metadata removal took too long')),120000);signal?.addEventListener('abort',abort,{once:true});
  child.on('error',()=>stop(Error('Metadata removal could not start')));
  child.on('message',message=>{
   if(received)return stop(Error('Invalid metadata response'));received=true;
   if(!message?.ok||!(message.bytes instanceof Uint8Array)||!message.bytes.length||message.bytes.length>64*1024*1024||!['pdf','jpg','png','webp','docx','xlsx','pptx'].includes(message.extension))return stop(Error('Use an unencrypted PDF, still JPG, PNG or WebP image, or unsigned DOCX, XLSX or PPTX without macros. This file could not be cleaned safely.'));
   if(['jpg','png','webp'].includes(message.extension)&&!['lossless','reencoded'].includes(message.imageMode))return stop(Error('Invalid image metadata result'));
   result={bytes:message.bytes,extension:message.extension,warnings:message.extension==='pdf'
    ?['Removed PDF document properties and XMP metadata. Text, annotations, attachments and other content may still identify you. Rewriting can invalidate digital signatures.']
    :['docx','xlsx','pptx'].includes(message.extension)?['Removed standard author, title, date, company, manager and custom document properties. Other document contents are unchanged. Comments, tracked changes, embedded files and visible content may still identify you. This is not redaction.']
    :message.imageMode==='lossless'?['Removed common image metadata without re-encoding. Decoded image pixels are unchanged. Visible content can still identify you.']
    :['Removed image metadata and applied camera orientation and colour conversion where needed. This copy was re-encoded; appearance or quality may change. Visible content can still identify you.']};
  });
  child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error||code!==0||!result)reject(error||Error('Metadata removal stopped'));else resolve(result);});
  child.send({bytes},error=>{if(error)stop(Error('Metadata removal could not start'));});if(signal?.aborted)abort();
 });
}
