import assert from 'node:assert/strict';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { PlaywrightAuditDriver } from './playwright-audit-driver.mjs';
import { validatePdf } from './output-validators.mjs';
const root='.artifacts/astra-office-cancel';await mkdir(root+'/downloads',{recursive:true});
const d=new PlaywrightAuditDriver({downloadDir:root+'/downloads'}),rows=[];
try{
 await d.start();
 for(const route of ['word-to-pdf','excel-to-pdf']){
  const row={route,status:'FAIL'};
  try{
   await d.navigate('http://127.0.0.1:4321/'+route);
   const word=route==='word-to-pdf',input=word?'#action-input':'[data-extra-input]',run=word?'#action-process':'[data-extra-start]';
   const result=word?'#action-result':'[data-extra-results]',link=word?'#action-download':'[data-extra-result-list] a[download]';
   const workers=new Set();d.page.on('worker',w=>{workers.add(w);w.on('close',()=>workers.delete(w));});
   await d.setFiles(input,word?'.artifacts/astra-complex/complex.docx':'.artifacts/astra-complex/complex.xlsx');
   await d.click(run);await d.page.waitForFunction(()=>!!document.querySelector('[data-office-runtime]'));
   const deadline=Date.now()+120000;while(!workers.size&&Date.now()<deadline)await d.page.waitForTimeout(100);
   assert.ok(workers.size>0,'Office workers actually started');row.workersBeforeCancel=workers.size;
   await d.click('[data-workspace-close]');if(await d.page.locator('[data-workspace-discard]').isVisible())await d.click('[data-workspace-confirm-discard]');
   await d.page.waitForFunction(()=>!document.querySelector('[data-office-runtime]'));
   const stopped=Date.now()+5000;while(workers.size&&Date.now()<stopped)await d.page.waitForTimeout(100);
   assert.equal(workers.size,0,'cancel must terminate all Office workers');assert.equal(await d.page.locator(result).isVisible(),false);
   await d.setFiles(input,word?'.artifacts/astra-complex/complex.docx':'.artifacts/astra-complex/complex.xlsx');await d.click(run);await d.waitFor(result,{timeout:240000});
   row.output=await d.waitForDownload(()=>d.click(link));await validatePdf(await readFile(row.output));
   assert.equal(await d.page.locator('[data-office-runtime]').count(),0);row.status='PASS';row.check='workers terminated on cancel; immediate retry exported valid PDF; runtime removed after success';
  }catch(e){row.error=e.message;}
  rows.push(row);await writeFile(root+'/results.json',JSON.stringify(rows,null,2));console.log(`${row.status} ${route} ${row.error||row.check}`);
 }
}finally{await d.stop();}
if(rows.some(r=>r.status==='FAIL'))process.exitCode=1;
