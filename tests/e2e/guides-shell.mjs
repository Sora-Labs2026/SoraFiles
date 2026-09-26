import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const root='.artifacts/astra-guides';await mkdir(root,{recursive:true});const rows=[];
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();
  const response=await page.goto('http://127.0.0.1:4321/guides');assert.equal(response.status(),200);
  const info=await page.evaluate(()=>({h1:document.querySelectorAll('h1').length,canonical:document.querySelector('link[rel="canonical"]')?.href,robots:document.querySelector('meta[name="robots"]')?.content,hreflang:document.querySelectorAll('link[hreflang]').length,overflow:document.documentElement.scrollWidth>innerWidth,article:document.body.textContent.includes('test-fixture')}));
  assert.equal(info.h1,1);assert.equal(info.canonical,'https://sorafiles.com/guides');assert.match(info.robots,/noindex/);assert.equal(info.hreflang,0);assert.equal(info.overflow,false);assert.equal(info.article,false);
  await page.screenshot({path:`${root}/guides-${width}.png`,fullPage:true});rows.push({width,status:'PASS',info});
  for(const path of ['/guides/test-fixture','/fr/guides']){const response=await page.goto('http://127.0.0.1:4321'+path);assert.equal(response.status(),404);rows.push({path,status:'PASS',httpStatus:404});}
  await context.close();
 }
}finally{await browser.close();}
await writeFile(`${root}/results.json`,JSON.stringify(rows,null,2));console.log('PASS: empty Guides hub desktop/mobile; noindex and no hreflang; fixture and translated routes return 404.');
