import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {liveTools} from '../../src/data/liveTools.ts';
import {PlaywrightAuditDriver} from './playwright-audit-driver.mjs';
const root='.artifacts/astra-ux-stress';await mkdir(root,{recursive:true});
const prior=process.env.SORA_UX_STRESS_RETRY==='1'?JSON.parse(await readFile(root+'/results.json','utf8')):[];
const retry=prior.filter(r=>r.status!=='PASS');const rows=prior.filter(r=>r.status==='PASS');
const special={pdf:['#pdf-input','.artifacts/astra-corpus/native-text-3-pages.pdf'],'compress-image':['#file-input','.artifacts/astra-corpus/landscape.jpg'],'heic-to-jpg':['#file-input','tests/fixtures/libheif-example.heic'],'image-converter':['#converter-input','.artifacts/astra-corpus/landscape.jpg'],'resize-image':['[data-resize-input]','.artifacts/astra-corpus/landscape.jpg'],'remove-background':['[data-background-input]','.artifacts/astra-corpus/background-subject.png'],'doc-scanner':['[data-scanner-input]','.artifacts/astra-corpus/photographed-document.png']};
const primary={pdf:'#pdf-process','compress-image':'#process-file','heic-to-jpg':'#process-file','image-converter':'#converter-submit','resize-image':'[data-resize-run]','remove-background':'[data-background-process]','doc-scanner':'[data-export-run]'};
for(const width of [1440,320])for(const tool of liveTools){
 if(prior.length&&!retry.some(r=>r.width===width&&r.route===tool.slug))continue;
 const d=new PlaywrightAuditDriver({downloadDir:root+'/downloads'}),row={route:tool.slug,width,status:'FAIL'};
 try{
  await d.start();await d.setViewport(width,width===320?500:900);await d.page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});await d.navigate('http://127.0.0.1:4321/'+tool.slug);await d.page.evaluate(()=>document.documentElement.classList.add('dark'));
  const doc=await d.exists('#action-input');
  const [input,path]=special[tool.slug]||[doc?'#action-input':'[data-extra-input]',tool.slug==='word-to-pdf'?'.artifacts/astra-corpus/simple.docx':tool.slug==='excel-to-pdf'?'.artifacts/astra-corpus/workbook.xlsx':tool.slug==='jpg-to-pdf'||tool.slug==='edit-image'?'.artifacts/astra-corpus/landscape.jpg':'.artifacts/astra-corpus/native-text-3-pages.pdf'];
  const ext=path.split('.').pop(),mime={pdf:'application/pdf',jpg:'image/jpeg',png:'image/png',heic:'image/heic'}[ext]||'application/octet-stream';
  const file={name:'A long project filename with spaces — café — '+ 'review-copy-'.repeat(12)+'.'+ext,mimeType:mime,buffer:await readFile(path)};
  await d.setFiles(input,tool.slug==='merge-pdf'?[file,{...file,name:'second-'+file.name}]:file);
  await d.page.locator('[data-adaptive-workspace]:not([hidden])').waitFor();
  await d.page.waitForTimeout(650);
  const button=primary[tool.slug]||(doc?'#action-process':'[data-extra-start]');
  await d.revealPanel(button);await d.page.locator(button).scrollIntoViewIfNeeded();
  await d.page.waitForTimeout(350);
  const position=await d.page.locator(button).evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {width:r.width,height:r.height,uncovered:hit===el||el.contains(hit),hit:hit?.outerHTML.slice(0,180),overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.equal(position.overflow,false);assert.equal(position.uncovered,true,'primary action covered');assert.ok(position.height>=44);
  const fields=d.page.locator('[data-adaptive-workspace] input:not(.sr-only):not([type="hidden"]):not([type="file"]):not([type="range"]):not([type="checkbox"]):not([type="radio"]):visible');
  if(await fields.count()){await fields.first().focus();await fields.first().scrollIntoViewIfNeeded();assert.equal(await fields.first().evaluate(el=>el===document.activeElement),true);}
  await d.page.keyboard.press('Tab');assert.equal(await d.page.evaluate(()=>!!document.activeElement?.closest('[data-adaptive-workspace]')),true);
  await d.page.locator('[data-workspace-close]').click();if(await d.page.locator('[data-workspace-discard]').isVisible())await d.page.locator('[data-workspace-confirm-discard]').click();
  await d.page.waitForFunction(()=>!!document.querySelector('[data-adaptive-workspace][hidden]'));row.status='PASS';row.evidence={...position,longFilename:true,dark:true,reducedMotion:true,constrainedHeight:width===320};
 }catch(e){row.error=e.message;await d.screenshot(`${root}/${tool.slug}-${width}-fail.png`).catch(()=>{});}finally{await d.stop();rows.push(row);await writeFile(root+'/results.json',JSON.stringify(rows,null,2));console.log(`${row.status} ${tool.slug} ${width} ${row.error||''}`);}
}
if(rows.some(r=>r.status==='FAIL'))process.exitCode=1;
