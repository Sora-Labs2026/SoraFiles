import test from 'node:test';import assert from 'node:assert/strict';
import {PDFDocument,PDFName} from 'pdf-lib';import sharp from 'sharp';import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {repairPdf} from '../core/pdf-repair.mjs';import {rasterPdf} from '../core/pdf-raster.mjs';import {protectPdf} from '../core/protect-pdf.mjs';
async function fixture(){const doc=await PDFDocument.create(),page=doc.addPage([300,400]);page.drawText('Repair invoice 00123',{x:30,y:300,size:14});const field=doc.getForm().createTextField('name');field.setText('Keep this value');field.addToPage(page,{x:30,y:200,width:150,height:20});await doc.attach(Buffer.from('retained attachment'),'note.txt');return doc.save({useObjectStreams:false});}
test('rewriting broken cross-reference structure preserves rendered pages, text, forms and attachments',async()=>{
 const original=await fixture(),damaged=Buffer.from(Buffer.from(original).toString('latin1').replace(/startxref\s+\d+/,'startxref\n1'),'latin1');
 const result=await repairPdf(damaged),output=Buffer.from(result.bytes);assert.notDeepEqual(output,damaged);
 const xref=Number(output.toString('latin1').match(/startxref\s+(\d+)/)[1]);assert.ok(xref>1&&xref<output.length);assert.match(output.subarray(xref,xref+24).toString(),/^\d+ \d+ obj|^xref/);
 const doc=await PDFDocument.load(output,{updateMetadata:false});assert.equal(doc.getForm().getTextField('name').getText(),'Keep this value');
 const before=(await rasterPdf(original,{dpi:72,format:'png'}))[0],after=(await rasterPdf(result.bytes,{dpi:72,format:'png'}))[0];assert.deepEqual(await sharp(before.bytes).raw().toBuffer(),await sharp(after.bytes).raw().toBuffer());
 const task=getDocument({data:result.bytes.slice(),verbosity:0,isEvalSupported:false});try{const pdf=await task.promise;const page=await pdf.getPage(1);assert.match((await page.getTextContent()).items.map(item=>item.str||'').join(' '),/Repair invoice 00123/);const attachments=await pdf.getAttachments();const [id]=attachments.keys();assert.equal(Buffer.from(await pdf.getAttachmentContent(id)).toString(),'retained attachment');}finally{await task.destroy();}
 assert.match(result.warnings[0],/missing or truncated data cannot be recovered/);
});
test('repair refuses encrypted/signed/unreadable PDFs and cancels without a result',async()=>{
 const input=await fixture();await assert.rejects(repairPdf((await protectPdf(input,{password:'Synthetic-password'})).bytes));
 const signed=await PDFDocument.load(input);signed.catalog.set(PDFName.of('Perms'),signed.context.obj({DocMDP:{Type:'Sig',ByteRange:[0,1,2,3]}}));await assert.rejects(repairPdf(await signed.save()));
 await assert.rejects(repairPdf(Buffer.from('%PDF-missing objects')));await assert.rejects(repairPdf(input.slice(0,100)));
 const large=await PDFDocument.create();for(let i=0;i<101;i++)large.addPage();await assert.rejects(repairPdf(await large.save()));
 await assert.rejects(repairPdf(input,{signal:AbortSignal.abort()}),{name:'AbortError'});const controller=new AbortController(),pending=repairPdf(input,{signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});
});
