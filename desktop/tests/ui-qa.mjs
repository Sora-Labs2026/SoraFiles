// UI contract tests use an explicit fake native bridge. They do not certify OS dialogs,
// licensing, processing, startup integration or native shell actions.
import {chromium} from 'playwright';import {createServer} from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';import {once} from 'node:events';import assert from 'node:assert/strict';
const folder=resolve('.artifacts/desktop-ui'),out=resolve('.artifacts/desktop-ui-qa');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const path=resolve(folder,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!path.startsWith(folder+sep))throw Error('path');const data=await readFile(path);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'}[extname(path)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({channel:process.env.SORA_BROWSER_CHANNEL||'msedge',headless:true}),errors=[],checks=[];const page=await browser.newPage({viewport:{width:1180,height:900}});page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 const listeners=[],calls=[];window.__hostCalls=calls;
 const settings={platform:'windows',output:'source',theme:'light',startup:false,license:'not-activated',version:'Development build'};
 window.__hostDelay=0;window.__folderSelected=true;window.__selectionRejected=false;
 const deliver=data=>listeners.forEach(fn=>fn({data}));
 const reply=message=>{calls.push(message);let result,ok=true,error;
  switch(message.method){case 'getState':result=settings;break;case 'selectFiles':result=[{id:'pdf-a',name:'Invoice <private> & sample.pdf',format:'PDF',validated:true,bytes:12345},{id:'pdf-b',name:'Second document.pdf',format:'PDF',validated:true,bytes:12345}];break;case 'saveSettings':if('startup' in message.params){ok=false;error='Sign-in quick actions are not installed in this development build.';}else Object.assign(settings,message.params);result=settings;break;case 'chooseFolder':result={selected:true};break;case 'activate':case 'startTrial':ok=false;error='License activation is not configured in this development build.';break;case 'checkUpdates':result={message:'No Desktop releases are published yet.'};break;default:ok=false;error='Unavailable';}
  if(message.method==='releaseSelection'){ok=true;error=undefined;result={released:true};}
  if(message.method==='chooseFolder')result={selected:window.__folderSelected};
  if(message.method==='selectFiles')result={files:result,rejected:window.__selectionRejected};
  setTimeout(()=>deliver({protocol:1,id:message.id,ok,result,error}),window.__hostDelay);
 };
 window.chrome=window.chrome||{};Object.defineProperty(window.chrome,'webview',{value:{postMessage:reply,addEventListener:(_name,fn)=>listeners.push(fn)}});
});
try{
 await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('heading',{name:'File tools for your desktop.'}).waitFor();
 assert.equal(await page.locator('[data-tool]').count(),6);checks.push('Home shows six common tools');
 await page.getByRole('button',{name:'Choose files',exact:true}).click();await page.getByRole('heading',{name:'2 files selected'}).waitFor();assert.ok((await page.locator('.selected li').first().innerText()).includes('Invoice <private> & sample.pdf'));assert.equal(await page.locator('private').count(),0);assert.equal(await page.locator('[data-tool="merge-pdf"]').count(),1);assert.equal(await page.locator('[data-tool="image-converter"]').count(),0);checks.push('Selection names escaped; PDF suggestions exclude image actions');
 await page.getByRole('button',{name:'Clear selection',exact:true}).click();
 await page.keyboard.press('Control+k');await page.getByRole('searchbox',{name:'Search tools'}).fill('merge pdf');assert.equal(await page.locator('[data-tool]').count(),1);await page.keyboard.press('Enter');await page.getByRole('heading',{name:'Merge PDF',exact:true}).waitFor();await page.keyboard.press('Escape');await page.getByRole('searchbox').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('[data-tool]').count(),26);checks.push('Ctrl K, search, Enter and Escape work');
 const ids=await page.locator('[data-tool]').evaluateAll(nodes=>nodes.map(n=>n.dataset.tool));for(const id of ids){await page.locator(`[data-tool="${id}"]`).click();assert.equal(await page.getByRole('button',{name:'Choose files',exact:true}).count(),1);await page.keyboard.press('Escape');}checks.push('All 26 tools open their independent workspace');
 await page.getByRole('searchbox').fill('xyz missing tool');await page.getByRole('heading',{name:'No tools found'}).waitFor();await page.getByRole('button',{name:'Clear search',exact:true}).click();assert.equal(await page.locator('[data-tool]').count(),26);
 await page.getByRole('button',{name:'License',exact:true}).click();await page.getByLabel('License key',{exact:true}).fill('synthetic-key');assert.equal(await page.getByLabel('License key',{exact:true}).getAttribute('type'),'password');await page.getByRole('button',{name:'Show',exact:true}).click();assert.equal(await page.getByLabel('License key',{exact:true}).getAttribute('type'),'text');await page.getByRole('button',{name:'Activate license',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByLabel('License key',{exact:true}).inputValue(),'');checks.push('License key is masked by default and cleared after submission; failure announced');
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Default output location').selectOption('downloads');await page.waitForFunction(()=>document.querySelector('#output-mode')?.value==='downloads');await page.getByLabel('Keep quick actions available after sign-in').check();await page.getByRole('alert').waitFor();assert.equal(await page.getByLabel('Keep quick actions available after sign-in').isChecked(),false);checks.push('Settings roundtrip; unsupported startup preference reverts with an explanation');

 await page.getByLabel('Default output location').selectOption('custom');await page.waitForFunction(()=>!document.querySelector('#app').matches('[aria-busy="true"]'));
 await page.evaluate(()=>{window.__hostDelay=600;window.__folderSelected=false;});
 await page.getByRole('button',{name:'Choose folder',exact:true}).click();
 assert.equal(await page.locator('#pending-action').isVisible(),true);assert.equal(await page.getByRole('button',{name:'Choose folder',exact:true}).isDisabled(),true);
 await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);assert.equal(await page.locator('.feedback').count(),0);assert.equal(await page.evaluate(()=>document.activeElement?.dataset.action),'folder');
 await page.evaluate(()=>{window.__folderSelected=true;});await page.getByRole('button',{name:'Choose folder',exact:true}).click();await page.getByText('Output folder saved.',{exact:true}).waitFor();
 checks.push('Native actions announce pending state, prevent duplicate requests, restore focus; cancelling folder selection does not claim success');
 await page.getByRole('button',{name:'Home',exact:true}).click();await page.getByRole('button',{name:'Choose files',exact:true}).click();await page.getByRole('heading',{name:'2 files selected'}).waitFor();
 await page.locator('[data-remove="pdf-a"]').click();await page.getByRole('heading',{name:'1 file selected'}).waitFor();await page.getByRole('button',{name:'Clear selection',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.selected'));
 const releases=await page.evaluate(()=>window.__hostCalls.filter(c=>c.method==='releaseSelection').map(c=>c.params.ids));assert.deepEqual(releases.slice(-2),[['pdf-a'],['pdf-b']]);
 checks.push('Remove and Clear release native selection IDs before updating the view');
 await page.evaluate(()=>window.__selectionRejected=true);await page.getByRole('button',{name:'Choose files',exact:true}).click();await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/Some files could not be added/);await page.getByRole('heading',{name:'2 files selected'}).waitFor();await page.evaluate(()=>window.__selectionRejected=false);
 checks.push('Partially rejected selections explain file limits while keeping accepted files');
 await page.getByRole('button',{name:'License',exact:true}).click();await page.getByRole('button',{name:'Start free trial',exact:true}).click();await page.getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill('retain me');await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);assert.equal(await page.getByRole('searchbox').inputValue(),'retain me');
 checks.push('Late native responses preserve text entered on a different screen');
 await page.evaluate(()=>window.__hostDelay=0);
 const contrast=[];
 for(const width of [1920,1180,800,640,380])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Appearance').selectOption(theme);await page.waitForFunction(value=>document.documentElement.dataset.theme===value,theme);
  for(const nav of ['Home','All tools','License','Settings','Updates & about']){await page.getByRole('button',{name:nav,exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}/${theme}/${nav} overflow`);}
  await page.getByRole('button',{name:'Home',exact:true}).click();await page.screenshot({path:resolve(out,`home-${width}-${theme}.png`)});
  if(width===1180){
   const ratios=await page.evaluate(()=>{
    const rgb=color=>{const probe=document.createElement('span');probe.style.color=color;document.body.append(probe);const values=getComputedStyle(probe).color.match(/[\d.]+/g).slice(0,3).map(Number);probe.remove();return values;};
    const luminance=channels=>channels.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const tokens=getComputedStyle(document.documentElement),read=name=>luminance(rgb(tokens.getPropertyValue(name).trim()));
    return [['--text','--surface'],['--muted','--surface'],['--action-text','--action'],['--success-text','--success-bg'],['--error-text','--error-bg']].map(([fg,bg])=>{const a=read(fg),b=read(bg);return {fg,bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});
   });
   for(const result of ratios)assert.ok(result.ratio>=4.5,`${theme} ${result.fg}/${result.bg} contrast ${result.ratio}`);contrast.push({theme,ratios});
  }
 }checks.push('Five screens have no horizontal overflow at 1920, 1180, 800, 640, 380 CSS pixels in light and dark');

 await page.setViewportSize({width:760,height:600});await page.evaluate(()=>document.documentElement.style.zoom='2');
 for(const nav of ['Home','All tools','License','Settings','Updates & about']){await page.getByRole('button',{name:nav,exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,nav+' 200% overflow');}
 await page.getByRole('button',{name:'Quit SoraFiles',exact:true}).scrollIntoViewIfNeeded();assert.equal(await page.getByRole('button',{name:'Quit SoraFiles',exact:true}).isVisible(),true);
 await page.screenshot({path:resolve(out,'settings-200-percent.png')});await page.evaluate(()=>document.documentElement.style.zoom='1');
 checks.push('200% CSS scaling at a 760×600 viewport preserves screen content and Quit; native DPI still requires platform validation');
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'All tools',exact:true}).focus();await page.keyboard.press('Tab');assert.notEqual(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'none');checks.push('Keyboard focus is visible with reduced motion');
 checks.push('Five normal-text token pairs exceed 4.5:1 in both themes, including feedback and primary actions');
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'results.json'),JSON.stringify({status:'PASS',scope:'Browser UI with explicit fake native bridge',checks,contrast},null,2));console.log(JSON.stringify({status:'PASS',checks}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
