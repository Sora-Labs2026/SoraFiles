import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PlaywrightAuditDriver } from './playwright-audit-driver.mjs';
import { validatePdf, validateDocx, validateZip, extractPdfText } from './output-validators.mjs';
import { liveTools } from '../../src/data/liveTools.ts';
import { decryptPDF } from '@pdfsmaller/pdf-decrypt';
import xlsx from 'xlsx';
import { captureJourney, resetJourney } from './ux-journey.mjs';

const mobile=process.env.SORA_QA_MOBILE==='1';
const root=`.artifacts/${process.env.SORA_QA_PREFIX || 'astra-complex'}-${mobile?'mobile':'desktop'}`;
const base=process.env.SORA_BASE_URL || 'http://127.0.0.1:4321';
const corpus='.artifacts/astra-complex/', small='.artifacts/astra-corpus/';
const selected=process.env.SORA_COMPLEX_TOOLS?.split(',');
await mkdir(`${root}/downloads`,{recursive:true});await mkdir(`${root}/screenshots`,{recursive:true});
const results=selected ? JSON.parse(await readFile(`${root}/results.json`,'utf8').catch(()=>'[]')).filter(r=>!selected.includes(r.route)) : [];
const documentRoutes=['merge-pdf','split-pdf','rotate-pdf','remove-pages','pdf-to-jpg','jpg-to-pdf','pdf-to-word','word-to-pdf','watermark-pdf','page-numbers','sign-pdf'];
const extraRoutes=['protect-pdf','unlock-pdf','repair-pdf','metadata-remover','pdf-to-excel','excel-to-pdf','pdf-ocr','edit-image'];
for(const tool of liveTools){
  const route=tool.slug;if(selected&&!selected.includes(route))continue;
  const driver=new PlaywrightAuditDriver({downloadDir:`${root}/downloads`});
  const row={tool:tool.name,route,viewport:mobile?'390x844 touch':'1440x1000',status:'FAIL',outputs:[],checks:[],errors:[]};
  const started=Date.now();
  try{
    await driver.start();await driver.setViewport(mobile?390:1440,mobile?844:1000);
    driver.page.on('pageerror',e=>row.errors.push(e.message));
    await driver.navigate(`${base}/${route}`);
    await captureJourney(driver,root,route,'arrival',row);
    const originalSetFiles=driver.setFiles.bind(driver);
    driver.setFiles=async(selector,files)=>{await originalSetFiles(selector,files);await driver.page.waitForTimeout(400);await captureJourney(driver,root,route,'selected',row);};
    const health=await driver.pageHealth();assert.equal(health.h1,1);assert.equal(health.overflow,false);
    row.checks.push('one H1; no horizontal page overflow');
    row.initialResources=await driver.page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({url:r.name,bytes:r.transferSize})));
    await driver.installPrivacyProbe();
    const file=corpus+'mixed-36.pdf';
    const set=async(selector,value)=>driver.setValue(selector,String(value),'input');
    const download=async(selector)=>{await captureJourney(driver,root,route,'result',row);const path=await driver.waitForDownload(()=>driver.click(selector),{timeout:240000});const bytes=await readFile(path);assert.ok(bytes.length);row.outputs.push(path);return bytes;};
    const finish=async(button,result,link)=>{await captureJourney(driver,root,route,'configured',row);await driver.click(button);await captureJourney(driver,root,route,'processing',row);await driver.waitFor(result,{timeout:240000});return download(link);};
    const pdf=async(bytes,count=36)=>{await validatePdf(bytes,{pageCount:count});row.checks.push(`PDF parses with ${count} pages`);};
    if(documentRoutes.includes(route)){
      let files=[file];
      if(route==='merge-pdf')files=[file,corpus+'tables-12.pdf'];
      if(route==='jpg-to-pdf')files=[corpus+'detailed.jpg',corpus+'soft-alpha.png'];
      if(route==='word-to-pdf')files=[corpus+'complex.docx'];
      row.fixture=files;
      await driver.setFiles('#action-input',files);await driver.waitFor('#action-work',{timeout:90000});
      if(await driver.exists('[data-pdf-workspace]'))await driver.waitUntil('return Boolean(document.querySelector("[data-pdf-workspace-summary]")?.textContent?.trim())',[],90000,'page model');
      if(['split-pdf','rotate-pdf'].includes(route)){await set('[data-pdf-range]',route==='split-pdf'?'1,18,36':'2');await driver.click('[data-pdf-apply-range]');}
      if(route==='rotate-pdf')await driver.click('[data-pdf-rotate="90"]');
      if(route==='remove-pages')await set('#remove-page-spec','2');
      if(route==='pdf-to-word')await driver.check('input[name="pdfWordMode"][value="editable"]');
      if(route==='watermark-pdf')await set('#watermark-text','SYNTHETIC WATERMARK 7631');
      if(route==='page-numbers')await driver.setValue('#page-number-format','total','change');
      if(route==='sign-pdf'){await driver.click('[data-sign-mode="upload"]');await driver.setFiles('#signature-upload',small+'signature.png');await driver.waitFor('#signature-selection');}
      const bytes=await finish('#action-process','#action-result','#action-download');
      if(route==='split-pdf'){const zip=validateZip(bytes,/\.pdf$/);assert.equal(zip.names.length,3);for(const name of zip.names)await pdf(zip.entries[name],1);const text=(await Promise.all(zip.names.map(n=>extractPdfText(zip.entries[n])))).join(' ');for(const n of ['01','18','36'])assert.ok(text.includes(`GROUND TRUTH PAGE ${n}`));}
      else if(route==='pdf-to-jpg'){const zip=validateZip(bytes,/\.jpg$/);assert.equal(zip.names.length,36);row.checks.push('36 JPEG page entries; independent decoder checks every entry');}
      else if(route==='pdf-to-word'){const doc=await validateDocx(bytes,'GROUND TRUTH PAGE 01');assert.ok(doc.text.includes('GROUND TRUTH PAGE 36'));row.checks.push('DOCX contains first and last page text');}
      else if(route==='word-to-pdf'){await validatePdf(bytes);const text=await extractPdfText(bytes);for(const value of ['Section 1','Section 8','SKU-7-11'])assert.ok(text.includes(value),value);row.checks.push('long DOCX first/last section and final table cell preserved');}
      else {await pdf(bytes,route==='merge-pdf'?48:route==='jpg-to-pdf'?2:route==='remove-pages'?35:36);if(route!=='jpg-to-pdf'){const text=await extractPdfText(bytes);assert.ok(text.includes('GROUND TRUTH PAGE 36'));if(route==='watermark-pdf')assert.ok(text.includes('SYNTHETIC WATERMARK 7631'));if(route==='page-numbers')assert.ok(text.includes('Page 36 of 36'));if(route==='remove-pages')assert.ok(!text.includes('GROUND TRUTH PAGE 02'));}}
    }else if(extraRoutes.includes(route)){
      const fixture=route==='unlock-pdf'?'protected-36.pdf':route==='pdf-to-excel'?'tables-12.pdf':route==='excel-to-pdf'?'complex.xlsx':route==='edit-image'?'detailed.jpg':'mixed-36.pdf';
      const input=route==='pdf-ocr'?small+'scanned-document.pdf':corpus+fixture;row.fixture=[input];
      await driver.setFiles('[data-extra-input]',input);await driver.waitFor(route==='edit-image'?'[data-edit-editor]':'[data-extra-selected]',{timeout:90000});
      if(['protect-pdf','unlock-pdf'].includes(route))await set('[data-extra-password]','SyntheticQA7631');
      if(route==='pdf-to-excel')await driver.check('[data-spreadsheet-mode][value="editable"]');
      if(route==='pdf-ocr'){await driver.setValue('[data-extra-lang]','eng','change');await driver.setValue('[data-ocr-output]','pdf','change');}
      if(route==='edit-image'){await driver.waitFor('[data-edit-editor]');await driver.click('[data-edit-rotate-right]');await set('[data-edit-control="brightness"]',10);await driver.setValue('[data-extra-format]','image/webp','change');}
      const bytes=await finish('[data-extra-start]','[data-extra-results]','[data-extra-result-list] a[download]');
      if(route==='pdf-to-excel'){const wb=xlsx.read(bytes,{type:'buffer'});const cells=wb.SheetNames.flatMap(n=>xlsx.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:false}).flat()).join('|');for(let p=0;p<12;p++)for(let r=0;r<25;r++)assert.ok(cells.includes(`SKU-${String(p).padStart(2,'0')}-${String(r).padStart(2,'0')}`));row.checks.push('all 300 controlled SKU values recovered as editable cells');}
      else if(route==='excel-to-pdf'){await validatePdf(bytes);const text=await extractPdfText(bytes);assert.ok(text.includes('Known SKU 100'));assert.ok(text.includes('325'));row.checks.push('last row and evaluated formula value present; independent sheet coverage still required');}
      else if(route==='edit-image'){const info=await driver.inspectImage(bytes,'image/webp');assert.deepEqual([info.width,info.height],[1600,2400]);row.checks.push('rotated WebP dimensions 1600x2400');}
      else if(route==='protect-pdf'){await assert.rejects(()=>decryptPDF(bytes,'wrong'));await pdf(Buffer.from(await decryptPDF(bytes,'SyntheticQA7631')));row.checks.push('wrong password rejected; correct password decrypts');}
      else {await pdf(bytes,route==='pdf-ocr'?2:36);if(route==='pdf-ocr'){const text=await extractPdfText(bytes);assert.ok(text.includes('8675309'));assert.ok(text.includes('12345'));}}
    }else if(route==='pdf'){
      row.fixture=[file];await driver.setFiles('#pdf-input',file);await driver.waitFor('#pdf-work',{timeout:90000});const bytes=await finish('#pdf-process','#pdf-result','#pdf-download');await pdf(bytes);assert.ok((await extractPdfText(bytes)).includes('GROUND TRUTH PAGE 36'));assert.ok(bytes.length<=(await readFile(file)).length);row.checks.push('known native text retained; output no larger than source');
    }else if(['compress-image','heic-to-jpg','image-converter','resize-image'].includes(route)){
      const heic=route==='heic-to-jpg',convert=route==='image-converter',resize=route==='resize-image';
      const input=heic?'tests/fixtures/libheif-example.heic':corpus+'detailed.jpg';row.fixture=[input];
      await driver.setFiles(convert?'#converter-input':resize?'[data-resize-input]':'#file-input',input);
      await driver.waitFor(convert?'#converter-work':resize?'[data-resize-editor]':'#work-state',{timeout:90000});
      if(convert)await driver.setValue('#converter-format','image/webp','change');
      if(resize){await set('[data-resize-width]',1200);await driver.waitUntil('return document.querySelector("[data-resize-height]")?.value === "800"',[],30000,'aspect lock');}
      const bytes=await finish(convert?'#converter-submit':resize?'[data-resize-run]':'#process-file',convert?'#converter-result':resize?'[data-resize-result]':'#result-state',convert?'#converter-download':resize?'[data-resize-download]':'#download-result');
      const info=await driver.inspectImage(bytes,convert?'image/webp':'image/jpeg');assert.ok(info.variance>1000);if(!heic)assert.deepEqual([info.width,info.height],resize?[1200,800]:[2400,1600]);row.checks.push(`decoded ${info.width}x${info.height}; nonblank`);
    }else if(route==='remove-background'){
      row.fixture=[corpus+'product.png'];await driver.setFiles('[data-background-input]',row.fixture[0]);await driver.waitFor('[data-background-editor]');const bytes=await finish('[data-background-process]','[data-background-result]','[data-background-download]');const info=await driver.inspectImage(bytes,'image/png');assert.deepEqual([info.width,info.height],[1600,1000]);assert.ok(info.transparent>0&&info.opaque>0);row.checks.push('original dimensions; nonempty alpha cutout; edge metrics in separate ground-truth audit');
    }else if(route==='doc-scanner'){
      row.fixture=[small+'photographed-document.png'];await driver.setFiles('[data-scanner-input]',row.fixture[0]);await driver.waitFor('[data-scanner-workspace]',{timeout:90000});for(let i=2;i<=4;i++){await driver.setFiles('[data-scanner-input]',row.fixture[0]);await driver.waitUntil('return document.querySelectorAll("[data-page-list] li").length===arguments[0]',[i],60000,'scanner page added');}await driver.check('[data-export-format][value="pdf"]');const bytes=await finish('[data-export-run]','[data-export-result]','[data-export-download]');await pdf(bytes,4);
    }else throw new Error(`No complex test for registry route ${route}`);
    row.network=await driver.privacyRequests();assert.deepEqual(row.network.filter(r=>!['GET','HEAD'].includes(r.method)),[]);row.checks.push('no non-GET/HEAD processing request or WebSocket observed');
    assert.deepEqual(row.errors,[],'uncaught page errors');await driver.screenshot(`${root}/screenshots/${route}.png`);await resetJourney(driver,root,route,row);row.status='PASS';
  }catch(e){row.failure=e.message;try{await driver.screenshot(`${root}/screenshots/${route}-fail.png`);}catch{}}
  finally{await driver.stop();row.elapsedMs=Date.now()-started;results.push(row);await writeFile(`${root}/results.json`,JSON.stringify(results,null,2));console.log(`${row.status} ${route} ${Math.round(row.elapsedMs/1000)}s ${row.failure||row.checks.join('; ')}`);}
}
console.log(JSON.stringify({tested:results.length,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length}));
if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
