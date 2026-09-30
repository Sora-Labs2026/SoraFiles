import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge'});
const results=[];
try{
 for(const theme of ['light','dark'])for(const width of [1440,390]){
  const pages=await Promise.all([4397,4395].map(async port=>{const page=await browser.newPage({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'});await page.goto(`http://127.0.0.1:${port}/`);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);return page}));
  const [reference,actual]=pages;
  for(const selector of ['main h2','.tool-card__name','.tool-card__desc','.site-nav','.site-footer__col','.privacy__copy','.promo__copy']){
   const texts=await Promise.all(pages.map(page=>page.locator(selector).allTextContents().then(items=>items.map(t=>t.replace(/\s+/g,' ').trim()))));
   if(selector==='main h2')texts[0]=texts[0].filter(t=>t!=='Tools');
   assert.deepEqual(texts[1],texts[0],`${selector}, ${theme}, ${width}`);
  }
  assert.equal(await actual.locator('.tool-card:visible').count(),width<640?10:26);
  for(const page of pages)await page.locator('input[type=search]').fill('shrink');
  assert.deepEqual(await actual.locator('.tool-card:visible .tool-card__name').allTextContents(),await reference.locator('.tool-card:visible .tool-card__name').allTextContents());
  for(const page of pages)await page.locator('input[type=search]').fill('no-such-tool');
  assert.equal((await actual.locator('.tools-empty').innerText()).replace(/\s+/g,' ').trim(),(await reference.locator('.tools-empty').innerText()).replace(/\s+/g,' ').trim());
  for(const page of pages)await page.getByRole('button',{name:'Clear search',exact:true}).last().click();
  for(const id of ['merge','compress','split','rotate']){
   for(const page of pages)await page.locator(`[data-testid=hero-scene-dot-${id}]`).click();
   await actual.waitForTimeout(50);
   const text=await Promise.all(pages.map(page=>page.locator('.pw__stage').innerText().then(t=>t.replace(/\s+/g,' ').trim())));
   assert.equal(text[1],text[0],id+' scene');
  }
  const rects=await Promise.all(pages.map(page=>page.evaluate(()=>Object.fromEntries(['.tool-grid','.privacy','.promo'].map(selector=>{const box=document.querySelector(selector).getBoundingClientRect();return[selector,{width:box.width,height:box.height}]})))));
  for(const selector of Object.keys(rects[0]))for(const prop of ['width','height'])assert.ok(Math.abs(rects[0][selector][prop]-rects[1][selector][prop])<1,`${selector} ${prop},${width}: ${rects[0][selector][prop]} vs ${rects[1][selector][prop]}`);
  results.push({theme,width,status:'PASS'});for(const page of pages)await page.close();
 }
 await writeFile('.artifacts/v10-review/prototype-home-parity.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close()}
