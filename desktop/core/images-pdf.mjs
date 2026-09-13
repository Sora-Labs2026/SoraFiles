import {PDFDocument} from 'pdf-lib';
import {decodeImage} from './image-decode.mjs';
import {savePdfDocument} from './pdf.mjs';

// Input order is page order. Decode and orient images before computing layout,
// retain transparency, and use lossless image embedding without cropping.
export async function imagesToPdf(inputs,{paper='a4',orientation='auto',margin=24,dpi=150,signal,onProgress=()=>{}}={}) {
 if(!Array.isArray(inputs)||!inputs.length||inputs.length>256||inputs.some(b=>!(b instanceof Uint8Array))||inputs.reduce((sum,b)=>sum+b.length,0)>256*1024*1024
  ||!['a4','letter','image'].includes(paper)||!['auto','portrait','landscape'].includes(orientation)||!Number.isFinite(margin)||margin<0||margin>144||!Number.isFinite(dpi)||dpi<36||dpi>1200)throw Error('Choose valid image-to-PDF options');
 const doc=await PDFDocument.create();let totalPixels=0,totalBytes=0;
 for(const [index,input] of inputs.entries()) {
  signal?.throwIfAborted();const image=await decodeImage(input,{signal});totalPixels+=image.width*image.height;totalBytes+=image.bytes.length;
  if(totalPixels>100_000_000||totalBytes>256*1024*1024)throw Error('Split these images into smaller batches');
  let width,height;
  if(paper==='image'){width=image.width*72/dpi+2*margin;height=image.height*72/dpi+2*margin;}
  else {[width,height]=paper==='a4'?[595.2756,841.8898]:[612,792];if(orientation==='landscape'||orientation==='auto'&&image.width>image.height)[width,height]=[height,width];}
  if(width>14400||height>14400||width<3||height<3||width<=2*margin||height<=2*margin)throw Error('Choose a different page size or margin');
  const embedded=await doc.embedPng(image.bytes),scale=Math.min((width-2*margin)/image.width,(height-2*margin)/image.height),w=image.width*scale,h=image.height*scale;
  doc.addPage([width,height]).drawImage(embedded,{x:(width-w)/2,y:(height-h)/2,width:w,height:h});
  onProgress({completed:index+1,total:inputs.length,stage:'adding-images'});
 }
 return {bytes:await savePdfDocument(doc,inputs.length,signal),pages:inputs.length};
}
