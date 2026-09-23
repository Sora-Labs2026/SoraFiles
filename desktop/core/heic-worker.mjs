import decoderFactory from '../shared/heif-decoder.cjs';import sharp from 'sharp';
process.once('message',async({bytes,quality})=>{
 let lib,decoder,images;
 try{
  if(!(bytes instanceof Uint8Array)||bytes.length<16||bytes.length>64*1024*1024||!Number.isInteger(quality)||quality<40||quality>100)throw Error();
  const input=Buffer.from(bytes);const size=input.readUInt32BE(0);
  if(input.toString('ascii',4,8)!=='ftyp'||size<16||size>4096||size>input.length||size%4!==0)throw Error();
  const brands=[input.toString('ascii',8,12)];for(let offset=16;offset<size;offset+=4)brands.push(input.toString('ascii',offset,offset+4));
  if(!brands.some(brand=>['heic','heix'].includes(brand))||brands.some(brand=>['msf1','avis'].includes(brand)))throw Error();
  // A still-image collection may declare hevc as a compatible brand. Reject
  // timed media by its movie box rather than misclassifying those collections.
  for(let at=size;at<input.length;){
   if(at+8>input.length)throw Error();const type=input.toString('ascii',at+4,at+8);let length=input.readUInt32BE(at),header=8;
   if(type==='moov')throw Error();if(length===1){if(at+16>input.length)throw Error();const wide=input.readBigUInt64BE(at+8);if(wide>BigInt(input.length))throw Error();length=Number(wide);header=16;}
   if(length===0)length=input.length-at;if(length<header||at+length>input.length)throw Error();at+=length;
  }
  lib=decoderFactory({print:()=>{},printErr:()=>{}});decoder=new lib.HeifDecoder();images=decoder.decode(input);
  if(!images.length||images.length>32)throw Error();
  const primary=images.filter(image=>image.is_primary());if(primary.length!==1)throw Error();
  const image=primary[0],width=image.get_width(),height=image.get_height();
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>25_000_000)throw Error();
  const raw={width,height,data:new Uint8ClampedArray(width*height*4)};
  const pixels=await new Promise((resolve,reject)=>image.display(raw,data=>data?resolve(data):reject(Error())));
  sharp.cache(false);sharp.concurrency(1);
  const output=await sharp(Buffer.from(pixels.data.buffer,pixels.data.byteOffset,pixels.data.byteLength),{raw:{width,height,channels:4},limitInputPixels:25_000_000})
   .flatten({background:'#ffffff'}).jpeg({quality,chromaSubsampling:'4:4:4'}).toBuffer();
  if(!output.length||output.length>64*1024*1024)throw Error();
  const decoded=await sharp(output,{failOn:'warning',limitInputPixels:25_000_000}).raw().toBuffer({resolveWithObject:true});
  if(decoded.info.width!==width||decoded.info.height!==height)throw Error();
  const extra=images.length-1;for(const image of images)image.free();images=null;lib.heif_context_free(decoder.decoder);decoder=null;
  process.send({ok:true,bytes:output,width,height,extra},()=>process.exit(0));
 }catch{if(images)for(const image of images)image.free();if(decoder?.decoder)lib.heif_context_free(decoder.decoder);process.send({ok:false},()=>process.exit(1));}
});
process.once('disconnect',()=>process.exit(1));
