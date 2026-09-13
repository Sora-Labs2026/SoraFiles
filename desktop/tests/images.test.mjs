import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';import {createCanvas,loadImage} from '@napi-rs/canvas';
import {processImage} from '../core/images.mjs';
async function pixels(bytes){const img=await loadImage(bytes),canvas=createCanvas(img.width,img.height),ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return {width:img.width,height:img.height,pixel:(x,y)=>[...ctx.getImageData(x,y,1,1).data],data:ctx.getImageData(0,0,img.width,img.height).data};}
async function source(){const raw=Buffer.alloc(120*80*4);for(let y=0;y<80;y++)for(let x=0;x<120;x++){const i=(y*120+x)*4;raw[i]=x<60?255:0;raw[i+2]=x<60?0:255;raw[i+3]=y<40?255:128;}return sharp(raw,{raw:{width:120,height:80,channels:4}}).png().toBuffer();}
test('conversion preserves transparency and explicitly flattens JPEG on the chosen background',async()=>{
 const input=await source();
 for(const format of ['png','webp','jpeg']){const output=await processImage(input,{action:'convert',format,quality:100,background:'#00ff00'}),view=await pixels(output.bytes);assert.equal(view.width,120);assert.equal(view.height,80);
  const p=view.pixel(20,60);if(format==='jpeg'){assert.ok(p[0]>120&&p[0]<138&&p[1]>118&&p[1]<138&&p[2]<10);assert.equal(p[3],255);}else{assert.ok(p[0]>245&&p[2]<10);assert.equal(p[3],128);}
 }
});
test('resize preserves aspect ratio, prevents accidental enlargement, and implements contain and cover',async()=>{
 const input=await source();
 for(const [options,w,h] of [[{width:60},60,40],[{width:240},120,80],[{width:240,allowEnlargement:true},240,160],[{width:60,height:60,fit:'contain'},60,60],[{width:60,height:60,fit:'cover'},60,60]]){
  const result=await processImage(input,{action:'resize',...options}),view=await pixels(result.bytes);assert.equal(view.width,w);assert.equal(view.height,h);
  if(options.fit==='contain')assert.deepEqual(view.pixel(30,2),[255,255,255,255]);
 }
});
test('editor crop and quarter-turn use oriented pixels and reject out-of-bounds crops',async()=>{
 const result=await processImage(await source(),{action:'edit',crop:{left:0,top:0,width:60,height:40},rotation:90}),view=await pixels(result.bytes);
 assert.equal(view.width,40);assert.equal(view.height,60);assert.deepEqual(view.pixel(20,30),[255,0,0,255]);
 await assert.rejects(processImage(await source(),{action:'edit',crop:{left:119,top:0,width:2,height:10}}));
 const jpeg=await sharp({create:{width:120,height:80,channels:3,background:'#ff0000'}}).withMetadata({orientation:6}).jpeg().toBuffer();
 const oriented=await processImage(jpeg,{action:'edit',crop:{left:0,top:80,width:40,height:40}});assert.equal(oriented.width,40);assert.equal(oriented.height,40);
});
test('compression never grows a file and keeps dimensions; lossless PNG retains every pixel',async()=>{
 const original=await source(),input=await sharp(original).png({compressionLevel:0}).toBuffer(),result=await processImage(input,{action:'compress'});
 assert.ok(result.bytes.length<input.length);assert.deepEqual((await pixels(result.bytes)).data,(await pixels(original)).data);
 const tiny=await sharp({create:{width:1,height:1,channels:3,background:'#000000'}}).jpeg({quality:40}).toBuffer(),second=await processImage(tiny,{action:'compress',quality:100});assert.ok(second.bytes.length<=tiny.length);
 if(second.unchanged)assert.deepEqual(Buffer.from(second.bytes),tiny);
});
test('invalid resource requests and ambiguous animated input are refused',async()=>{
 const input=await source();for(const options of [{action:'resize',width:16000,height:16000},{action:'resize',width:0},{action:'convert',width:10},{action:'edit',rotation:30},{action:'convert',format:'svg'},{action:'resize',width:20,command:'execute'}])await assert.rejects(processImage(input,options));
 const frames=Buffer.alloc(20*40*3);frames.fill(255,0,20*20*3);
 const gif=await sharp(frames,{raw:{width:20,height:40,channels:3,pageHeight:20}}).gif({delay:[100,100]}).toBuffer();
 assert.equal((await sharp(gif).metadata()).pages,2);await assert.rejects(processImage(gif,{action:'convert'}));const chosen=await processImage(gif,{action:'convert',page:1});assert.equal(chosen.height,20);await assert.rejects(processImage(gif,{action:'convert',page:2}));
});
