import test from 'node:test';import assert from 'node:assert/strict';
import {PDFDocument,degrees,StandardFonts} from 'pdf-lib';
import {getDocument,Util} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';import sharp from 'sharp';
import {watermarkPdf,signPdf} from '../core/pdf-overlays.mjs';

async function source(){const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);for(const angle of [0,90,180,270]){const page=doc.addPage([500,700]);page.setCropBox(20,30,450,630);page.setRotation(degrees(angle));page.drawText('Original content',{x:40,y:50,font,size:12});}return doc.save();}
async function inspect(bytes,run){const task=getDocument({data:bytes.slice(),useSystemFonts:true,isEvalSupported:false});try{await run(await task.promise);}finally{await task.destroy();}}
test('watermarks preserve existing text and appear at the requested visual angle on rotated, cropped pages',async()=>{
 for(const angle of [0,45,-45,90]){
  const result=await watermarkPdf(await source(),{text:'CONFIDENTIAL',angle,size:30,selected:[0,1,2,3]});
  await inspect(result.bytes,async doc=>{assert.equal(doc.numPages,4);for(let i=1;i<=4;i++){
   const page=await doc.getPage(i),view=page.getViewport({scale:1}),content=await page.getTextContent();
   assert.ok(content.items.some(item=>item.str==='Original content'));
   const text=content.items.find(item=>item.str==='CONFIDENTIAL');assert.ok(text);
   const transform=Util.transform(view.transform,text.transform),observed=Math.atan2(-transform[1],transform[0])*180/Math.PI;
   assert.ok(Math.abs(observed-angle)<.01,`${i}: ${observed} vs ${angle}`);
   const centerX=transform[4]+text.width/2*Math.cos(angle*Math.PI/180),centerY=transform[5]-text.width/2*Math.sin(angle*Math.PI/180);
   assert.ok(Math.abs(centerX-view.width/2)<20&&Math.abs(centerY-view.height/2)<20);
  }});
 }
});
test('visible signatures render in the selected preview rectangle without mirroring or changing other pages',async()=>{
 const pixels=Buffer.alloc(80*40*3);for(let y=0;y<40;y++)for(let x=0;x<80;x++)pixels[(y*80+x)*3+(x<40?0:2)]=255;
 const image=await sharp(pixels,{raw:{width:80,height:40,channels:3}}).png().toBuffer();
 const result=await signPdf(await source(),image,{placements:[0,1,2,3].map(pageIndex=>({pageIndex,x:.1,y:.15,width:.4,height:.2}))});
 await inspect(result.bytes,async doc=>{for(let i=1;i<=4;i++){
  const page=await doc.getPage(i),viewport=page.getViewport({scale:1}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),context=canvas.getContext('2d');
  await page.render({canvasContext:context,viewport}).promise;
  const w=Math.min(viewport.width*.4,viewport.height*.4),cx=viewport.width*.3,cy=viewport.height*.25;
  const pixel=(x,y)=>[...context.getImageData(Math.round(x),Math.round(y),1,1).data];
  assert.deepEqual(pixel(cx-w*.25,cy),[255,0,0,255],`red side ${i}`);assert.deepEqual(pixel(cx+w*.25,cy),[0,0,255,255],`blue side ${i}`);
  assert.deepEqual(pixel(viewport.width*.05,viewport.height*.1),[255,255,255,255]);
 }});
 assert.match(result.warnings[0],/not a certificate/);
});
test('overlays reject invalid placement, unsupported text, clipped labels and cancellation',async()=>{
 const input=await source();for(const options of [{text:''},{text:'hi',opacity:0},{text:'hi',size:NaN},{text:'hello\nworld'},{text:'漢字'},{text:'W'.repeat(250),size:144},{text:'hello',selected:[4]}])await assert.rejects(watermarkPdf(input,options));
 for(const placement of [{x:-.1,y:0,width:.2,height:.2},{x:.9,y:0,width:.2,height:.2},{x:0,y:NaN,width:.2,height:.2}])await assert.rejects(signPdf(input,new Uint8Array([1]),{placements:[{pageIndex:0,...placement}]}),/inside/);
 const controller=new AbortController();await assert.rejects(watermarkPdf(input,{text:'COPY',signal:controller.signal,onProgress:()=>controller.abort()}),{name:'AbortError'});
});
