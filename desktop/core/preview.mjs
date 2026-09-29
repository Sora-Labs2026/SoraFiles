import {PDFDocument} from 'pdf-lib';
import {readLocalInput} from './input.mjs';
import {signatureFormat} from './classify.mjs';
import {runImageProcess} from './image-decode.mjs';
import {heicToJpg} from './heic.mjs';
import {rasterPdf} from './pdf-raster.mjs';

// On-screen previews only: small WebP/JPEG data URLs, never written to disk.
// Untrusted decoding stays in the existing isolated image and PDF workers.
export const PREVIEW_LIMITS=Object.freeze({files:24,pdfPages:100,budget:3_000_000,singleEdge:1600,gridEdge:360,thumbDpi:24});
const dataUrl=(bytes,mime)=>`data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
const IMAGE_FORMATS=new Set(['JPG','PNG','WebP','GIF','TIFF','HEIC','HEIF']);

async function imagePreview(bytes,format,edge,signal){
 const source=['HEIC','HEIF'].includes(format)?(await heicToJpg(bytes,{quality:85,signal})).bytes:bytes;
 const result=await runImageProcess(source,{action:'resize',format:'webp',quality:80,width:edge,height:edge,fit:'inside'},{signal});
 return {kind:'image',src:dataUrl(result.bytes,'image/webp'),width:result.width,height:result.height,sourceWidth:result.sourceWidth,sourceHeight:result.sourceHeight};
}

async function pdfPreview(bytes,pageLimit,budget,signal){
 const pages=(await PDFDocument.load(bytes,{updateMetadata:false})).getPageCount();
 const count=Math.min(pages,pageLimit);
 const rendered=await rasterPdf(bytes,{dpi:PREVIEW_LIMITS.thumbDpi,format:'jpeg',quality:70,selected:Array.from({length:count},(_,index)=>index),maxPages:1000,signal});
 const thumbs=[];let used=0;
 for(const page of rendered){const src=dataUrl(page.bytes,'image/jpeg');if(used+src.length>budget)break;used+=src.length;thumbs.push({page:page.page,src,width:page.width,height:page.height});}
 return {kind:'pdf',pages,thumbs};
}

export async function previewFile(path,{single=true,budget=PREVIEW_LIMITS.budget,signal}={}){
 const bytes=await readLocalInput(path,{signal,maxBytes:256*1024*1024});
 const format=signatureFormat(Buffer.from(bytes.buffer,bytes.byteOffset,Math.min(bytes.byteLength,4096)));
 if(format==='PDF')return pdfPreview(bytes,single?PREVIEW_LIMITS.pdfPages:1,budget,signal);
 if(IMAGE_FORMATS.has(format)&&bytes.byteLength<=64*1024*1024)return imagePreview(bytes,format,single?PREVIEW_LIMITS.singleEdge:PREVIEW_LIMITS.gridEdge,signal);
 return null;
}

const size=preview=>(preview.src?.length||0)+(preview.thumbs||[]).reduce((sum,thumb)=>sum+thumb.src.length,0);

export async function previewSelection(paths,{signal}={}){
 if(!Array.isArray(paths)||!paths.length||paths.length>256||paths.some(path=>typeof path!=='string'))throw Error('Choose files first');
 const single=paths.length===1,previews=[];let used=0;
 for(const [index,path] of paths.slice(0,PREVIEW_LIMITS.files).entries()){
  signal?.throwIfAborted();
  if(used>=PREVIEW_LIMITS.budget)break;
  try{
   const preview=await previewFile(path,{single,budget:PREVIEW_LIMITS.budget-used,signal});
   if(!preview||size(preview)>PREVIEW_LIMITS.budget-used)continue;
   used+=size(preview);previews.push({index,...preview});
  }catch(error){if(signal?.aborted)throw error;}
 }
 return {previews};
}
