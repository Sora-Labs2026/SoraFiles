import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { PlaywrightAuditDriver } from './playwright-audit-driver.mjs';
import { validatePdf } from './output-validators.mjs';
const root='.artifacts/astra-session';await mkdir(`${root}/downloads`,{recursive:true});
const selected=process.env.SORA_SESSION_CASE;
const rows=selected?JSON.parse(await readFile(`${root}/results.json`,'utf8')).filter(r=>r.name!==selected):[];
async function test(name,fn,init){if(selected&&name!==selected)return;const driver=new PlaywrightAuditDriver({downloadDir:`${root}/downloads`});const row={name,status:'FAIL'};try{await driver.start();if(init)await driver.context.addInitScript(init);await fn(driver,row);row.status='PASS';}catch(e){row.error=e.message;}finally{await driver.stop();rows.push(row);await writeFile(`${root}/results.json`,JSON.stringify(rows,null,2));console.log(`${row.status} ${name} ${row.error||row.evidence||''}`);}}
const page='http://127.0.0.1:4321';
await test('warm offline rotation, download and reload',async(d,row)=>{
 await d.navigate(page+'/rotate-pdf');await d.page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});await d.page.reload();
 const run=async()=>{await d.setFiles('#action-input','.artifacts/astra-corpus/native-text-3-pages.pdf');await d.waitFor('#action-work');await d.click('[data-pdf-rotate="90"]');await d.click('#action-process');await d.waitFor('#action-result');const file=await d.waitForDownload(()=>d.click('#action-download'));await validatePdf(await readFile(file),{pageCount:3});return file;};
 await run();row.cache=await d.page.evaluate(async()=>{const result={};for(const name of await caches.keys())result[name]=(await (await caches.open(name)).keys()).map(r=>r.url);return result;});
 await d.context.setOffline(true);await d.page.reload({waitUntil:'domcontentloaded'});row.output=await run();row.evidence='Previously visited route reloads offline; cached tool exports a valid 3-page PDF. Local QA registered the production service worker explicitly because production registration requires HTTPS.';
});
await test('background cancel and stale result suppression',async(d,row)=>{
 await d.navigate(page+'/remove-background');await d.setFiles('[data-background-input]','.artifacts/astra-corpus/background-subject.png');await d.waitFor('[data-background-editor]');await d.click('[data-background-process]');await d.click('[data-background-cancel]');await d.page.waitForTimeout(1500);assert.equal(await d.page.locator('[data-background-result]').isVisible(),false);assert.equal(await d.page.locator('[data-background-process]').isEnabled(),true);
 await d.setFiles('[data-background-input]',{name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('invalid')});await d.waitFor('[data-background-error]');assert.equal(await d.page.locator('a[download][href^="blob:"]:visible').count(),0);row.evidence='Cancel returns control; invalid replacement has a visible error and cannot expose the previous download.';
});
await test('OCR reset aborts old job and hides stale download',async(d,row)=>{
 await d.navigate(page+'/pdf-ocr');await d.setFiles('[data-extra-input]','.artifacts/astra-corpus/scanned-document.pdf');await d.waitFor('[data-extra-selected]');await d.click('[data-extra-start]');await d.waitFor('[data-extra-cancel]');
 await d.click('[data-workspace-close]');if(await d.page.locator('[data-workspace-discard]').isVisible())await d.click('[data-workspace-confirm-discard]');
 await d.page.waitForTimeout(2000);assert.equal(await d.page.locator('[data-extra-results]').isVisible(),false);assert.equal(await d.page.locator('[data-adaptive-workspace]').isVisible(),false);
 await d.setFiles('[data-extra-input]','.artifacts/astra-corpus/native-text-3-pages.pdf');await d.waitFor('[data-extra-selected]');assert.equal(await d.page.locator('[data-extra-start]').isEnabled(),true);row.evidence='Closing active OCR cancels its job; no late result appears, and a new file opens normally.';
});
await test('background static asset failure',async(d,row)=>{
 await d.context.route(/staticimgly\.com|__sf\/background-removal/,route=>route.abort());await d.navigate(page+'/remove-background');await d.setFiles('[data-background-input]','.artifacts/astra-corpus/background-subject.png');await d.waitFor('[data-background-editor]');await d.click('[data-background-process]');await d.waitFor('[data-background-error]',{timeout:30000});assert.equal(await d.page.locator('[data-background-result]').isVisible(),false);row.evidence=await d.text('[data-background-error]');
});
await test('background CPU fallback without WebGPU',async(d,row)=>{
 await d.navigate(page+'/remove-background');assert.equal(await d.page.evaluate(()=> 'gpu' in navigator),false);await d.setFiles('[data-background-input]','.artifacts/astra-corpus/background-subject.png');await d.waitFor('[data-background-editor]');await d.click('[data-background-process]');await d.waitFor('[data-background-result]',{timeout:180000});
 row.output=await d.waitForDownload(()=>d.click('[data-background-download]'));const info=await d.inspectImage(await readFile(row.output),'image/png');assert.ok(info.opaque>0&&info.transparent>0);row.evidence=`WebGPU unavailable: CPU fallback exported a nonempty ${info.width}x${info.height} alpha PNG.`;
},()=>Reflect.deleteProperty(Navigator.prototype,'gpu'));
await test('background low-memory pixel limit',async(d,row)=>{
 await d.navigate(page+'/remove-background');await d.setFiles('[data-background-input]','.artifacts/astra-complex/near-limit-36mp.png');await d.waitFor('[data-background-error]');row.evidence=await d.text('[data-background-error]');assert.match(row.evidence,/12/);
},()=>Object.defineProperty(navigator,'deviceMemory',{get:()=>4}));
await test('image compressor over pixel limit',async(d,row)=>{
 await d.navigate(page+'/compress-image');await d.setFiles('#file-input','.artifacts/astra-complex/near-limit-36mp.png');await d.waitFor('#file-error');row.evidence=await d.text('#file-error');assert.match(row.evidence,/32|megapixel/);
});
await test('reduced motion and small-screen shell',async(d,row)=>{
 await d.page.emulateMedia({reducedMotion:'reduce'});await d.setViewport(390,844);await d.navigate(page+'/');
 const result=await d.page.evaluate(()=>({reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,overflow:document.documentElement.scrollWidth>innerWidth,animations:document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getComputedTiming().duration>1).length}));assert.equal(result.reduced,true);assert.equal(result.overflow,false);assert.equal(result.animations,0);row.evidence=JSON.stringify(result);await d.screenshot(`${root}/reduced-motion-mobile.png`);
});
