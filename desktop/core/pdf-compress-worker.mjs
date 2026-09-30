import createQpdf from '@neslinesli93/qpdf-wasm';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
import {PDFArray,PDFDocument,PDFName,PDFNumber,PDFRawStream} from 'pdf-lib';
import sharp from 'sharp';
import {rejectPdfSignatures} from './pdf-safety.mjs';
const require=createRequire(import.meta.url);
sharp.cache(false);sharp.concurrency(1);
const name=value=>PDFName.of(value);

// Recompresses only plain 8-bit RGB or gray JPEG photos. Masks, CMYK, ICC,
// decode arrays and other encodings are left exactly as they are. A photo is
// replaced only when the new stream is at least 5% smaller.
async function recompressPhotos(document,level){
 const largestPageInches=Math.max(...document.getPages().map(page=>{const {width,height}=page.getSize();return Math.max(width,height)/72;}));
 const maxSide=Math.max(256,Math.ceil(level.dpi*largestPageInches));
 let changed=0;
 for(const [reference,object] of document.context.enumerateIndirectObjects()){
  if(!(object instanceof PDFRawStream))continue;
  const dict=object.dict;
  if(dict.get(name('Subtype'))!==name('Image'))continue;
  const filter=dict.get(name('Filter'));
  const jpeg=filter===name('DCTDecode')||(filter instanceof PDFArray&&filter.size()===1&&filter.get(0)===name('DCTDecode'));
  const colour=dict.get(name('ColorSpace')),gray=colour===name('DeviceGray'),bits=dict.get(name('BitsPerComponent'));
  if(!jpeg||!(gray||colour===name('DeviceRGB'))||!(bits instanceof PDFNumber)||bits.asNumber()!==8
   ||['ImageMask','Decode','DecodeParms','SMaskInData','Intent'].some(key=>dict.has(name(key))))continue;
  const original=object.contents;
  try{
   const settings={failOn:'warning',limitInputPixels:25_000_000};
   const metadata=await sharp(original,settings).metadata();
   if(metadata.format!=='jpeg'||metadata.channels!==(gray?1:3)||!metadata.width||!metadata.height)continue;
   const scale=Math.min(1,maxSide/Math.max(metadata.width,metadata.height));
   let image=sharp(original,settings);
   if(scale<1)image=image.resize(Math.max(1,Math.round(metadata.width*scale)),Math.max(1,Math.round(metadata.height*scale)),{kernel:'lanczos3'});
   if(gray)image=image.toColourspace('b-w');
   const {data,info}=await image.jpeg({quality:level.quality,mozjpeg:true,chromaSubsampling:'4:2:0'}).toBuffer({resolveWithObject:true});
   if(info.channels!==(gray?1:3)||data.length>=original.length*0.95)continue;
   const next=dict.clone(document.context);
   next.set(name('Width'),PDFNumber.of(info.width));next.set(name('Height'),PDFNumber.of(info.height));next.delete(name('Length'));
   document.context.assign(reference,PDFRawStream.of(next,new Uint8Array(data)));changed++;
  }catch{/* keep this photo unchanged */}
 }
 return changed;
}

process.once('message',async({bytes,level})=>{
 try{
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>64*1024*1024)throw Error();
  if(level!==null&&(!level||!Number.isInteger(level.dpi)||level.dpi<72||level.dpi>300||!Number.isInteger(level.quality)||level.quality<40||level.quality>95))throw Error();
  const source=await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false,throwOnInvalidObject:true});
  if(source.getPageCount()<1||source.getPageCount()>1000)throw Error();
  rejectPdfSignatures(source);
  let input=bytes,images=0;
  if(level){
   const working=await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false,throwOnInvalidObject:true});
   images=await recompressPhotos(working,level);
   if(images)input=await working.save({useObjectStreams:false,updateFieldAppearances:false});
  }
  const module=await createQpdf({wasmBinary:await readFile(require.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm')),noInitialRun:true,print:()=>{},printErr:()=>{}});
  module.FS.writeFile('/input.pdf',input);
  const code=module.callMain(['--object-streams=generate','--stream-data=compress','--decode-level=generalized','--recompress-flate','--compression-level=9','/input.pdf','/output.pdf']);
  // QPDF warning status is not evidence of a sound input/output; fail closed.
  if(code!==0)throw Error();
  const optimized=module.FS.readFile('/output.pdf');if(!optimized.length||optimized.length>64*1024*1024)throw Error();
  const check=await PDFDocument.load(optimized,{ignoreEncryption:false,updateMetadata:false,throwOnInvalidObject:true});
  if(check.getPageCount()!==source.getPageCount())throw Error();
  for(let i=0;i<source.getPageCount();i++){
   const before=source.getPage(i),after=check.getPage(i);
   if(JSON.stringify(before.getMediaBox())!==JSON.stringify(after.getMediaBox())||JSON.stringify(before.getCropBox())!==JSON.stringify(after.getCropBox())||before.getRotation().angle!==after.getRotation().angle)throw Error();
  }
  const unchanged=optimized.length>=bytes.length;process.send({ok:true,bytes:unchanged?bytes:optimized,unchanged,images:unchanged?0:images},()=>process.exit(0));
 }catch{process.send({ok:false},()=>process.exit(1));}
});
process.once('disconnect',()=>process.exit(1));
