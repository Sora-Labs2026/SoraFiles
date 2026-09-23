import sharp from 'sharp';
import {imageOptions} from './image-options.mjs';
import {applyManualAdjustments,normalizeManualAdjustments,hasManualAdjustments} from '../shared/image-adjustments.mjs';
// This process has one job and exits. Disable the reusable image cache because
// retaining pixels brings no benefit here. SVG/PDF and animated input are refused.
sharp.cache(false);sharp.concurrency(1);
process.once('message',async message=>{
 try{
  const input=message?.bytes,options=imageOptions(message?.options),decode=options.action==='decode';
  if(!(input instanceof Uint8Array)||!input.length||input.length>64*1024*1024)throw Error();
  const bytes=Buffer.from(input.buffer,input.byteOffset,input.byteLength);
  const png=bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
  const jpeg=bytes.subarray(0,3).equals(Buffer.from('ffd8ff','hex')),webp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
  const gif=['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString()),tiff=['49492a00','4d4d002a'].includes(bytes.subarray(0,4).toString('hex'));
  if(decode?!png&&!jpeg:!png&&!jpeg&&!webp&&!gif&&!tiff)throw Error();
  if(png){let at=8,ended=false;while(at+12<=bytes.length){const length=bytes.readUInt32BE(at),type=bytes.subarray(at+4,at+8).toString('ascii');if(at+12+length>bytes.length||type==='acTL')throw Error();at+=12+length;if(type==='IEND'){if(length!==0||at!==bytes.length)throw Error();ended=true;break;}}if(!ended)throw Error();}
  const settings={failOn:'warning',limitInputPixels:25_000_000,limitInputChannels:4};
  let image=sharp(input,{...settings,page:options.page||0}).timeout({seconds:90});
  const metadata=await image.metadata();
  if(!(decode?['jpeg','png']:['jpeg','png','webp','gif','tiff']).includes(metadata.format)||metadata.width*metadata.height>25_000_000)throw Error();
  if((metadata.pages||1)>1&&(decode||options.page===undefined)||options.page!==undefined&&options.page>=(metadata.pages||1))throw Error();
  if(options.action==='compress'&&!['jpeg','png','webp'].includes(metadata.format))throw Error();
  image=image.autoOrient().toColourspace('srgb');
  if(options.crop){const c=options.crop,sw=metadata.autoOrient?.width||metadata.width,sh=metadata.autoOrient?.height||metadata.height;if(c.left+c.width>sw||c.top+c.height>sh)throw Error();image=image.extract(c);}
  if(options.rotation)image=image.rotate(options.rotation);
  if(options.flip)image=image.flip();if(options.flop)image=image.flop();
  if(options.width||options.height)image=image.resize({width:options.width,height:options.height,fit:options.fit,kernel:'lanczos3',withoutEnlargement:!options.allowEnlargement,background:options.background});
  if(options.action==='edit'&&hasManualAdjustments(normalizeManualAdjustments(options.adjustments))){
   const {ImageData}=await import('@napi-rs/canvas');globalThis.ImageData=ImageData;
   const {data,info}=await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});
   const adjusted=applyManualAdjustments(new ImageData(new Uint8ClampedArray(data),info.width,info.height),options.adjustments,false);
   image=sharp(adjusted.data,{raw:{width:info.width,height:info.height,channels:4}}).timeout({seconds:90});
  }
  const format=options.action==='compress'?metadata.format:decode?'png':options.format;
  if(format==='jpeg')image=image.flatten({background:options.background}).jpeg({quality:options.quality,chromaSubsampling:'4:4:4',mozjpeg:true});
  else if(format==='webp')image=image.webp({quality:options.quality,effort:5});
  else image=image.png({compressionLevel:9,adaptiveFiltering:true});
  let {data,info}=await image.toBuffer({resolveWithObject:true});
  if(data.length>64*1024*1024)throw Error();
  if(info.width*info.height>25_000_000)throw Error();
  let unchanged=false;
  if(options.action==='compress'&&data.length>=bytes.length){data=bytes;info={width:metadata.autoOrient?.width||metadata.width,height:metadata.autoOrient?.height||metadata.height};unchanged=true;}
  // Force a complete second decode of the produced file before publishing it.
  await sharp(data,settings).raw().toBuffer();
  process.send({ok:true,bytes:data,width:info.width,height:info.height,format,unchanged},()=>process.exit(0));
 }catch{process.send({ok:false},()=>process.exit(1));}
});
process.once('disconnect',()=>process.exit(1));
