import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {numberPdfPages} from '../core/pdf.mjs';
import {watermarkPdf} from '../core/pdf-overlays.mjs';

// Exercise the actual browser form and FormData reader, then pass those options
// through the real engines. This uses no native bridge or shared build output.
let browser,page;
before(async()=>{
 const bundle=await build({entryPoints:['desktop/ui/processing.ts'],bundle:true,write:false,format:'iife',globalName:'processing',platform:'browser'});
 browser=await chromium.launch({...process.env.SORA_BROWSER_EXECUTABLE?{executablePath:process.env.SORA_BROWSER_EXECUTABLE}:{channel:process.env.SORA_BROWSER_CHANNEL||'msedge'},headless:true});
 page=await browser.newPage({viewport:{width:1180,height:900}});
 await page.setContent('<main></main>');await page.addScriptTag({content:bundle.outputFiles[0].text});
});
after(async()=>{await browser?.close();});
async function form(tool,values={}){
 await page.evaluate(tool=>document.querySelector('main').innerHTML=processing.processingOptions(tool),tool);
 for(const [name,value] of Object.entries(values)){
  const field=page.locator(`[name="${name}"]`);
  if(await field.evaluate(node=>node.tagName==='SELECT'))await field.selectOption(String(value));else await field.fill(String(value));
 }
}
async function options(tool){return page.evaluate(tool=>processing.readProcessingOptions(document.querySelector('form'),tool),tool);}
async function source(){const pdf=await PDFDocument.create();for(let i=0;i<4;i++)pdf.addPage([500,700]);return pdf.save();}
async function pageText(bytes){
 const task=getDocument({data:bytes.slice(),useSystemFonts:true,isEvalSupported:false});
 try{const pdf=await task.promise,labels=[];for(let i=1;i<=pdf.numPages;i++)labels.push((await(await pdf.getPage(i)).getTextContent()).items.map(item=>item.str).filter(Boolean).join(''));return labels;}finally{await task.destroy();}
}

test('default overlay forms preserve engine defaults and leave page selection unrestricted',async()=>{
 await form('page-numbers');assert.deepEqual(await options('page-numbers'),{start:1,position:'bottom-center',format:'number',size:10,margin:24,color:'#333b52',skip:0});
 assert.equal(await page.locator('form').evaluate(form=>form.checkValidity()),true);
 await form('watermark-pdf',{text:'DRAFT'});assert.deepEqual(await options('watermark-pdf'),{text:'DRAFT',size:42,opacity:.2,angle:45,margin:24,color:'#667085'});
 assert.equal(await page.locator('form').evaluate(form=>form.checkValidity()),true);
});

test('numbering form supports ordered selection, physical-page skip and all six placements',async()=>{
 await form('page-numbers',{pages:'4, 1-3, 3',skip:2,start:9,format:'roman',position:'top-right',size:16,margin:30,color:'#a02437'});
 const parsed=await options('page-numbers');
 assert.deepEqual(parsed,{start:9,position:'top-right',format:'roman',size:16,margin:30,color:'#a02437',skip:2,selected:[0,1,2,3]});
 const result=await numberPdfPages(await source(),parsed);assert.equal(result.numbered,2);assert.deepEqual(await pageText(result.bytes),['','','IX','X']);
 assert.deepEqual(await page.locator('[name="position"] option').evaluateAll(nodes=>nodes.map(node=>node.value)),['bottom-center','bottom-left','bottom-right','top-center','top-left','top-right']);
 await page.locator('[name="format"]').selectOption('total');
 assert.deepEqual(await pageText((await numberPdfPages(await source(),await options('page-numbers'))).bytes),['','','Page 9 of 10','Page 10 of 10']);
});

test('watermark form converts opacity percent and modifies only selected pages',async()=>{
 await form('watermark-pdf',{text:'REVIEW COPY',pages:'4, 2',size:24,opacity:65,angle:-30,margin:20,color:'#008040'});
 const parsed=await options('watermark-pdf');assert.deepEqual(parsed,{text:'REVIEW COPY',size:24,opacity:.65,angle:-30,margin:20,color:'#008040',selected:[1,3]});
 assert.deepEqual(await pageText((await watermarkPdf(await source(),parsed)).bytes),['','REVIEW COPY','','REVIEW COPY']);
});

test('range errors, invalid browser constraints and engine-dependent limits reject unsafe options',async()=>{
 for(const tool of ['watermark-pdf','page-numbers']){
  await form(tool,tool==='watermark-pdf'?{text:'DRAFT'}:{});
  for(const range of ['0','3-1','1,','1001']){await page.locator('[name="pages"]').fill(range);await assert.rejects(options(tool));}
 }
 await form('watermark-pdf',{text:'DRAFT',opacity:0});assert.equal(await page.locator('form').evaluate(form=>form.checkValidity()),false);await assert.rejects(watermarkPdf(await source(),await options('watermark-pdf')));
 await form('page-numbers',{start:3999,format:'roman'});await assert.rejects(numberPdfPages(await source(),await options('page-numbers')),/exceeds/);
 await form('page-numbers',{pages:'5'});await assert.rejects(numberPdfPages(await source(),await options('page-numbers')),/selection/);
 await form('page-numbers',{skip:4});await assert.rejects(numberPdfPages(await source(),await options('page-numbers')),/at least one/);
});
