import {fork} from 'node:child_process';import {fileURLToPath} from 'node:url';
export async function pdfToExcel(bytes,{signal}={}){
 signal?.throwIfAborted();
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>64*1024*1024)throw Error('Choose an unencrypted PDF up to 64 MB');
 return new Promise((resolve,reject)=>{
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['systemroot','windir','temp','tmp','tmpdir'].includes(key.toLowerCase())));
  const child=fork(fileURLToPath(new URL('./pdf-excel-worker.mjs',import.meta.url)),[],{serialization:'advanced',stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,execArgv:['--max-old-space-size=512'],env});
  let result,error,received=false;const stop=reason=>{error??=reason;child.kill();},abort=()=>stop(signal.reason||new DOMException('Cancelled','AbortError'));
  const timer=setTimeout(()=>stop(Error('Table extraction took too long. Split the PDF and try again.')),120000);signal?.addEventListener('abort',abort,{once:true});
  child.on('error',()=>stop(Error('Table extraction could not start')));
  child.on('message',message=>{
   if(received)return stop(Error('Invalid table response'));received=true;
   if(!message?.ok||!(message.bytes instanceof Uint8Array)||!message.bytes.length||message.bytes.length>64*1024*1024||!Number.isInteger(message.tables)||message.tables<1||message.tables>100||!Number.isInteger(message.skipped)||message.skipped<0||message.skipped>100)return stop(Error('No supported tables could be extracted. Use an unencrypted PDF with selectable text, up to 100 pages.'));
   result={bytes:message.bytes,extension:'xlsx',warnings:[`${message.tables} table(s) extracted. ${message.skipped} page(s) without a detected table were skipped. Review row and column alignment. Values remain text to preserve identifiers, dates and number formatting. Scanned tables are not recognized in this build.`]};
  });
  child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error||code!==0||!result)reject(error||Error('Table extraction stopped'));else resolve(result);});
  child.send({bytes},error=>{if(error)stop(Error('Table extraction could not start'));});if(signal?.aborted)abort();
 });
}
