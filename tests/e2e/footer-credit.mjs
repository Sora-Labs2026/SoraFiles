import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {PlaywrightAuditDriver} from './playwright-audit-driver.mjs';
const root='.artifacts/astra-footer';await mkdir(root,{recursive:true});const rows=[];
const d=new PlaywrightAuditDriver({downloadDir:root+'/downloads'});
try{
 await d.start();
 for(const width of [1440,390,320])for(const theme of ['light','dark']){
  await d.setViewport(width,900);await d.page.emulateMedia({colorScheme:theme});await d.navigate((process.env.SORA_BASE_URL||'http://127.0.0.1:4321')+'/');
  await d.page.evaluate(theme=>document.documentElement.classList.toggle('dark',theme==='dark'),theme);
  const footer=d.page.locator('footer[data-testid="site-footer"]');await footer.scrollIntoViewIfNeeded();
  const link=footer.getByRole('link',{name:'Drishya Thapa',exact:true});
  await link.scrollIntoViewIfNeeded();await d.page.waitForTimeout(250);
  assert.equal(await link.getAttribute('href'),'https://x.com/Dri_shy_a');assert.equal(await link.getAttribute('target'),'_blank');assert.equal(await link.getAttribute('rel'),'noopener noreferrer');
  assert.equal((await link.locator('..').innerText()).trim(),'Made with ❤️ by Drishya Thapa');assert.equal(await link.locator('..').locator('a').count(),1);
  await link.focus();await d.page.keyboard.press('Shift+Tab');await d.page.keyboard.press('Tab');assert.equal(await link.evaluate(n=>n===document.activeElement),true);
  const style=await link.evaluate(n=>({outline:getComputedStyle(n).outlineWidth,overflow:document.documentElement.scrollWidth>innerWidth}));assert.equal(style.overflow,false);assert.notEqual(style.outline,'0px');
  await footer.screenshot({path:`${root}/${width}-${theme}.png`});rows.push({width,theme,status:'PASS',...style});
 }
}finally{await d.stop();await writeFile(root+'/results.json',JSON.stringify(rows,null,2));}
console.log('PASS: footer credit, exact destination/security attributes, keyboard focus, natural wrapping; 3 widths × 2 themes.');
