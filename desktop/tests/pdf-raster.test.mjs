import test from 'node:test';import assert from 'node:assert/strict';import {PDFDocument,PDFName,PDFNumber,rgb,degrees} from 'pdf-lib';import sharp from 'sharp';import {rasterPdf} from '../core/pdf-raster.mjs';
test('PDF raster output preserves crop, rotation, page order and known colours at requested resolution',async()=>{
 const doc=await PDFDocument.create();const first=doc.addPage([200,100]);first.drawRectangle({x:0,y:0,width:200,height:100,color:rgb(1,0,0)});first.setCropBox(20,10,100,60);first.setRotation(degrees(90));
 const second=doc.addPage([80,50]);second.drawRectangle({x:0,y:0,width:80,height:50,color:rgb(0,0,1)});
 const pages=await rasterPdf(await doc.save(),{dpi:144,format:'png'});assert.equal(pages.length,2);assert.deepEqual(pages.map(page=>[page.width,page.height,page.page]),[[120,200,1],[160,100,2]]);
 for(const [index,page] of pages.entries()){const {data,info}=await sharp(page.bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,page.width);assert.equal(info.height,page.height);const middle=((Math.floor(info.height/2)*info.width)+Math.floor(info.width/2))*info.channels;assert.deepEqual([...data.subarray(middle,middle+3)],index?[0,0,255]:[255,0,0]);}
});
test('an oversized embedded image fails instead of producing a page with missing content',async()=>{
 const doc=await PDFDocument.create(),page=doc.addPage([200,200]);
 const image=await doc.embedPng(await sharp({create:{width:1,height:1,channels:3,background:'#ff0000'}}).png().toBuffer());
 page.drawImage(image,{x:0,y:0,width:200,height:200});await doc.save();
 const stream=doc.context.lookup(image.ref);stream.dict.set(PDFName.of('Width'),PDFNumber.of(5001));stream.dict.set(PDFName.of('Height'),PDFNumber.of(5001));
 await assert.rejects(rasterPdf(await doc.save(),{dpi:72}),/maximum allowed size/);
});
test('embedded image colours survive conversion and an in-flight decoder can be cancelled',async()=>{
 const doc=await PDFDocument.create(),page=doc.addPage([100,60]);
 const image=await doc.embedPng(await sharp({create:{width:40,height:24,channels:3,background:'#14b864'}}).png().toBuffer());
 page.drawImage(image,{x:0,y:0,width:100,height:60});const bytes=await doc.save();
 const [result]=await rasterPdf(bytes,{dpi:72,format:'png'});const pixel=await sharp(result.bytes).extract({left:50,top:30,width:1,height:1}).removeAlpha().raw().toBuffer();
 assert.deepEqual([...pixel],[20,184,100]);
 const controller=new AbortController();const pending=rasterPdf(bytes,{signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});
});
test('PDF raster refuses invalid settings, oversized canvases and cancelled requests',async()=>{
 const doc=await PDFDocument.create();doc.addPage([14400,14400]);const input=await doc.save();
 await assert.rejects(rasterPdf(input,{dpi:301}),/settings/);await assert.rejects(rasterPdf(input,{dpi:72}),/resolution/);
 await assert.rejects(rasterPdf(input,{signal:AbortSignal.abort()}),{name:'AbortError'});
 await assert.rejects(rasterPdf(new Uint8Array([1,2,3])));
});
test('document page and aggregate pixel budgets reject before rendering oversized input',async()=>{
 const doc=await PDFDocument.create();doc.addPage([100,100]);doc.addPage([100,100]);const input=await doc.save();
 await assert.rejects(rasterPdf(input,{dpi:72,maxPages:1}),/Split this document/);
 await assert.rejects(rasterPdf(input,{dpi:72,maxTotalPixels:19999}),/Split this document/);
 assert.equal((await rasterPdf(input,{dpi:72,maxPages:2,maxTotalPixels:20000})).length,2);
 for(const invalid of [{maxPages:0},{maxPages:1001},{maxTotalPixels:NaN},{maxTotalPixels:1_000_000_001}])await assert.rejects(rasterPdf(input,invalid),/settings/);
});
test('selected PDF image pages preserve original numbering, document order and selected-pixel budget',async()=>{
 const doc=await PDFDocument.create();for(const color of [rgb(1,0,0),rgb(0,1,0),rgb(0,0,1)])doc.addPage([100,100]).drawRectangle({x:0,y:0,width:100,height:100,color});
 const input=await doc.save(),pages=await rasterPdf(input,{dpi:72,format:'png',selected:[2,0],maxTotalPixels:20000});
 assert.deepEqual(pages.map(page=>page.page),[1,3]);
 for(const [index,page] of pages.entries()){const pixel=await sharp(page.bytes).extract({left:50,top:50,width:1,height:1}).removeAlpha().raw().toBuffer();assert.deepEqual([...pixel],index?[0,0,255]:[255,0,0]);}
 assert.equal((await rasterPdf(input,{dpi:72,selected:[1],maxTotalPixels:10000}))[0].page,2);
 await assert.rejects(rasterPdf(input,{selected:[3]}),/outside the PDF/);
 for(const selected of [[],[0,0],[-1],[1000],[.5],'1-2'])await assert.rejects(rasterPdf(input,{selected}),/settings/);
 // Selecting a page does not bypass the document-level page-count budget.
 await assert.rejects(rasterPdf(input,{selected:[0],maxPages:2}),/processing/);
});
