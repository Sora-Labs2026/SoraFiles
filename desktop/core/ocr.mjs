import {fork} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {rasterPdf} from './pdf-raster.mjs';import {decodeStillImage} from './still-image.mjs';import {ocrOptions} from '../shared/ocr-options.mjs';
export async function recognizeDocument(input,{signal,...requested}={}){
 const options=ocrOptions(requested);signal?.throwIfAborted();
 if(!(input instanceof Uint8Array)||!input.length||input.length>256*1024*1024)throw Error('Choose a supported document');
 const pdf=Buffer.from(input.buffer,input.byteOffset,Math.min(5,input.length)).toString()==='%PDF-';
 const pages=pdf?await rasterPdf(input,{dpi:150,format:'png',maxPages:100,maxTotalPixels:100_000_000,signal}):[await decodeStillImage(input,{signal})];
 if(pages.length>100||pages.reduce((sum,page)=>sum+page.width*page.height,0)>100_000_000)throw Error('Split this document into smaller parts for OCR');
 signal?.throwIfAborted();
 return new Promise((resolve,reject)=>{
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['systemroot','windir','temp','tmp','tmpdir'].includes(key.toLowerCase())));
  const child=fork(fileURLToPath(new URL('./ocr-worker.mjs',import.meta.url)),[],{serialization:'advanced',stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,execArgv:['--max-old-space-size=512'],env});
  let result,error,received=false;const stop=reason=>{error??=reason;child.kill();},abort=()=>stop(signal.reason||new DOMException('Cancelled','AbortError'));
  const timer=setTimeout(()=>stop(Error('OCR took too long. Split the document and try again.')),600000);signal?.addEventListener('abort',abort,{once:true});
  child.on('error',()=>stop(Error('OCR could not start')));
  child.on('message',message=>{
   if(received)return stop(Error('Invalid OCR result'));received=true;
   if(!message?.ok||!(message.bytes instanceof Uint8Array)||!message.bytes.length||message.bytes.length>256*1024*1024||message.pages!==pages.length||!Number.isFinite(message.confidence)||message.confidence<0||message.confidence>100)return stop(Error('OCR could not finish. Check the document and installed language files.'));
   result={bytes:message.bytes,extension:options.format,pages:pages.length,confidence:message.confidence,warnings:[message.empty?'No text was recognized. Try a clearer scan.':'Review the recognized text before using it.',...(options.format==='pdf'?['The searchable copy contains page images and recognized text. Original forms and signatures are not retained.']:[])]};
  });
  child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error||code!==0||!result)reject(error||Error('OCR stopped before finishing'));else resolve(result);});
  child.send({pages:pages.map(({bytes})=>({bytes})),options},error=>{if(error)stop(Error('OCR could not start'));});if(signal?.aborted)abort();
 });
}
