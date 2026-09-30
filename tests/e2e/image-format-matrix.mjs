import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { PlaywrightAuditDriver } from './playwright-audit-driver.mjs';
const root='.artifacts/astra-formats';await mkdir(root+'/downloads',{recursive:true});
const d=new PlaywrightAuditDriver({downloadDir:root+'/downloads'}), rows=[];
const files=['known.jpg','known.png','known.webp','known.bmp','known.gif','known.avif','known.tiff','multipage.tiff','animated.gif','known.ico','known.svg','known.psd','known.jp2','corrupt.psd','corrupt.tiff','corrupt.jp2','corrupt.png','corrupt.svg'];
try{
 await d.start();
 for(const name of files){
  const row={fixture:name,status:'FAIL'};
  try{
   await d.navigate((process.env.SORA_BASE_URL || 'http://127.0.0.1:4321')+'/image-converter');await d.installPrivacyProbe();
   await d.setFiles('#converter-input',root+'/'+name);
   await d.page.waitForFunction(()=>!document.querySelector('#converter-work').hidden||!document.querySelector('#converter-error').hidden);
   if(name.startsWith('corrupt')){assert.equal(await d.page.locator('#converter-error').isVisible(),true);row.check='visible rejection; no output';}
   else{
    assert.equal(await d.page.locator('#converter-error').isVisible(),false,await d.text('#converter-error'));
    await d.setValue('#converter-format','image/png','change');await d.click('#converter-submit');await d.waitFor('#converter-result');
    row.output=await d.waitForDownload(()=>d.click('#converter-download'));const info=await d.inspectImage(await readFile(row.output),'image/png');
    assert.deepEqual([info.width,info.height],name.endsWith('.ico')?[256,256]:[640,480]);assert.ok(info.variance>1000);row.check='PNG decodes at expected dimensions';
   }
   row.network=await d.privacyRequests();assert.ok(row.network.every(r=>['GET','HEAD'].includes(r.method)));row.status='PASS';
  }catch(e){row.error=e.message;}
  rows.push(row);await writeFile(root+'/results.json',JSON.stringify(rows,null,2));console.log(`${row.status} ${name} ${row.error||row.check}`);
 }
}finally{await d.stop();}
if(rows.some(r=>r.status==='FAIL'))process.exitCode=1;
