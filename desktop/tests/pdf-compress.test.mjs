import test from 'node:test';import assert from 'node:assert/strict';
import {PDFDocument,PDFName,degrees} from 'pdf-lib';import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';import sharp from 'sharp';
import {compressPdf} from '../core/pdf-compress.mjs';import {rasterPdf} from '../core/pdf-raster.mjs';import {protectPdf} from '../core/protect-pdf.mjs';
async function fixture(){
 const doc=await PDFDocument.create(),page=doc.addPage([300,400]);page.setCropBox(10,15,270,360);page.setRotation(degrees(90));page.drawText('Invoice 00123',{x:30,y:300,size:14});
 const image=await doc.embedPng(await sharp({create:{width:30,height:20,channels:3,background:'#417b9a'}}).png().toBuffer());page.drawImage(image,{x:30,y:100,width:100,height:60});
 const field=doc.getForm().createTextField('reference');field.setText('Value 00123');field.addToPage(page,{x:20,y:200,width:120,height:20});
 await doc.attach(Buffer.from('attachment bytes'),'note.txt');doc.setAuthor('Test Author');return doc.save({useObjectStreams:false});
}
test('structural compression reduces uncompressed objects while preserving rendered content, forms and attachments',async()=>{
 const input=await fixture(),result=await compressPdf(input);assert.ok(result.bytes.length<input.length);assert.equal(result.unchanged,false);
 const doc=await PDFDocument.load(result.bytes,{updateMetadata:false});assert.equal(doc.getAuthor(),'Test Author');assert.equal(doc.getForm().getTextField('reference').getText(),'Value 00123');
 const before=(await rasterPdf(input,{dpi:72,format:'png'}))[0],after=(await rasterPdf(result.bytes,{dpi:72,format:'png'}))[0];
 assert.deepEqual(await sharp(before.bytes).raw().toBuffer(),await sharp(after.bytes).raw().toBuffer());
 const task=getDocument({data:result.bytes.slice(),verbosity:0,isEvalSupported:false});try{const pdf=await task.promise;const page=await pdf.getPage(1);assert.match((await page.getTextContent()).items.map(item=>item.str||'').join(' '),/Invoice 00123/);const attachments=await pdf.getAttachments();const [id]=attachments.keys();assert.equal(Buffer.from(await pdf.getAttachmentContent(id)).toString(),'attachment bytes');}finally{await task.destroy();}
 const repeated=await compressPdf(result.bytes);assert.ok(repeated.bytes.length<=result.bytes.length);if(repeated.unchanged)assert.deepEqual(Buffer.from(repeated.bytes),Buffer.from(result.bytes));
});
test('compression refuses encrypted, signed, malformed, over-limit and cancelled documents',async()=>{
 const input=await fixture();await assert.rejects(compressPdf((await protectPdf(input,{password:'Synthetic-password'})).bytes));
 const signed=await PDFDocument.load(input);signed.context.register(signed.context.obj({Type:'Sig',ByteRange:[0,1,2,3]}));await assert.rejects(compressPdf(await signed.save()),/unsigned/);
 const direct=await PDFDocument.load(input);direct.catalog.set(PDFName.of('Perms'),direct.context.obj({DocMDP:{Type:'Sig',ByteRange:[0,1,2,3]}}));await assert.rejects(compressPdf(await direct.save()),/unsigned/);
 await assert.rejects(compressPdf(Buffer.from('%PDF-damaged')));await assert.rejects(compressPdf(input,{signal:AbortSignal.abort()}),{name:'AbortError'});
 const tooMany=await PDFDocument.create();for(let i=0;i<1001;i++)tooMany.addPage([100,100]);await assert.rejects(compressPdf(await tooMany.save()),/1000 pages/);
 const controller=new AbortController(),pending=compressPdf(input,{signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});
});
