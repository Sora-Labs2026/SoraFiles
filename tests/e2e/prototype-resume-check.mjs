import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:4395',browser=await chromium.launch({channel:'msedge'}),errors=[],checks=[];
try{
 for(const theme of ['light','dark'])for(const width of [1440,1102,390]){
  const page=await browser.newPage({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'});page.on('pageerror',error=>errors.push(error.message));
  for(const route of ['/tools','/contact','/guides','/guides/what-local-file-processing-means','/guides/what-is-sorafiles-desktop','/desktop','/desktop/pricing','/desktop/download','/desktop/help','/desktop/releases','/desktop/redeem']){
   assert.equal((await page.goto(base+route)).status(),200);await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('main h1').count(),1,route);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route} overflow ${width}`);
   assert.equal(await page.locator('a[href="#checkout"]').count(),0);
   if(route==='/desktop/download'){
    const sums=await page.locator('.dl-table__sum').evaluateAll(cells=>cells.map(cell=>{
     const range=document.createRange();range.selectNodeContents(cell);
     const button=cell.nextElementSibling.querySelector('a').getBoundingClientRect(),box=cell.getBoundingClientRect();
     return {hash:cell.textContent,contained:[...range.getClientRects()].every(rect=>rect.right<=box.right-1),separate:[...range.getClientRects()].every(rect=>rect.right<button.left||rect.bottom<=button.top)};
    }));
    assert.equal(sums.length,5);for(const sum of sums){assert.match(sum.hash,/^[a-f0-9]{64}$/);assert.equal(sum.contained,true,'Full checksum stays in its column');assert.equal(sum.separate,true,'Checksum does not touch Download')}
   }
   if(route==='/tools'){
    await page.locator('input[type=search]').fill('image');
    assert.equal(await page.locator('.tool-card[data-top]').count(),1);
    assert.equal(await page.locator('.tool-card[data-top] .tool-card__enter:visible').count(),1);
    await page.locator('input[type=search]').fill('no-such-tool');assert.equal(await page.locator('.tools-empty:visible').count(),1);
   }
   if(route==='/contact'){
    assert.equal(await page.locator('input[name=_captcha]').inputValue(),'true');
    assert.equal(await page.locator('input[name=_autoresponse]').count(),1);
    let submissions=0;await page.route('https://formsubmit.co/**',route=>{submissions++;return route.abort()});
    await page.getByRole('button',{name:'Send message'}).click();assert.equal(await page.locator('[aria-invalid=true]').count(),4);assert.equal(submissions,0);
    await page.locator('[name=attachment]').setInputFiles({name:'example.txt',mimeType:'text/plain',buffer:Buffer.from('local validation fixture')});
    assert.equal(await page.locator('[data-contact-file-name]').textContent(),'example.txt');
    await page.getByRole('button',{name:'Remove attachment'}).click();assert.equal(await page.locator('[name=attachment]').evaluate(el=>el.files.length),0);
   }
   if(route==='/desktop'){
    assert.equal(await page.locator('.fm').getAttribute('data-phase'),'saved');
    await page.getByTestId('demo-step-2').click();assert.equal(await page.locator('.fm__menu').getAttribute('data-open'),'true');
    await page.getByTestId('demo-step-3').click();assert.equal(await page.locator('.fm__sub').getAttribute('data-open'),'true');
    await page.getByTestId('demo-step-4').click();assert.equal(await page.locator('.fm-row--out[data-shown=true]').count(),2);
    const faq=page.getByTestId('faq-question-1');await faq.click();assert.equal(await faq.getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('.benefits__list').evaluate(el=>getComputedStyle(el).opacity),'1','Reduced motion shows all sections');
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`.artifacts/v10-review/desktop-exact-${theme}-${width}.png`,fullPage:true});
   }
   if(route==='/desktop/pricing'){
    for(const [period,amount]of [['monthly','$4.99'],['annual','$49.99'],['lifetime','$249.99']]){
     await page.getByTestId('billing-period-'+period).locator('..').click();
     assert.equal(await page.getByTestId('billing-period-'+period).isChecked(),true);
     assert.equal(await page.locator('.segmented__opt[data-checked]').count(),1,'Only the chosen billing period has selected styling');
     for(const option of await page.locator('.segmented__opt').all())await option.hover();
     assert.equal(await page.locator('.segmented__opt[data-checked]').count(),1,'Hover does not mark other periods selected');
     assert.equal(await page.getByTestId('plan-personal-price').textContent(),amount);
     assert.equal(await page.getByTestId('plan-personal-choose').getAttribute('href'),`https://license.sorafiles.com/v1/checkout?plan=personal-${period}`);
    }
   }
   checks.push({theme,width,route});
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);
 await writeFile('.artifacts/v10-review/resume-check.json',JSON.stringify({checks,errors},null,2));console.log(`PASS ${checks.length} route/theme/viewport checks plus contact, menu animation, directory and live checkout targets. No messages or purchases sent.`);
}finally{await browser.close()}
