import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { PlaywrightAuditDriver } from './playwright-audit-driver.mjs';
const root=process.env.SORA_BG_CLEANUP==='1'?'.artifacts/astra-background-cleanup':'.artifacts/astra-background';await mkdir(`${root}/downloads`,{recursive:true});
const driver=new PlaywrightAuditDriver({downloadDir:`${root}/downloads`});const results=[];
try{
  await driver.start();await driver.navigate('http://127.0.0.1:4321/remove-background');
  for(const kind of ['hair','product','thin','logo','signature','soft','soft-alpha','logo-alpha']){
    const row={fixture:kind,status:'FAIL'},started=Date.now();
    try{
      await driver.navigate('http://127.0.0.1:4321/remove-background');await driver.installPrivacyProbe();
      await driver.setFiles('[data-background-input]',`.artifacts/astra-complex/${kind}.png`);
      await driver.waitFor('[data-background-editor]');
      if(process.env.SORA_BG_CLEANUP==='1')await driver.page.locator('[data-background-cleanup]').check();
      await driver.click('[data-background-process]');
      await driver.page.waitForFunction(()=>!document.querySelector('[data-background-result]').hidden||!document.querySelector('[data-background-error]').hidden,{},{timeout:240000});
      if(await driver.page.locator('[data-background-error]').isVisible()){row.status='REJECTED';row.message=await driver.text('[data-background-error]');}
      else{row.output=await driver.waitForDownload(()=>driver.click('[data-background-download]'),{timeout:30000});row.status='EXPORTED';}
      row.network=await driver.privacyRequests();assert.deepEqual(row.network.filter(r=>!['GET','HEAD'].includes(r.method)),[]);
    }catch(error){row.message=error.message;}
    row.elapsedMs=Date.now()-started;results.push(row);await writeFile(`${root}/results.json`,JSON.stringify(results,null,2));console.log(`${row.status} ${kind} ${Math.round(row.elapsedMs/1000)}s ${row.message||row.output}`);
  }
}finally{await driver.stop();}
