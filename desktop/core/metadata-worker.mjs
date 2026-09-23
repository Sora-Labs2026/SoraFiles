import {PDFDocument,PDFDict,PDFArray,PDFRef,PDFStream,PDFName} from 'pdf-lib';
import sharp from 'sharp';
import {stripImageMeta} from '../shared/image-metadata.mjs';
import {cleanOfficeMetadata} from './metadata-office.mjs';
sharp.cache(false);sharp.concurrency(1);
const MAX=64*1024*1024;

function dictionaries(doc){
 const seen=new Set(),stack=doc.context.enumerateIndirectObjects().map(([,value])=>value),result=[];
 while(stack.length){
  const value=stack.pop();if(!value||seen.has(value))continue;seen.add(value);
  if(seen.size>250000)throw Error();
  if(value instanceof PDFStream)stack.push(value.dict);
  else if(value instanceof PDFDict){result.push(value);stack.push(...value.values());}
  else if(value instanceof PDFArray)stack.push(...value.asArray());
 }
 return result;
}
function discardUnreachable(doc){
 const refs=new Set(),seen=new Set(),stack=Object.values(doc.context.trailerInfo);
 while(stack.length){
  const value=stack.pop();if(!value||seen.has(value))continue;seen.add(value);
  if(seen.size>250000)throw Error();
  if(value instanceof PDFRef){refs.add(value.toString());stack.push(doc.context.lookup(value));}
  else if(value instanceof PDFStream)stack.push(value.dict);
  else if(value instanceof PDFDict)stack.push(...value.values());
  else if(value instanceof PDFArray)stack.push(...value.asArray());
 }
 for(const [ref] of doc.context.enumerateIndirectObjects())if(!refs.has(ref.toString()))doc.context.delete(ref);
}
function metadataOwners(doc){
 return dictionaries(doc).filter(dict=>{
  if(!dict.has(PDFName.of('Metadata')))return false;
  const target=doc.context.lookup(dict.get(PDFName.of('Metadata')));
  // Resource names are arbitrary: an image can legitimately be named
  // /Metadata. Remove metadata streams and standard page/catalog metadata
  // entries, not every dictionary entry whose name happens to match.
  return dict===doc.catalog||['/Page','/Pages'].includes(dict.get(PDFName.of('Type'))?.toString())
   ||target instanceof PDFStream&&target.dict.get(PDFName.of('Type'))===PDFName.of('Metadata');
 });
}
async function cleanPdf(bytes){
 const doc=await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false,throwOnInvalidObject:true});
 const pages=doc.getPageCount();if(pages<1||pages>1000)throw Error();
 doc.context.trailerInfo.Info=undefined;
 for(const dict of metadataOwners(doc))dict.delete(PDFName.of('Metadata'));
 // pdf-lib otherwise serializes unused objects as well. Prune only objects
 // unreachable from the remaining trailer roots, preserving shared content.
 discardUnreachable(doc);
 const output=await doc.save({useObjectStreams:true,addDefaultPage:false,updateFieldAppearances:false});if(output.length>MAX)throw Error();
 const verified=await PDFDocument.load(output,{ignoreEncryption:false,updateMetadata:false,throwOnInvalidObject:true});
 if(verified.getPageCount()!==pages||verified.context.trailerInfo.Info||metadataOwners(verified).length)throw Error();
 return {bytes:output,extension:'pdf'};
}
async function cleanImage(bytes){
 if(bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))){
  let offset=8,ended=false;
  while(offset+12<=bytes.length){const length=bytes.readUInt32BE(offset),type=bytes.subarray(offset+4,offset+8).toString('ascii');if(offset+12+length>bytes.length||type==='acTL')throw Error();offset+=12+length;if(type==='IEND'){if(length!==0||offset!==bytes.length)throw Error();ended=true;break;}}
  if(!ended)throw Error();
 }
 const options={failOn:'warning',limitInputPixels:25_000_000,limitInputChannels:4};
 const input=sharp(bytes,options).timeout({seconds:90}),info=await input.metadata();
 if(!['jpeg','png','webp'].includes(info.format)||(info.pages||1)!==1||!info.width||!info.height||info.width*info.height>25_000_000)throw Error();
 // Use the actual Web segment/chunk cleanup when no geometry or colour-space
 // conversion is needed. Decode both sides before accepting a lossless result.
 // Retain the existing conversion for orientation/profiles or unsupported layouts.
 if((!info.orientation||info.orientation===1)&&!info.icc&&info.space==='srgb'){
  const before=await sharp(bytes,options).timeout({seconds:90}).ensureAlpha().raw().toBuffer();
  try{
   const cleaned=await stripImageMeta(new Blob([bytes])),data=Buffer.from(await cleaned.blob.arrayBuffer());
   const check=sharp(data,options).timeout({seconds:90}),after=await check.metadata();
   if(data.length<=MAX&&after.width===info.width&&after.height===info.height&&after.format===info.format
    &&!after.exif&&!after.xmp&&!after.iptc&&!after.icc&&!after.orientation&&!after.comments?.length
    &&(after.pages||1)===1&&before.equals(await check.ensureAlpha().raw().toBuffer()))return {bytes:data,extension:cleaned.ext,imageMode:'lossless'};
  }catch{ /* Re-encode only after the source has decoded successfully. */ }
 }
 let output=input.autoOrient().toColourspace('srgb');
 output=info.format==='jpeg'?output.jpeg({quality:95,chromaSubsampling:'4:4:4'}):info.format==='webp'?output.webp({quality:95,effort:5}):output.png({compressionLevel:9});
 const data=await output.toBuffer();if(data.length>MAX)throw Error();
 const check=sharp(data,options).timeout({seconds:90}),after=await check.metadata();
 if(after.exif||after.xmp||after.iptc||after.icc||after.orientation||after.comments?.length)throw Error();
 await check.raw().toBuffer();
 const rotated=[5,6,7,8].includes(info.orientation);
 if(after.width!==(rotated?info.height:info.width)||after.height!==(rotated?info.width:info.height))throw Error();
 return {bytes:data,extension:info.format==='jpeg'?'jpg':info.format,imageMode:'reencoded'};
}
process.once('message',async({bytes})=>{
 try{
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>MAX)throw Error();const input=Buffer.from(bytes);
  const pdf=input.subarray(0,5).equals(Buffer.from('%PDF-'));
  const image=input.subarray(0,3).equals(Buffer.from([255,216,255]))||input.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))||(input.subarray(0,4).toString()==='RIFF'&&input.subarray(8,12).toString()==='WEBP');
  const office=input.subarray(0,4).equals(Buffer.from('504b0304','hex'));
  if(!pdf&&!image&&!office)throw Error();
  const result=pdf?await cleanPdf(input):office?cleanOfficeMetadata(input):await cleanImage(input);
  process.send({ok:true,...result},()=>process.exit(0));
 }catch{process.send({ok:false},()=>process.exit(1));}
});
process.once('disconnect',()=>process.exit(1));
