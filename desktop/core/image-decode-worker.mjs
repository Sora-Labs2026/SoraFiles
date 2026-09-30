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
  const sourceWidth=metadata.autoOrient?.width||metadata.width,sourceHeight=metadata.autoOrient?.height||metadata.height;
  if(options.crop){const c=options.crop;if(c.left+c.width>sourceWidth||c.top+c.height>sourceHeight)throw Error();image=image.extract(c);}
  if(options.rotation)image=image.rotate(options.rotation);
  if(options.flip)image=image.flip();if(options.flop)image=image.flop();
  let {width,height}=options;
  if(options.percent){const baseWidth=options.crop?.width??sourceWidth,baseHeight=options.crop?.height??sourceHeight;width=Math.max(1,Math.round(baseWidth*options.percent/100));height=Math.max(1,Math.round(baseHeight*options.percent/100));if(width>16000||height>16000||width*height>25_000_000)throw Error();}
  const padding=options.background==='transparent'?{r:0,g:0,b:0,alpha:0}:options.background;
  if(width||height)image=image.resize({width,height,fit:options.fit,kernel:'lanczos3',withoutEnlargement:!options.allowEnlargement&&!options.percent,background:padding});
  if(options.action==='edit'&&hasManualAdjustments(normalizeManualAdjustments(options.adjustments))){
   const {ImageData}=await import('@napi-rs/canvas');globalThis.ImageData=ImageData;
   const {data,info}=await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});
   const adjusted=applyManualAdjustments(new ImageData(new Uint8ClampedArray(data),info.width,info.height),options.adjustments,false);
   image=sharp(adjusted.data,{raw:{width:info.width,height:info.height,channels:4}}).timeout({seconds:90});
  }
  const format=options.action==='compress'?metadata.format:decode?'png':options.format;
  // Compression below quality 90 uses standard 4:2:0 chroma (visually close for
  // photos, much smaller) and a reduced PNG palette; 90+ stays full-chroma/lossless.
  const shrink=options.action==='compress'&&options.quality<90;let encoded=null;
  if(format==='jpeg')image=image.flatten({background:options.background==='transparent'?'#ffffff':options.background}).jpeg({quality:options.quality,chromaSubsampling:shrink?'4:2:0':'4:4:4',mozjpeg:true});
  else if(format==='webp')image=image.webp({quality:options.quality,effort:options.action==='compress'?6:5});
  else if(shrink){
   // Palettes shrink screenshots and graphics dramatically but add dithering noise
   // to smooth photos, where lossless wins. Encode both and keep the smaller.
   const [palette,lossless]=await Promise.all([image.clone().png({palette:true,quality:options.quality,effort:10,compressionLevel:9}).toBuffer({resolveWithObject:true}),image.clone().png({compressionLevel:9,adaptiveFiltering:true}).toBuffer({resolveWithObject:true})]);
   encoded=palette.data.length<lossless.data.length?palette:lossless;
  }
  else image=image.png({compressionLevel:9,adaptiveFiltering:true});
  let {data,info}=encoded||await image.toBuffer({resolveWithObject:true});
  if(data.length>64*1024*1024)throw Error();
  if(info.width*info.height>25_000_000)throw Error();
  let unchanged=false;
  if(options.action==='compress'&&data.length>=bytes.length){data=bytes;info={width:metadata.autoOrient?.width||metadata.width,height:metadata.autoOrient?.height||metadata.height};unchanged=true;}
  // Force a complete second decode of the produced file before publishing it.
  await sharp(data,settings).raw().toBuffer();
  process.send({ok:true,bytes:data,width:info.width,height:info.height,sourceWidth,sourceHeight,format,unchanged},()=>process.exit(0));
 }catch{process.send({ok:false},()=>process.exit(1));}
});
process.once('disconnect',()=>process.exit(1));
