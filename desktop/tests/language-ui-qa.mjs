import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {once} from 'node:events';
import catalogs from '../shared/locales/catalogs.json' with {type:'json'};
const folder=resolve('.artifacts/desktop-ui'),out=resolve('.artifacts/desktop-language-qa');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const path=resolve(folder,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!path.startsWith(folder+sep))throw Error('path');res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'}[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({channel:process.env.SORA_BROWSER_CHANNEL||'msedge',headless:true});let checked=0;const errors=[];
async function fixture(platform,systemLocale,quick=false){
 const context=await browser.newContext({viewport:quick?{width:520,height:400}:{width:1180,height:900}});
 const page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({platform,systemLocale,quick})=>{
  window.__SORA_LOCALE__=systemLocale;window.__SORA_QUICK_ACTION__=quick;window.calls=[];
  const state=()=>{const language=localStorage.getItem('test-language')||'system';return {language,locale:language==='system'?systemLocale:language,platform,quickAction:quick,theme:'light',output:'source',startup:true,startupAvailable:true,shellEntry:true,shellEntryAvailable:true,license:'trial',plan:'trial',files:quick?[{id:'a'.repeat(32),name:'Settings',format:'PDF',validated:true,bytes:12345}]:[],...(quick?{launchIntent:{action:{id:'watermark-pdf',tool:'watermark-pdf',options:{}}}}:{})};};
  window.__TAURI__={event:{listen:async()=>()=>{}},core:{invoke:async(command,{method,params})=>{
   window.calls.push({method,params});if(method==='getState')return state();if(method==='licenseStatus')return {license:'trial',plan:'trial'};
   if(method==='saveSettings'){if(Object.keys(params).join()!=='language')throw Error('Unexpected mutation');localStorage.setItem('test-language',params.language);return state();}
   if(method==='processFiles')return {state:'completed',name:'Home',outputId:'b'.repeat(32)};
   throw Error('Unexpected host call '+method);
  }}};
 },{platform,systemLocale,quick});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.calls.some(x=>x.method==='licenseStatus'));
 return {page,context};
}
try{
 for(const platform of ['windows','macos','linux']){
  const {page,context}=await fixture(platform,'ja');
  await page.locator('[data-page="settings"]').click();assert.equal(await page.locator('#language option').count(),20);
  assert.equal(await page.locator('#language').inputValue(),'system');assert.equal(await page.locator('html').getAttribute('lang'),'ja');
  assert.equal(await page.locator('h1').textContent(),catalogs.ja.Settings);
  for(const code of Object.keys(catalogs)){
   await page.locator('#language').selectOption(code);await page.waitForFunction(code=>document.documentElement.lang===code,code);
   assert.equal(await page.locator('#language').inputValue(),code);assert.equal(await page.locator('html').getAttribute('dir'),code==='ar'?'rtl':'ltr');
   assert.equal(await page.locator('h1').textContent(),catalogs[code].Settings);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   checked++;
  }
  await page.locator('#language').selectOption('de');await page.waitForFunction(()=>document.documentElement.lang==='de');
  await page.reload();await page.locator('[data-page="settings"]').click();assert.equal(await page.locator('#language').inputValue(),'de');
  await page.locator('#language').selectOption('system');await page.waitForFunction(()=>document.documentElement.lang==='ja');
  await page.locator('#language').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,platform+'-settings-ja.png')});
  const changes=await page.evaluate(()=>window.calls.filter(x=>x.method==='saveSettings'));assert.ok(changes.every(x=>Object.keys(x.params).join()==='language'));
  await context.close();
 }
 for(const platform of ['windows','macos','linux']){
  const {page,context}=await fixture(platform,'ne-NP');await page.locator('[data-page="settings"]').click();assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.equal(await page.locator('#language').inputValue(),'system');await context.close();checked++;
 }
 for(const code of ['ja','ar','de']){
  const {page,context}=await fixture('windows',code,true);await page.locator('#processing-form').waitFor();
  assert.equal(await page.locator('.quick-files>summary').textContent(),'Settings');
  await page.locator('input[name="text"]').fill('Keep my English text <unchanged>');
  await page.locator('input[name="pages"]').fill('1');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:resolve(out,'quick-'+code+'.png')});
  await page.locator('.quick-footer button[type="submit"]').click();await page.waitForFunction(()=>window.calls.some(x=>x.method==='processFiles'));
  const call=await page.evaluate(()=>window.calls.find(x=>x.method==='processFiles'));assert.equal(call.params.options.text,'Keep my English text <unchanged>');
  await page.locator('.panel h2[data-user-text]').waitFor();assert.equal(await page.locator('.panel h2[data-user-text]').textContent(),'Home');
  await context.close();checked++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checked} language/platform and compact-card cases, persisted overrides, system reset, RTL, and user-text preservation.`);
}finally{await browser.close();server.close();}
