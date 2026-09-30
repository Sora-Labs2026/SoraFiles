import {fork} from 'node:child_process';import {fileURLToPath} from 'node:url';
export async function pdfToWord(bytes,{direction='ltr',signal}={}){
 signal?.throwIfAborted();
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>64*1024*1024||!['ltr','rtl'].includes(direction))throw Error('Choose an unencrypted PDF up to 64 MB and a text direction');
 return new Promise((resolve,reject)=>{
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['systemroot','windir','temp','tmp','tmpdir'].includes(key.toLowerCase())));
  const child=fork(fileURLToPath(new URL('./pdf-word-worker.mjs',import.meta.url)),[],{serialization:'advanced',stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,execArgv:['--max-old-space-size=512'],env});
  let result,error,received=false;const stop=reason=>{error??=reason;child.kill();},abort=()=>stop(signal.reason||new DOMException('Cancelled','AbortError'));
  const timer=setTimeout(()=>stop(Error('Word conversion took too long. Split the PDF and try again.')),120000);signal?.addEventListener('abort',abort,{once:true});
  child.on('error',()=>stop(Error('Word conversion could not start')));
  child.on('message',message=>{
   if(received)return stop(Error('Invalid Word response'));received=true;
   if(!message?.ok||!(message.bytes instanceof Uint8Array)||!message.bytes.length||message.bytes.length>64*1024*1024||!Number.isInteger(message.pages)||message.pages<1||message.pages>60)return stop(Error('Use an unencrypted PDF with selectable text on every page, up to 60 pages. Scanned and blank pages are not supported in this build.'));
   result={bytes:message.bytes,extension:'docx',warnings:['Editable text with source page breaks. Images, forms, annotations and original page layout are not copied. Review reading order, spacing and tables before using the document.']};
  });
  child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error||code!==0||!result)reject(error||Error('Word conversion stopped'));else resolve(result);});
  child.send({bytes,direction},error=>{if(error)stop(Error('Word conversion could not start'));});if(signal?.aborted)abort();
 });
}
