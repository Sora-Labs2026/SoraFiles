import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.SORA_BASE_URL??'http://127.0.0.1:4396';
const out='.artifacts/v10-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
const results=[];const errors=[];
try{
 for(const theme of ['light','dark']){
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});
   const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
   for(const route of ['/','/tools','/merge-pdf','/desktop','/desktop/pricing','/desktop/download','/desktop/help','/desktop/releases','/desktop/redeem','/guides','/privacy','/contact','/ar/']){
    const response=await page.goto(base+route);assert.equal(response.status(),200,route);
    await page.locator('main#main').waitFor();await page.evaluate(()=>document.fonts.ready);
    const dimensions=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth,theme:document.documentElement.dataset.theme}));
    assert.ok(dimensions.content<=width+1,`${route} ${width} overflows ${dimensions.content}`);
    assert.equal(dimensions.theme,theme,'System theme');
    assert.equal(await page.locator('main h1').count(),1,route+' has one main heading');
    assert.equal(await page.locator('a[href="#"]').count(),0,route+' has no dead placeholder links');
    await page.screenshot({path:out+'/'+(route==='/'?'home':route.replaceAll('/','_'))+'-'+width+'-'+theme+'.png',fullPage:false});
    results.push({route,width,theme,overflow:false});
   }
   await page.goto(base+'/');
   assert.equal(await page.locator('[data-tool-search-item]:visible').count(),26);
   await page.locator('[data-live-tool-search]').fill('merge');
   assert.equal(await page.locator('[data-tool-search-item]:visible').count(),1);
   assert.match(await page.locator('[data-tool-search-item]:visible a').getAttribute('href'),/merge-pdf/);
   await page.locator('[data-live-tool-search]').fill('no-such-tool-xyz');
   await page.locator('[data-tools-empty]').waitFor({state:'visible'});
   await page.locator('[data-reset-search]').click();
   assert.equal(await page.locator('[data-tool-search-item]:visible').count(),26);
   await page.locator('[data-home-filter="image"]').click();
   assert.ok(await page.locator('[data-tool-search-item]:visible').count()>0);
   assert.ok(await page.locator('[data-tool-search-item]:visible').count()<26);
   await page.locator('[data-scene-button="rotate"]').click();
   assert.equal(await page.locator('[data-preview-scene="rotate"]').isVisible(),true);
   assert.equal(await page.locator('[data-hero-visualization]').getAttribute('data-running'),'false','Reduced motion');
   await page.goto(base+'/desktop/pricing');
   await page.locator('[data-billing-period="lifetime"]').click();
   assert.equal(await page.locator('[data-plan-period="lifetime"]:visible').count(),2);
   assert.equal(await page.locator('[data-plan-period="monthly"]:visible').count(),0);
   await context.close();
  }
 }
 const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'dark'});
 const page=await context.newPage();await page.goto(base+'/');
 await page.locator('[data-theme-choice="light"]:visible').click();
 await page.reload();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
 await page.locator('[data-hero-visualization]').scrollIntoViewIfNeeded();
 await page.mouse.move(0,0);await page.locator('h1').click();
 const before=await page.locator('.pw__title').innerText();await page.waitForTimeout(4500);
 assert.notEqual(await page.locator('.pw__title').innerText(),before,'Automatic purposeful scene progression');
 await context.close();
 assert.deepEqual(errors,[],'No page JavaScript errors');
 await writeFile(out+'/report.json',JSON.stringify({checks:results.length,results,errors},null,2));
 console.log(`V10 shell: ${results.length} route/theme/viewport checks, search/filter/preview/billing controls and theme persistence passed.`);
}finally{await browser.close()}
