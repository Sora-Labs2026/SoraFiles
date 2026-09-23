import test from 'node:test';import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';import {unzipSync,strFromU8} from 'fflate';
import {pdfToWord} from '../core/pdf-word.mjs';import {protectPdf} from '../core/protect-pdf.mjs';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
async function fixture(){const doc=await PDFDocument.create();for(const text of ['Invoice 00123 & <draft>','Second page =1+1'])doc.addPage().drawText(text,{x:40,y:700,size:12});return doc.save();}
test('Word output preserves extracted text, literal special characters and page boundaries without active content',async()=>{
 const input=await fixture(),result=await pdfToWord(input,{direction:'rtl'}),archive=unzipSync(result.bytes),xml=strFromU8(archive['word/document.xml']);
 assert.match(xml,/Invoice 00123 &amp; &lt;draft&gt;/);assert.match(xml,/Second page =1\+1/);assert.match(xml,/<w:pageBreakBefore\/>/);assert.match(xml,/<w:bidi\/>/);
 assert.doesNotMatch(xml,/<w:(?:hyperlink|fldSimple|instrText)\b/);assert.equal(Object.keys(archive).some(name=>/vbaProject|embeddings\//i.test(name)),false);
 for(const [name,bytes] of Object.entries(archive))if(name.endsWith('.rels'))assert.doesNotMatch(strFromU8(bytes),/TargetMode="External"/);
 // Inspect source through an independent parser and confirm its extracted text
 // occurs in the DOCX after decoding XML entities.
 const task=getDocument({data:input.slice(),verbosity:0,isEvalSupported:false});try{const doc=await task.promise;const decoded=xml.replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i);for(const item of (await page.getTextContent()).items)if(item.str)assert.ok(decoded.includes(item.str));}}finally{await task.destroy();}
 assert.match(result.warnings[0],/Images, forms/);
});
test('Word conversion refuses blank/mixed scans, malformed/encrypted/over-limit PDFs and supports cancellation',async()=>{
 const input=await fixture(),blank=await PDFDocument.create();blank.addPage();await assert.rejects(pdfToWord(await blank.save()),/every page/);
 const mixed=await PDFDocument.load(input);mixed.addPage();await assert.rejects(pdfToWord(await mixed.save()),/every page/);
 await assert.rejects(pdfToWord(Buffer.from('%PDF-invalid')));
 await assert.rejects(pdfToWord((await protectPdf(input,{password:'Synthetic-password'})).bytes),/unencrypted/);
 const pages=await PDFDocument.create();for(let i=0;i<61;i++)pages.addPage();await assert.rejects(pdfToWord(await pages.save()),/60 pages/);
 await assert.rejects(pdfToWord(input,{direction:'invalid'}));await assert.rejects(pdfToWord(input,{signal:AbortSignal.abort()}),{name:'AbortError'});
 const controller=new AbortController(),pending=pdfToWord(input,{signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});
});
