import {createRequire} from 'node:module';import {dirname,join} from 'node:path';
import {createCanvas} from '@napi-rs/canvas';import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {PDFDocument,PDFName,PDFNumber} from 'pdf-lib';
const require=createRequire(import.meta.url),assets=dirname(require.resolve('pdfjs-dist/package.json'));
const assetFolder=name=>join(assets,name).replaceAll('\\','/')+'/';
export async function rasterPdf(input,{dpi=150,format='jpeg',quality=95,signal}={}){
 if(!(input instanceof Uint8Array)||input.length<1||input.length>256*1024*1024||!Number.isInteger(dpi)||dpi<72||dpi>300
  ||!['jpeg','png'].includes(format)||!Number.isInteger(quality)||quality<40||quality>100)throw Error('Choose valid PDF image settings');
 signal?.throwIfAborted();
 // PDF.js can silently discard an oversized image operator. Reject declared
 // image resources before rendering, including images inside nested forms.
 const preflight=await PDFDocument.load(input,{updateMetadata:false});
 for(const [,object] of preflight.context.enumerateIndirectObjects()){
  if(object.dict?.get(PDFName.of('Subtype'))?.toString()!=='/Image')continue;
  const width=object.dict.lookup(PDFName.of('Width'),PDFNumber).asNumber(),height=object.dict.lookup(PDFName.of('Height'),PDFNumber).asNumber();
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>25_000_000)throw Error('Embedded image exceeds maximum allowed size');
 }
 const task=getDocument({data:input.slice(),verbosity:1,isEvalSupported:false,useSystemFonts:false,disableFontFace:true,useWorkerFetch:false,
  cMapUrl:assetFolder('cmaps'),cMapPacked:true,standardFontDataUrl:assetFolder('standard_fonts'),wasmUrl:assetFolder('wasm'),maxImageSize:25_000_000,stopAtErrors:true});
 let rendering;const cancel=()=>{rendering?.cancel();void task.destroy();};signal?.addEventListener('abort',cancel,{once:true});
 try{
  const doc=await task.promise;if(doc.numPages<1||doc.numPages>1000)throw Error('Choose a PDF with up to 1000 pages');
  const results=[];let total=0;
  for(let index=1;index<=doc.numPages;index++){
   signal?.throwIfAborted();const page=await doc.getPage(index),viewport=page.getViewport({scale:dpi/72});
   const width=Math.ceil(viewport.width),height=Math.ceil(viewport.height);
   if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>25_000_000)throw Error('Reduce the resolution for this page');
   const canvas=createCanvas(width,height);
   try{
    rendering=page.render({canvasContext:canvas.getContext('2d'),viewport,background:'rgb(255,255,255)'});await rendering.promise;rendering=null;signal?.throwIfAborted();
    const bytes=format==='png'?await canvas.encode('png'):await canvas.encode('jpeg',quality);total+=bytes.length;
    if(total>256*1024*1024)throw Error('Split this PDF or reduce image resolution');
    results.push({bytes,width,height,page:index,extension:format==='jpeg'?'jpg':'png'});
   }finally{canvas.width=1;canvas.height=1;page.cleanup();}
  }
  return results;
 }finally{signal?.removeEventListener('abort',cancel);await task.destroy();}
}
