import sharp from 'sharp';
import {ImageData} from '@napi-rs/canvas';
import {PDFDocument} from 'pdf-lib';
import {decodeStillImage} from './still-image.mjs';
import {applyScanFilter} from '../shared/scan-filters.mjs';
globalThis.ImageData=ImageData;
process.once('message',async({inputs,options})=>{
 try{
  if(!Array.isArray(inputs)||!inputs.length||inputs.length>20||inputs.some(bytes=>!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>64*1024*1024)||inputs.reduce((sum,b)=>sum+b.length,0)>256*1024*1024)throw Error();
  const {filter,rotation,paper}=options;
  if(!['original','enhanced','color','grayscale','bw','contrast','receipt'].includes(filter)||![0,90,180,270].includes(rotation)||!['a4','letter','image'].includes(paper))throw Error();
  const doc=await PDFDocument.create();let pixels=0,encoded=0;
  for(const input of inputs){
   const decoded=await decodeStillImage(input);
   // The existing filter's summed-area table uses uint32. At 12 MP its
   // maximum sum stays below 2^32, and memory remains bounded per page.
   if(decoded.width*decoded.height>12_000_000)throw Error();
   pixels+=decoded.width*decoded.height;if(pixels>60_000_000)throw Error();
   const raw=await sharp(decoded.bytes).flatten({background:'#ffffff'}).ensureAlpha().raw().toBuffer();
   const filtered=applyScanFilter(new ImageData(new Uint8ClampedArray(raw),decoded.width,decoded.height),filter);
   const {data,info}=await sharp(filtered.data,{raw:{width:decoded.width,height:decoded.height,channels:4}}).rotate(rotation).png().toBuffer({resolveWithObject:true});
   encoded+=data.length;if(encoded>256*1024*1024)throw Error();
   const image=await doc.embedPng(data);let width,height;
   if(paper==='image'){width=info.width*72/150;height=info.height*72/150;}
   else [width,height]=paper==='a4'?[595.2756,841.8898]:[612,792];
   if(paper!=='image'&&info.width>info.height)[width,height]=[height,width];
   if(width<3||height<3||width>14400||height>14400)throw Error();
   const margin=paper==='image'?0:24,scale=Math.min((width-2*margin)/info.width,(height-2*margin)/info.height),w=info.width*scale,h=info.height*scale;
   doc.addPage([width,height]).drawImage(image,{x:(width-w)/2,y:(height-h)/2,width:w,height:h});
  }
  const bytes=await doc.save({useObjectStreams:true,addDefaultPage:false});
  if(!bytes.length||bytes.length>256*1024*1024)throw Error();
  const check=await PDFDocument.load(bytes,{throwOnInvalidObject:true,updateMetadata:false});if(check.getPageCount()!==inputs.length)throw Error();
  process.send({ok:true,bytes,pages:inputs.length},()=>process.exit(0));
 }catch{process.send({ok:false},()=>process.exit(1));}
});
process.once('disconnect',()=>process.exit(1));
