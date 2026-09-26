import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { liveTools } from '../../src/data/liveTools.ts';
import { PlaywrightAuditDriver } from './playwright-audit-driver.mjs';
const root='.artifacts/astra-boundary';await mkdir(root,{recursive:true});const results=[];
const selectors={pdf:['#pdf-input','#pdf-file-error','.artifacts/astra-corpus/mixed-content.pdf','#pdf-work'], 'compress-image':['#file-input','#file-error','.artifacts/astra-corpus/landscape.jpg','#work-state'],'heic-to-jpg':['#file-input','#file-error','tests/fixtures/libheif-example.heic','#work-state'],'image-converter':['#converter-input','#converter-error','.artifacts/astra-corpus/landscape.jpg','#converter-work'],'resize-image':['[data-resize-input]','[data-resize-error]','.artifacts/astra-corpus/landscape.jpg','[data-resize-editor]'],'remove-background':['[data-background-input]','[data-background-error]','.artifacts/astra-corpus/background-subject.png','[data-background-editor]'],'doc-scanner':['[data-scanner-input]','[data-scanner-error]','.artifacts/astra-corpus/photographed-document.png','[data-scanner-workspace]']};
for(const tool of liveTools){
 const row={tool:tool.name,route:tool.slug,status:'FAIL',checks:[]};const driver=new PlaywrightAuditDriver({downloadDir:`${root}/downloads`});
 try{
  await driver.start();await driver.setViewport(390,844);await driver.navigate(`http://127.0.0.1:4321/${tool.slug}`);await driver.installPrivacyProbe();
  let contract=selectors[tool.slug];
  if(!contract){const doc=await driver.exists('#action-input');contract=doc?['#action-input','#action-error',tool.slug==='word-to-pdf'?'.artifacts/astra-corpus/simple.docx':tool.slug==='jpg-to-pdf'?'.artifacts/astra-corpus/landscape.jpg':'.artifacts/astra-corpus/native-text-3-pages.pdf','#action-work']:['[data-extra-input]','[data-extra-error]',tool.slug==='excel-to-pdf'?'.artifacts/astra-corpus/workbook.xlsx':tool.slug==='edit-image'?'.artifacts/astra-corpus/landscape.jpg':'.artifacts/astra-corpus/native-text-3-pages.pdf','[data-extra-selected]'];}
  const [input,error,valid,editor]=contract;const ext=valid.split('.').pop();const mime=ext==='pdf'?'application/pdf':ext==='jpg'?'image/jpeg':ext==='png'?'image/png':ext==='heic'?'image/heic':'application/octet-stream';
  await driver.setFiles(input,{name:`empty.${ext}`,mimeType:mime,buffer:Buffer.alloc(0)});
  await driver.waitFor(error,{timeout:20000});const message=await driver.text(error);assert.ok(message.trim().length>8);row.checks.push(`zero-byte rejection: ${message.trim()}`);
  assert.equal(await driver.page.locator('a[download][href^="blob:"]:visible').count(),0,'invalid file exposed download');
  await driver.setFiles(input,valid);await driver.waitFor(tool.slug==='edit-image'?'[data-edit-editor]':editor,{timeout:90000});row.checks.push('valid file opens after rejection');
  // Keyboard focus must stay within the active modal and Escape must either close or ask to discard.
  await driver.page.waitForFunction(()=>!!document.activeElement?.closest('[data-adaptive-workspace]'),{},{timeout:5000});
  await driver.page.keyboard.press('Tab');const focus=await driver.page.evaluate(()=>({tag:document.activeElement?.tagName,inside:!!document.activeElement?.closest('[data-adaptive-workspace]')}));assert.ok(focus.inside);row.checks.push('Tab focus remains in workspace');
  await driver.page.keyboard.press('Escape');await driver.page.waitForFunction(()=>!!document.querySelector('[data-workspace-discard]:not([hidden])')||!!document.querySelector('[data-adaptive-workspace][hidden]'),{},{timeout:5000});row.checks.push('Escape closes or offers discard');
  row.network=await driver.privacyRequests();assert.deepEqual(row.network.filter(r=>!['GET','HEAD'].includes(r.method)),[]);row.status='PASS';
 }catch(e){row.failure=e.message;try{await driver.screenshot(`${root}/${tool.slug}-fail.png`);}catch{}}
 finally{await driver.stop();results.push(row);await writeFile(`${root}/results.json`,JSON.stringify(results,null,2));console.log(`${row.status} ${tool.slug} ${row.failure||row.checks.join('; ')}`);}
}
