import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';import {createCanvas} from '@napi-rs/canvas';
import {imagesToPdf} from '../core/images-pdf.mjs';import {decodeImage} from '../core/image-decode.mjs';
async function inspect(bytes,run){const task=getDocument({data:bytes.slice(),isEvalSupported:false});try{await run(await task.promise);}finally{await task.destroy();}}
test('images become ordered PDF pages with corrected camera orientation and independently rendered colours',async()=>{
 const pixels=Buffer.alloc(60*30*3);for(let y=0;y<30;y++)for(let x=0;x<60;x++)pixels[(y*60+x)*3+(x<30?0:2)]=255;
 const jpeg=await sharp(pixels,{raw:{width:60,height:30,channels:3}}).withMetadata({orientation:6}).jpeg({quality:100,chromaSubsampling:'4:4:4'}).toBuffer();
 const png=await sharp({create:{width:60,height:30,channels:4,background:{r:0,g:255,b:0,alpha:.5}}}).png().toBuffer();
 const result=await imagesToPdf([jpeg,png],{paper:'image',dpi:72,margin:0});
 await inspect(result.bytes,async doc=>{assert.equal(doc.numPages,2);
  const first=await doc.getPage(1),v=first.getViewport({scale:1});assert.equal(v.width,30);assert.equal(v.height,60);
  const canvas=createCanvas(30,60),ctx=canvas.getContext('2d');await first.render({canvasContext:ctx,viewport:v}).promise;
  const top=[...ctx.getImageData(15,10,1,1).data],bottom=[...ctx.getImageData(15,50,1,1).data];assert.ok(top[0]>240&&top[2]<15);assert.ok(bottom[2]>240&&bottom[0]<15);
  const second=await doc.getPage(2),v2=second.getViewport({scale:1});assert.equal(v2.width,60);assert.equal(v2.height,30);
  const c2=createCanvas(60,30),ctx2=c2.getContext('2d');await second.render({canvasContext:ctx2,viewport:v2}).promise;const alpha=[...ctx2.getImageData(30,15,1,1).data];assert.ok(alpha[0]>=126&&alpha[0]<=129&&alpha[1]===255&&alpha[2]>=126&&alpha[2]<=129);
 });
});
test('image layout fits within paper margins and honours explicit orientation',async()=>{
 const image=await sharp({create:{width:40,height:20,channels:3,background:'#ff0000'}}).png().toBuffer();
 const result=await imagesToPdf([image],{paper:'letter',orientation:'portrait',margin:50});
 await inspect(result.bytes,async doc=>{const page=await doc.getPage(1),viewport=page.getViewport({scale:.5});assert.equal(viewport.width,306);assert.equal(viewport.height,396);const canvas=createCanvas(306,396),ctx=canvas.getContext('2d');await page.render({canvasContext:ctx,viewport}).promise;assert.deepEqual([...ctx.getImageData(20,198,1,1).data],[255,255,255,255]);assert.deepEqual([...ctx.getImageData(30,198,1,1).data],[255,0,0,255]);});
});
test('decoder rejects malformed files, non-image content and animation; cancellation ends the decoder',async()=>{
 const png=await sharp({create:{width:20,height:20,channels:3,background:'#ffffff'}}).png().toBuffer();
 const actl=Buffer.alloc(20);actl.writeUInt32BE(8,0);actl.write('acTL',4);
 for(const bytes of [png.subarray(0,png.length-5),Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),Buffer.concat([png.subarray(0,33),actl,png.subarray(33)])])await assert.rejects(decodeImage(bytes));
 const controller=new AbortController(),pending=decodeImage(png,{signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});
 await assert.rejects(imagesToPdf([png],{dpi:0}));await assert.rejects(imagesToPdf([]));
});
