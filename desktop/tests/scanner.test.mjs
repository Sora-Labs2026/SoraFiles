import test from 'node:test';import assert from 'node:assert/strict';
import sharp from 'sharp';import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {scanDocuments} from '../core/scanner.mjs';import {rasterPdf} from '../core/pdf-raster.mjs';
import {runProcessing} from '../native-host/processing-host.mjs';import {processingFixture} from './processing-fixture.mjs';
import {localFixture} from './local-fixture.mjs';import {join} from 'node:path';import {readFile,writeFile,readdir,rm} from 'node:fs/promises';
async function fixture(){return sharp(Buffer.from('<svg width="300" height="180"><rect width="300" height="180" fill="#eeeeee"/><rect x="20" y="25" width="80" height="30" fill="#aa2200"/><path d="M30 100h160m-160 20h110" stroke="#222222" stroke-width="4"/></svg>')).png().toBuffer();}
async function pixels(bytes){return sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});}
test('scanned pages retain original pixels, selected order and rotation with no searchable-text claim',async()=>{
 const first=await fixture(),second=await sharp({create:{width:300,height:180,channels:3,background:'#3050a0'}}).png().toBuffer();
 const result=await scanDocuments([first,second],{filter:'original',rotation:90,paper:'image'}),pages=await rasterPdf(result.bytes,{dpi:150,format:'png'});
 assert.equal(pages.length,2);
 for(const [index,source] of [first,second].entries()){
  const expected=await pixels(await sharp(source).rotate(90).png().toBuffer());
  const dimensions=await sharp(pages[index].bytes).metadata();
  // PDF.js rounds up a floating-point 180.00000000000003 viewport to 181.
  // Inspect the actual 180 by 300 image area, excluding that padding column.
  assert.ok(dimensions.width>=180&&dimensions.width<=181);assert.ok(dimensions.height>=300&&dimensions.height<=301);
  const actual=await pixels(await sharp(pages[index].bytes).extract({left:0,top:0,width:180,height:300}).png().toBuffer());
  // PDF.js interpolation can differ at hard edges. Interior landmarks retain
  // exact colours and the aggregate error stays below one 8-bit level.
  let error=0;for(let i=0;i<expected.data.length;i++)error+=Math.abs(expected.data[i]-actual.data[i]);assert.ok(error/expected.data.length<1);
 }
 const task=getDocument({data:result.bytes.slice(),verbosity:0,isEvalSupported:false});try{const pdf=await task.promise;assert.equal((await (await pdf.getPage(1)).getTextContent()).items.length,0);}finally{await task.destroy();}
 assert.match(result.warnings[0],/image-only/);
});
test('scan filters preserve dark markings and reject unsupported, oversized or cancelled work',async()=>{
 const input=await fixture();
 for(const filter of ['enhanced','color','grayscale','bw','contrast','receipt']){
  const result=await scanDocuments([input],{filter,paper:'image'}),[page]=await rasterPdf(result.bytes,{dpi:150,format:'png'}),{data,info}=await pixels(page.bytes);
  const pixel=(x,y)=>[...data.subarray((y*info.width+x)*3,(y*info.width+x)*3+3)];
  assert.ok(pixel(70,100).every(value=>value<70),filter+' marking lost');assert.ok(pixel(200,150).every(value=>value>220),filter+' paper darkened');
  if(['grayscale','bw','contrast','receipt'].includes(filter)){const color=pixel(50,40);assert.equal(color[0],color[1]);assert.equal(color[1],color[2]);}
 }
 await assert.rejects(scanDocuments([Buffer.from('bad')]));await assert.rejects(scanDocuments([await sharp(input).tiff().toBuffer()]));
 const large=await sharp({create:{width:4000,height:3001,channels:3,background:'#fff'}}).png().toBuffer();await assert.rejects(scanDocuments([large]));
 await assert.rejects(scanDocuments(Array(21).fill(input)));await assert.rejects(scanDocuments([input],{filter:'unknown'}));
 await assert.rejects(scanDocuments([input],{signal:AbortSignal.abort()}),{name:'AbortError'});
 const controller=new AbortController(),pending=scanDocuments([input],{signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});
});
test('licensed scanning combines selected images, preserves originals and checks access before output',async()=>{
 const dir=await localFixture('sf-scanner-');try{
  const input=await fixture(),webp=await sharp(input).webp({lossless:true}).toBuffer(),paths=[join(dir,'first.png'),join(dir,'second.webp')];for(const [index,path] of paths.entries())await writeFile(path,[input,webp][index]);
  const fixtureState=processingFixture(),run=()=>runProcessing({...fixtureState,tool:'doc-scanner',paths,options:{filter:'grayscale',paper:'letter',rotation:0},saveState:async()=>{}});
  const result=await run();assert.equal(result.state,'completed');
  const task=getDocument({data:Uint8Array.from(await readFile(result.path)),verbosity:0,isEvalSupported:false});try{const pdf=await task.promise;assert.equal(pdf.numPages,2);assert.deepEqual((await pdf.getPage(1)).view,[0,0,792,612]);}finally{await task.destroy();}
  for(const [index,path] of paths.entries())assert.deepEqual(await readFile(path),[input,webp][index]);assert.notEqual((await run()).path,result.path);
  fixtureState.state.license.entitlement+='bad';const before=await readdir(dir);await assert.rejects(run());assert.deepEqual(await readdir(dir),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});
