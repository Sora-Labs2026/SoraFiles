import test from 'node:test';import assert from 'node:assert/strict';import {PDFDocument,StandardFonts} from 'pdf-lib';import {recognizeDocument} from '../core/ocr.mjs';import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';import {createCanvas} from '@napi-rs/canvas';import {writeFile,readFile,rm} from 'node:fs/promises';import {join} from 'node:path';
import {localFixture} from './local-fixture.mjs';import {processingFixture} from './processing-fixture.mjs';import {runProcessing} from '../native-host/processing-host.mjs';
async function fixture(){const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);for(const text of ['SoraFiles invoice 4827','Total amount 150 dollars'])doc.addPage([600,200]).drawText(text,{x:35,y:95,size:30,font});return doc.save();}
test('offline OCR preserves page order and recognizes known text from real PDF rendering',async()=>{
 const result=await recognizeDocument(await fixture());const text=Buffer.from(result.bytes).toString('utf8');assert.match(text,/invoice 4827/);assert.match(text,/150 dollars/);assert.ok(text.indexOf('invoice')<text.indexOf('dollars'));assert.equal(result.pages,2);assert.equal(result.extension,'txt');
});
test('searchable OCR PDF has independently extractable text on each page',async()=>{
 const result=await recognizeDocument(await fixture(),{format:'pdf'});const task=getDocument({data:result.bytes.slice(),verbosity:0,useSystemFonts:true});
 try{const doc=await task.promise;assert.equal(doc.numPages,2);for(const [index,expected] of ['4827','150'].entries()){const page=await doc.getPage(index+1),text=(await page.getTextContent()).items.map(item=>item.str).join(' ');assert.ok(text.includes(expected),text);const viewport=page.getViewport({scale:1});assert.ok(Math.abs(viewport.width-600)<1);assert.ok(Math.abs(viewport.height-200)<1);}}finally{await task.destroy();}
});
test('OCR rejects unknown languages and cancelled work without starting recognition',async()=>{
 await assert.rejects(recognizeDocument(new Uint8Array([1]),{language:'../../private'}),/language/);await assert.rejects(recognizeDocument(await fixture(),{signal:AbortSignal.abort()}),{name:'AbortError'});
});
test('licensed OCR reads a still WebP with a Unicode filename and preserves its original',async()=>{
 const canvas=createCanvas(1000,180),context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,1000,180);context.fillStyle='black';context.font='48px sans-serif';context.fillText('SoraFiles invoice 4827',35,100);
 const input=await sharp(await canvas.encode('png')).webp({lossless:true}).toBuffer(),directory=await localFixture('sf-ocr-webp-');
 try{
  const source=join(directory,'Invoice नेपाली 日本.webp');await writeFile(source,input);
  const result=await runProcessing({...processingFixture(),tool:'pdf-ocr',paths:[source],options:{language:'eng',format:'txt'},saveState:async()=>{}});
  assert.match(await readFile(result.path,'utf8'),/invoice\s+4827/i);assert.deepEqual(await readFile(source),input);assert.notEqual(result.path,source);
 }finally{await rm(directory,{recursive:true,force:true});}
});
