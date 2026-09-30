// Tests the built production site; external analytics are blocked during QA.
import {chromium} from 'playwright';import {createServer} from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';import {once} from 'node:events';import assert from 'node:assert/strict';
const root=resolve('dist'),out=resolve('.artifacts/desktop-website-qa');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://local');let path=url.pathname;if(!extname(path))path=path.replace(/\/$/,'')+'/index.html';const file=resolve(root,'.'+path);if(!file.startsWith(root+sep))throw Error('path');let bytes=await readFile(file);
 // Local fixture preview only. The production bundle remains disabled; query
 // strings on the deployed site cannot enable its promotion.
 if(path==='/index.html'&&url.searchParams.get('qa-promo')==='1')bytes=Buffer.from(bytes.toString('utf8').replace('data-promo-enabled="false"','data-promo-enabled="true"'));
 res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json'}[extname(file)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({...process.env.SORA_BROWSER_EXECUTABLE?{executablePath:process.env.SORA_BROWSER_EXECUTABLE}:{channel:process.env.SORA_BROWSER_CHANNEL||'msedge'},headless:true}),checks=[],errors=[];
const create=async(width,theme,storage='normal')=>{const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());await context.addInitScript(({theme,storage})=>{localStorage.setItem('sora-theme',theme);if(storage==='local-blocked')Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}});if(storage==='both-blocked')for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{get(){throw Error('blocked');}});},{theme,storage});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};};
try{
 {const {context,page}=await create(1280,'light');await page.goto(base);await page.waitForTimeout(3800);assert.equal(await page.locator('[data-desktop-promo]').isVisible(),false);await page.goto(base+'/desktop/redeem?code=synthetic-private-code');await page.getByRole('heading',{name:'Redemption has not opened yet'}).waitFor();assert.equal(new URL(page.url()).search,'');assert.equal(await page.locator('[data-redemption-form]').count(),0);assert.equal(await page.locator('script[src*="analytics.ahrefs.com"]').count(),0);checks.push('Promotion and issuance remain disabled; redemption explains prelaunch status without collecting codes or analytics');await context.close();}
 for(const width of [1280,768,375,320])for(const theme of ['light','dark']){
  const {context,page}=await create(width,theme);await page.goto(base+'/?qa-promo=1');const promo=page.locator('[data-desktop-promo]');await promo.waitFor({state:'visible'});assert.equal(await page.evaluate(()=>document.activeElement.tagName),'BODY');
  const box=await promo.boundingBox(),image=await promo.locator('img').boundingBox(),close=await promo.locator('button').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);assert.ok(box.height<360);assert.equal(Math.round(image.height/image.width*100),133);assert.ok(close.width>=44&&close.height>=44);
  await page.screenshot({path:resolve(out,`popup-${width}-${theme}.png`)});
  await promo.locator('button').click();assert.equal(await promo.isVisible(),false);await page.reload();await page.waitForTimeout(3800);assert.equal(await promo.isVisible(),false);
  for(const path of ['/desktop','/desktop/pricing','/desktop/download','/desktop/releases','/desktop/help']){
   await page.goto(base+path);await page.locator('main h1').waitFor();assert.equal(await page.locator('main h1').count(),1);assert.doesNotMatch(await page.locator('main').innerText(),/desktop is optional|a little less file work/i);assert.equal(await page.locator('a[href="/desktop/redeem"]').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${path} overflow ${width}`);assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,follow');
   assert.equal(await page.locator('img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0)),true);
   if(path==='/desktop'){await page.locator('[data-testid=site-footer]').scrollIntoViewIfNeeded();await page.evaluate(()=>window.scrollTo(0,0));}if(path==='/desktop')await page.screenshot({path:resolve(out,`desktop-${width}-${theme}.png`),fullPage:true});

  }
  checks.push(`${width}px ${theme}: popup bounds, 3:4 image, dismissal after refresh and all five pages`);await context.close();
 }
 {
  const {context,page}=await create(1000,'light');await page.goto(base+'/?qa-promo=1');const promo=page.locator('[data-desktop-promo]');await promo.waitFor({state:'visible'});await promo.locator('button').focus();await page.keyboard.press('Escape');assert.equal(await promo.isVisible(),false);assert.equal(await page.locator('[data-testid="logo-link"]').evaluate(el=>el===document.activeElement),true);
  await page.evaluate(()=>localStorage.removeItem('sora-desktop-promo-dismissed-v1'));await page.evaluate(()=>sessionStorage.removeItem('sora-desktop-promo-dismissed-v1'));await page.reload();await promo.waitFor({state:'visible'});await promo.locator('a').click();assert.equal(new URL(page.url()).pathname,'/desktop');checks.push('Keyboard Escape restores focus; main popup click opens /desktop');await context.close();
 }
 {
  const {context,page}=await create(375,'light','local-blocked');await page.goto(base+'/?qa-promo=1');const promo=page.locator('[data-desktop-promo]');await promo.waitFor({state:'visible'});await promo.locator('button').click();await page.reload();await page.waitForTimeout(3800);assert.equal(await promo.isVisible(),false);checks.push('sessionStorage dismissal fallback');await context.close();
 }
 {
  const {context,page}=await create(375,'light','both-blocked');await page.goto(base+'/?qa-promo=1');await page.waitForTimeout(3800);assert.equal(await page.locator('[data-desktop-promo]').isVisible(),false);checks.push('No repeated promotion when both persistence stores are blocked');await context.close();
 }

 for(const width of [320,430,768,1366,1920,2560])for(const theme of ['light','dark']){
  const {context,page}=await create(width,theme);
  for(const path of ['/','/tools','/pdf','/merge-pdf','/image-converter','/guides','/about','/privacy']){
   await page.goto(base+path);await page.locator('main h1').first().waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,path+' '+width+' '+theme+' overflow');
   await page.locator('[data-testid=site-footer]').scrollIntoViewIfNeeded();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,path+' footer overflow');
  }
  checks.push(width+'px '+theme+': homepage, tools, PDF, merge, image converter, Guides, About and Privacy shell bounds');await context.close();
 }
 {
  const {context,page}=await create(1280,'dark');
  const cdp=await context.newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'prefers-reduced-transparency',value:'reduce'}]});
  for(const path of ['/','/tools','/pdf','/guides','/desktop']){
   await page.goto(base+path);await page.evaluate(()=>document.documentElement.style.zoom='2');
   assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-transparency: reduce)').matches),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,path+' 200% scaling overflow');
   assert.equal(await page.locator('[data-testid=site-header]').evaluate(el=>getComputedStyle(el).backdropFilter),'none');
  }
  checks.push('Representative Web and Desktop pages tolerate 200% CSS scaling; reduced transparency removes header blur');await context.close();
 }
 {
  const {context,page}=await create(375,'light');await page.setViewportSize({width:375,height:400});await page.goto(base+'/?qa-promo=1');const promo=page.locator('[data-desktop-promo]');await promo.waitFor({state:'visible'});
  const box=await promo.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=400);await promo.locator('button').click();checks.push('Popup remains dismissible in a short viewport');await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'results.json'),JSON.stringify({checks,errors,scope:'Built-site UI only; no installer, shell integration or live Dodo transaction tested.'},null,2));console.log(`PASS ${checks.length} website QA groups`);
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
