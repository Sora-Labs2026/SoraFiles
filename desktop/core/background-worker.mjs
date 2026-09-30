import sharp from 'sharp';import * as ort from 'onnxruntime-web';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {backgroundModel} from '../shared/background-model.mjs';import {decodeStillImage} from './still-image.mjs';
import {createCanvas,loadImage,ImageData} from '@napi-rs/canvas';
process.once('message',async({bytes})=>{
 let session;
 try{
  const source=await decodeStillImage(bytes);if(source.width*source.height>12_000_000)throw Error();
  let model;
  for(const location of ['../../assets/background/','../../.artifacts/desktop-background-assets/']){
   try{model=await readFile(new URL(backgroundModel.file,new URL(location,import.meta.url)));break;}catch{}
  }
  if(!model||model.length!==backgroundModel.bytes||createHash('sha256').update(model).digest('hex')!==backgroundModel.sha256)throw Error();
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
  session=await ort.InferenceSession.create(model,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  if(session.inputNames.length!==1||session.inputNames[0]!=='input'||session.outputNames.length!==1||session.outputNames[0]!=='output')throw Error();
  const size=1024,scale=Math.min(size/source.width,size/source.height),width=Math.max(1,Math.round(source.width*scale)),height=Math.max(1,Math.round(source.height*scale)),left=Math.floor((size-width)/2),top=Math.floor((size-height)/2);
  // Match Web Canvas letterboxing. Native linear downsampling changes the
  // model input around fine edges; the browser uses Canvas image sampling.
  const inference=createCanvas(size,size),context=inference.getContext('2d');
  context.fillStyle='#fff';context.fillRect(0,0,size,size);context.drawImage(await loadImage(source.bytes),left,top,width,height);
  const square=context.getImageData(0,0,size,size).data;
  const data=new Float32Array(3*size*size);for(let i=0;i<size*size;i++)for(let c=0;c<3;c++)data[c*size*size+i]=(square[4*i+c]-128)/256;
  const result=await session.run({input:new ort.Tensor('float32',data,[1,3,size,size])});
  const output=result.output;if(output.type!=='float32'||output.dims.join(',')!=='1,1,1024,1024'||output.data.length!==size*size)throw Error();
  const mask=new Uint8ClampedArray(size*size*4);let visible=false,removed=false;
  for(let i=0;i<size*size;i++){const value=output.data[i];if(!Number.isFinite(value)||value<-.01||value>1.01)throw Error();mask[4*i]=mask[4*i+1]=mask[4*i+2]=255;mask[4*i+3]=Math.floor(Math.max(0,Math.min(1,value))*255);}
  context.putImageData(new ImageData(mask,size,size),0,0);
  const mapped=createCanvas(source.width,source.height),mappedContext=mapped.getContext('2d');
  mappedContext.imageSmoothingEnabled=true;mappedContext.imageSmoothingQuality='high';
  mappedContext.drawImage(inference,left,top,width,height,0,0,source.width,source.height);
  const alpha=mappedContext.getImageData(0,0,source.width,source.height).data;
  const original=await sharp(source.bytes).ensureAlpha().raw().toBuffer(),raw=Buffer.from(original);
  for(let at=3;at<alpha.length;at+=4){raw[at]=Math.round(original[at]*alpha[at]/255);visible||=raw[at]>16;removed||=original[at]-raw[at]>16;}
  if(!visible||!removed)throw Error();
  const encoded=await sharp(raw,{raw:{width:source.width,height:source.height,channels:4}}).png().toBuffer();if(!encoded.length||encoded.length>64*1024*1024)throw Error();
  const decoded=await sharp(encoded,{failOn:'warning',limitInputPixels:12_000_000}).ensureAlpha().raw().toBuffer();if(!decoded.equals(raw))throw Error();
  await session.release();session=null;process.send({ok:true,bytes:encoded,width:source.width,height:source.height},()=>process.exit(0));
 }catch{if(session)await session.release().catch(()=>{});process.send({ok:false},()=>process.exit(1));}
});
process.once('disconnect',()=>process.exit(1));
