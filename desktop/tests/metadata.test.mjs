import test from 'node:test';import assert from 'node:assert/strict';
import {PDFDocument,PDFName,PDFString,PDFDict,PDFStream,decodePDFRawStream} from 'pdf-lib';import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';import {createCanvas,loadImage} from '@napi-rs/canvas';
import {removeMetadata} from '../core/metadata.mjs';import {protectPdf} from '../core/protect-pdf.mjs';
import {stripImageMeta} from '../../src/lib/metadata-strip.js';
import {readFile} from 'node:fs/promises';
async function fixture(){
 const doc=await PDFDocument.create(),page=doc.addPage([420,600]);page.drawText('Visible invoice 4827',{x:30,y:500});
 doc.setTitle('Private title');doc.setAuthor('Private author');
 const info=doc.context.lookup(doc.context.trailerInfo.Info);info.set(PDFName.of('CustomerSecret'),PDFString.of('Private custom metadata'));
 const xmp=doc.context.flateStream(Buffer.from('<x:xmpmeta>Private XMP marker</x:xmpmeta>'),{Type:'Metadata',Subtype:'XML'}),ref=doc.context.register(xmp);
 doc.catalog.set(PDFName.of('Metadata'),ref);page.node.set(PDFName.of('Metadata'),ref);
 doc.getForm().createTextField('Customer').setText('Keep this field');
 await doc.attach(Buffer.from('Keep attachment content'),'invoice.txt',{mimeType:'text/plain'});
 return doc.save();
}
async function inspect(bytes){const task=getDocument({data:Uint8Array.from(bytes),verbosity:0,isEvalSupported:false});try{const doc=await task.promise,attachments=[];for(const [id,item] of await doc.getAttachments()||[])attachments.push({...item,content:await doc.getAttachmentContent(id)});return {pages:doc.numPages,metadata:await doc.getMetadata(),text:(await (await doc.getPage(1)).getTextContent()).items.map(row=>row.str).join(' '),attachments,fields:await doc.getFieldObjects()};}finally{await task.destroy();}}
test('PDF metadata removal deletes document properties and XMP bytes while preserving content and attachments',async()=>{
 const input=await fixture(),result=await removeMetadata(input),view=await inspect(result.bytes);
 assert.equal(result.extension,'pdf');assert.equal(view.pages,1);assert.match(view.text,/invoice 4827/);
 assert.equal(view.metadata.info.Title,undefined);assert.equal(view.metadata.info.Author,undefined);assert.equal(view.metadata.metadata,null);
 const attachment=Object.values(view.attachments).find(item=>item.filename==='invoice.txt');assert.ok(attachment);assert.equal(Buffer.from(attachment.content).toString(),'Keep attachment content');
 const doc=await PDFDocument.load(result.bytes,{updateMetadata:false});assert.equal(doc.getForm().getTextField('Customer').getText(),'Keep this field');
 assert.equal(doc.context.trailerInfo.Info,undefined);
 for(const [,object] of doc.context.enumerateIndirectObjects()){
  if(object instanceof PDFDict)assert.equal(object.has(PDFName.of('Metadata')),false);
  if(object instanceof PDFStream){assert.equal(Buffer.from(decodePDFRawStream(object).decode()).includes(Buffer.from('Private XMP marker')),false);}
  else assert.doesNotMatch(object.toString(),/Private title|Private author|Private custom/);
 }
 assert.match(result.warnings[0],/attachments/);assert.equal((await inspect(input)).metadata.info.Author,'Private author');
});
test('a content resource named Metadata remains usable after cleanup',async()=>{
 const doc=await PDFDocument.create(),page=doc.addPage([100,100]);doc.setAuthor('Private author');
 const resource=doc.context.register(doc.context.flateStream(Buffer.alloc(3,150),{Type:'XObject',Subtype:'Image',Width:1,Height:1,ColorSpace:'DeviceRGB',BitsPerComponent:8}));
 page.node.set(PDFName.of('Resources'),doc.context.obj({XObject:{Metadata:resource}}));
 page.node.set(PDFName.of('Contents'),doc.context.register(doc.context.flateStream(Buffer.from('q 100 0 0 100 0 0 cm /Metadata Do Q'))));
 const result=await removeMetadata(await doc.save()),parsed=await PDFDocument.load(result.bytes,{updateMetadata:false});
 const resources=parsed.getPage(0).node.lookup(PDFName.of('Resources'),PDFDict).lookup(PDFName.of('XObject'),PDFDict);
 assert.ok(resources.has(PDFName.of('Metadata')));assert.ok(parsed.context.lookup(resources.get(PDFName.of('Metadata'))) instanceof PDFStream);
 const task=getDocument({data:result.bytes.slice(),verbosity:0});try{const pdf=await task.promise;assert.ok((await(await pdf.getPage(1)).getOperatorList()).fnArray.length>0);}finally{await task.destroy();}
});
test('image metadata removal applies orientation, strips private metadata, and preserves lossless PNG pixels',async()=>{
 for(const format of ['jpeg','png','webp']){
  const source=sharp({create:{width:24,height:12,channels:4,background:{r:50,g:100,b:180,alpha:format==='jpeg'?1:0.5}}}).withMetadata({orientation:6}).withExifMerge({IFD0:{Artist:'Synthetic private author'}});
  const input=await source[format]().toBuffer(),before=await sharp(input).metadata();assert.ok(before.exif);
  const result=await removeMetadata(input),after=await sharp(result.bytes).metadata();
  assert.match(result.warnings[0],/re-encoded/);
  assert.equal(after.width,12);assert.equal(after.height,24);for(const key of ['exif','xmp','iptc','icc','orientation'])assert.equal(after[key],undefined,key);
  const img=await loadImage(result.bytes),canvas=createCanvas(img.width,img.height),ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const pixel=[...ctx.getImageData(3,3,1,1).data];
  assert.ok(Math.abs(pixel[0]-50)<5&&Math.abs(pixel[1]-100)<5&&Math.abs(pixel[2]-180)<5);assert.ok(Math.abs(pixel[3]-(format==='jpeg'?255:128))<=1);
  if(format==='png')assert.deepEqual(await sharp(result.bytes).raw().toBuffer(),await sharp(input).autoOrient().toColourspace('srgb').raw().toBuffer());
 }
});
test('lossless image cleanup matches actual Web bytes and preserves decoded colour/alpha without re-encoding',async()=>{
 const source=await readFile(new URL('../../src/lib/metadata-strip.js',import.meta.url),'utf8');
 assert.equal(await readFile(new URL('../shared/image-metadata.mjs',import.meta.url),'utf8'),'// Generated from src/lib/metadata-strip.js by sync-image-metadata.mjs.\n'+source.slice(0,source.indexOf('export async function stripOpenXmlMeta')));
 const pixels=Buffer.alloc(32*24*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=(i*13)%256;pixels[i+1]=(i*3)%256;pixels[i+2]=(i*7)%256;pixels[i+3]=80+(i%176);}
 for(const format of ['jpeg','png','webp']){
  const input=await sharp(pixels,{raw:{width:32,height:24,channels:4}}).withExif({IFD0:{Artist:'Synthetic private author',ImageDescription:'Synthetic description'}})[format]().toBuffer();
  const meta=await sharp(input).metadata();assert.ok(meta.exif);assert.equal(meta.icc,undefined);
  const original=Buffer.from(input),result=await removeMetadata(input),expected=await stripImageMeta(new Blob([input]));
  assert.deepEqual(Buffer.from(result.bytes),Buffer.from(await expected.blob.arrayBuffer()));assert.match(result.warnings[0],/without re-encoding/);
  assert.deepEqual(await sharp(result.bytes).ensureAlpha().raw().toBuffer(),await sharp(input).ensureAlpha().raw().toBuffer());
  assert.deepEqual(input,original);assert.equal((await sharp(result.bytes).metadata()).exif,undefined);
  const repeat=await removeMetadata(result.bytes);assert.deepEqual(repeat.bytes,result.bytes);assert.match(repeat.warnings[0],/without re-encoding/);
 }
});
test('metadata removal refuses encrypted PDFs, malformed sources, animation and cancelled work',async()=>{
 const input=await fixture(),encrypted=await protectPdf(input,{password:'Synthetic-protection'});
 await assert.rejects(removeMetadata(encrypted.bytes),/unencrypted/);
 await assert.rejects(removeMetadata(Buffer.from('%PDF-broken')));await assert.rejects(removeMetadata(Buffer.from('PK unsupported office')));
 const pixels=Buffer.alloc(20*40*3,50);pixels.fill(220,20*20*3);
 const frames=await sharp(pixels,{raw:{width:20,height:40,channels:3,pageHeight:20}}).webp({delay:[100,100]}).toBuffer();assert.equal((await sharp(frames).metadata()).pages,2);
 await assert.rejects(removeMetadata(frames));await assert.rejects(removeMetadata(input,{signal:AbortSignal.abort()}),{name:'AbortError'});
});
