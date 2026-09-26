// Browser contract only: native window sizing and processing require host checks.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';

const folder=resolve('.artifacts/desktop-ui'),out=resolve('.artifacts/desktop-quick-action-ui-qa');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const path=resolve(folder,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!path.startsWith(folder+sep))throw Error('path');const data=await readFile(path);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'}[extname(path)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});
server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({...process.env.SORA_BROWSER_EXECUTABLE?{executablePath:process.env.SORA_BROWSER_EXECUTABLE}:{channel:process.env.SORA_BROWSER_CHANNEL||'msedge'},headless:true});
const checks=[],failures=[],errors=[],sizes=[{width:520,height:400},{width:440,height:320}];
async function fixture(viewport,theme,tool='watermark-pdf'){
 const page=await browser.newPage({viewport});page.setDefaultTimeout(5000);page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(({theme,tool})=>{
  const callbacks=new Map();window.__SORA_QUICK_ACTION__=true;window.__calls=[];window.__complete=null;window.__emit=(name,payload)=>callbacks.get(name)?.({payload});
  const settings={quickAction:true,platform:'windows',theme,output:'source',license:'trial',plan:'trial',expiresAt:1900000000,files:[{id:'selected-a',name:'Long selected <private> file name with spaces.pdf',format:'PDF',validated:true,bytes:12345}],launchIntent:{action:{id:tool,tool,options:{},direct:false,requiresUI:true}}};
  window.__TAURI__={event:{listen:async(name,callback)=>{callbacks.set(name,callback);return ()=>callbacks.delete(name);}},core:{invoke:async(command,{method,params})=>{
   if(command!=='host_request')throw Error('Unexpected command');window.__calls.push({method,params});
   if(method==='getState')return settings;
   if(method==='licenseStatus')return {license:'trial',plan:'trial',expiresAt:1900000000};
   if(method==='processFiles')return new Promise(resolve=>window.__complete=resolve);
   if(method==='cancelProcessing'){window.__complete?.({state:'cancelled'});return {requested:true};}
   if(['closeQuickAction','openFullApp','openOutput','revealOutput'].includes(method))return {};
   throw Error('Unexpected method '+method);
  }}};
 },{theme,tool});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#processing-form').waitFor();
 await page.waitForFunction(()=>window.__calls.some(call=>call.method==='licenseStatus'));
 return page;
}
async function layout(page){
 const result=await page.evaluate(()=>{
  const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
  return {overflow:document.documentElement.scrollWidth>innerWidth,header:rect('.quick-heading'),footer:rect('.quick-footer'),content:rect('.quick-content'),width:innerWidth,height:innerHeight,sidebar:!!document.querySelector('.sidebar')};
 });
 assert.equal(result.overflow,false);assert.equal(result.sidebar,false);
 assert.ok(result.header.top>=0&&result.footer.bottom<=result.height+1);
 assert.ok(result.content.top>=result.header.bottom-1&&result.content.bottom<=result.footer.top+1);
 for(const selector of ['.quick-footer button','[aria-label="Open full desktop app"]'])for(const button of await page.locator(selector).all()){
  const box=await button.boundingBox();assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=result.width+1&&box.y+box.height<=result.height+1);
 }
}
async function noCancellationOverlap(page){
 const overlap=await page.evaluate(()=>{
  const cancel=document.querySelector('#cancel-processing'),r=cancel.getBoundingClientRect();
  return [...document.querySelectorAll('.quick-footer button')].filter(button=>{const b=button.getBoundingClientRect();return b.width>0&&b.height>0&&r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top;}).map(button=>button.textContent);
 });assert.deepEqual(overlap,[],'Processing cancellation must not cover footer actions');
}
try{
 for(const viewport of sizes)for(const theme of ['light','dark'])for(const tool of ['watermark-pdf','page-numbers','edit-image']){
  const name=`${tool}-${viewport.width}x${viewport.height}-${theme}`,page=await fixture(viewport,theme,tool);
  try{
   assert.equal(await page.locator('private').count(),0);await layout(page);
   if(tool==='watermark-pdf'){await page.getByLabel('Watermark text',{exact:true}).fill('REVIEW');await page.getByLabel('Pages to watermark',{exact:true}).fill('1, 3');}
   if(tool==='page-numbers'){await page.getByLabel('Number format',{exact:true}).selectOption('roman');await page.getByLabel('Pages to number',{exact:true}).fill('2-4');}
   if(tool==='edit-image'){await page.locator('summary',{hasText:'Colour and detail'}).click();await page.getByLabel('Saturation',{exact:true}).fill('15');}
   for(const control of await page.locator('.option-fields input:visible,.option-fields select:visible').all()){
    await control.scrollIntoViewIfNeeded();const box=await control.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width+1,'Option control exceeds window');
   }
   const beforeRefresh=await page.locator('#processing-form').evaluate(form=>Object.fromEntries(new FormData(form)));
   await page.evaluate(()=>window.__emit('license-updated',{license:'trial',plan:'trial',expiresAt:1900000000}));
   assert.deepEqual(await page.locator('#processing-form').evaluate(form=>Object.fromEntries(new FormData(form))),beforeRefresh,'License refresh must preserve chosen options');
   await layout(page);await page.screenshot({path:resolve(out,name+'.png')});
   await page.getByRole('button',{name:'Run',exact:true}).click();await page.waitForFunction(()=>typeof window.__complete==='function');
   assert.equal(await page.getByRole('button',{name:'Cancel processing',exact:true}).isVisible(),true);
   assert.equal(await page.getByRole('button',{name:'Open full desktop app',exact:true}).isDisabled(),true);
   const call=await page.evaluate(()=>window.__calls.find(call=>call.method==='processFiles'));assert.equal(call.params.tool,tool);assert.deepEqual(call.params.selectionIds,['selected-a']);
   if(tool==='watermark-pdf'){assert.equal(call.params.options.text,'REVIEW');assert.deepEqual(call.params.options.selected,[0,2]);}
   if(tool==='page-numbers'){assert.equal(call.params.options.format,'roman');assert.deepEqual(call.params.options.selected,[1,2,3]);}
   if(tool==='edit-image')assert.equal(call.params.options.adjustments.saturation,15);
   await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__calls.some(call=>call.method==='closeQuickAction')),false);
   await page.screenshot({path:resolve(out,name+'-processing.png')});
   try{await noCancellationOverlap(page);}catch(error){failures.push({name:name+' processing layout',error:error.message});}
   await page.evaluate(()=>window.__complete({state:'completed',name:'Saved <result>.pdf',outputId:'b'.repeat(32)}));
   await page.getByRole('button',{name:'Done',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Run',exact:true}).count(),0);assert.equal(await page.locator('result').count(),0);await layout(page);
   await page.getByRole('button',{name:'Open result',exact:true}).click();await page.waitForFunction(()=>window.__calls.some(call=>call.method==='openOutput'));
   assert.equal(await page.evaluate(()=>window.__calls.some(call=>call.method==='openFullApp')),false);
   await page.getByRole('button',{name:'Done',exact:true}).click();await page.waitForFunction(()=>window.__calls.some(call=>call.method==='closeQuickAction'));
   checks.push(name+' options, processing, result and Done');
  }catch(error){failures.push({name,error:error.message});await page.screenshot({path:resolve(out,name+'-failure.png')});}finally{await page.close();}
 }
 for(const action of ['Cancel','Escape','Open full desktop app','Cancel processing']){
  const page=await fixture(sizes[0],'light','rotate-pdf');try{
   if(action==='Escape')await page.keyboard.press('Escape');
   else if(action==='Cancel processing'){await page.getByRole('button',{name:'Run',exact:true}).click();await page.getByRole('button',{name:action,exact:true}).click();await page.getByText('Processing cancelled.',{exact:true}).waitFor();}
   else await page.getByRole('button',{name:action,exact:true}).click();
   const method=action==='Open full desktop app'?'openFullApp':action==='Cancel processing'?'cancelProcessing':'closeQuickAction';await page.waitForFunction(method=>window.__calls.some(call=>call.method===method),method);
   if(action==='Open full desktop app')await page.getByRole('navigation',{name:'Main navigation'}).waitFor();else assert.equal(await page.evaluate(()=>window.__calls.some(call=>call.method==='openFullApp')),false);
   checks.push(action+' uses only its intended native command');
  }catch(error){failures.push({name:action,error:error.message});await page.screenshot({path:resolve(out,action.replaceAll(' ','-')+'-failure.png')});}finally{await page.close();}
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'results.json'),JSON.stringify({status:failures.length?'FAIL':'PASS',scope:'Browser UI with explicit fake native bridge',sizes,checks,failures,errors},null,2));console.log(JSON.stringify({checks:checks.length,failures,errors}));assert.deepEqual(failures,[]);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
