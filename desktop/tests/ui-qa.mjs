// UI contract tests use an explicit fake native bridge. They do not certify OS dialogs,
// licensing, processing, startup integration or native shell actions.
import {chromium} from 'playwright';import {createServer} from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';import {once} from 'node:events';import assert from 'node:assert/strict';
const desktopOnly=process.argv.includes('--desktop-only'),widths=desktopOnly?[900,1180,1440,1920]:[1920,1180,800,640,380],scaledViewport=desktopOnly?{width:1800,height:1000}:{width:760,height:600};
const folder=resolve('.artifacts/desktop-ui'),out=resolve(desktopOnly?'.artifacts/desktop-ui-qa-desktop-only':'.artifacts/desktop-ui-qa');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const path=resolve(folder,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!path.startsWith(folder+sep))throw Error('path');const data=await readFile(path);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'}[extname(path)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({...process.env.SORA_BROWSER_EXECUTABLE?{executablePath:process.env.SORA_BROWSER_EXECUTABLE}:{channel:process.env.SORA_BROWSER_CHANNEL||'msedge'},headless:true}),errors=[],checks=[];const page=await browser.newPage({viewport:{width:1180,height:900}});page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 const listeners=[],calls=[];window.__hostCalls=calls;
 const settings={platform:'windows',output:'source',theme:'light',startup:false,startupAvailable:true,shellEntry:false,shellEntryAvailable:true,license:'not-activated',version:'Development build'};
 window.__hostDelay=0;window.__folderSelected=true;window.__selectionRejected=false;window.__allowSyntheticActivation=false;
 const deliver=data=>listeners.forEach(fn=>fn({data}));
 const reply=message=>{calls.push(message);let result,ok=true,error;
  switch(message.method){case 'supportDetails':result={supportDeviceId:'a'.repeat(43)};break;case 'getState':result=settings;break;case 'selectFiles':result=[{id:'pdf-a',name:'Invoice <private> & sample.pdf',format:'PDF',validated:true,bytes:12345},{id:'pdf-b',name:'Second document.pdf',format:'PDF',validated:true,bytes:12345}];break;case 'saveSettings':Object.assign(settings,message.params);result=settings;break;case 'chooseFolder':result={selected:true};break;case 'activate':case 'startTrial':ok=false;error='License activation is not configured in this development build.';break;case 'checkUpdates':result={message:'No Desktop releases are published yet.'};break;default:ok=false;error='Unavailable';}
  if(message.method==='releaseSelection'){ok=true;error=undefined;result={released:true};}
  if(message.method==='chooseFolder')result={selected:window.__folderSelected};
  if(message.method==='selectFiles')result={files:result,rejected:window.__selectionRejected};
  if(message.method==='activate'&&window.__allowSyntheticActivation){ok=true;error=undefined;result={license:'active',plan:'personal-lifetime',expiresAt:null};}
  if(message.method==='processFiles'){ok=true;error=undefined;result={state:'batch',results:[{index:0,state:'completed',name:'Invoice <output>.pdf',bytes:123,outputId:'b'.repeat(32)},{index:1,state:'failed'}]};}
  if(['openOutput','revealOutput'].includes(message.method)){ok=true;error=undefined;result={opened:true};}
  setTimeout(()=>deliver({protocol:1,id:message.id,ok,result,error}),window.__hostDelay);
 };
 window.chrome=window.chrome||{};Object.defineProperty(window.chrome,'webview',{value:{postMessage:reply,addEventListener:(_name,fn)=>listeners.push(fn)}});
});
try{
 await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('heading',{name:'File tools for your desktop.'}).waitFor();
 assert.equal(await page.locator('[data-tool]').count(),6);checks.push('Home shows six common tools');
 await page.getByRole('button',{name:'Choose files',exact:true}).click();await page.getByRole('heading',{name:'2 files selected'}).waitFor();assert.ok((await page.locator('.selected li').first().innerText()).includes('Invoice <private> & sample.pdf'));assert.equal(await page.locator('private').count(),0);assert.equal(await page.locator('[data-tool="merge-pdf"]').count(),0);assert.equal(await page.locator('[data-tool="image-converter"]').count(),0);checks.push('Selection names escaped; unlicensed selection does not advertise runnable quick actions');
 await page.getByRole('button',{name:'Clear selection',exact:true}).click();
 await page.keyboard.press('Control+k');await page.getByRole('searchbox',{name:'Search tools'}).fill('merge pdf');assert.equal(await page.locator('[data-tool]').count(),1);await page.keyboard.press('Enter');await page.getByRole('heading',{name:'Merge PDF',exact:true}).waitFor();await page.keyboard.press('Escape');await page.getByRole('searchbox').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('[data-tool]').count(),25);checks.push('Ctrl K, search, Enter and Escape work');
 const ids=await page.locator('[data-tool]').evaluateAll(nodes=>nodes.map(n=>n.dataset.tool));for(const id of ids){await page.locator(`[data-tool="${id}"]`).click();assert.equal(await page.getByRole('button',{name:'Choose files',exact:true}).count(),1);await page.keyboard.press('Escape');}checks.push('All 25 eligible tools open their independent workspace');
 await page.getByRole('searchbox').fill('unlock');assert.equal(await page.locator('[data-tool]').count(),0);checks.push('Unlock PDF absent from Desktop search');await page.getByRole('searchbox').fill('xyz missing tool');await page.getByRole('heading',{name:'No tools found'}).waitFor();await page.getByRole('button',{name:'Clear search',exact:true}).click();assert.equal(await page.locator('[data-tool]').count(),25);
 await page.getByRole('button',{name:'License',exact:true}).click();await page.getByRole('button',{name:'Show this device ID',exact:true}).click();await page.getByText('a'.repeat(43),{exact:true}).waitFor();checks.push('Support identity is shown only on request and is not a license key');await page.getByLabel('License key',{exact:true}).fill('synthetic-key');assert.equal(await page.getByLabel('License key',{exact:true}).getAttribute('type'),'password');await page.getByRole('button',{name:'Show',exact:true}).click();assert.equal(await page.getByLabel('License key',{exact:true}).getAttribute('type'),'text');await page.getByRole('button',{name:'Activate license',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByLabel('License key',{exact:true}).inputValue(),'');checks.push('License key is masked by default and cleared after submission; failure announced');
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Default output location').selectOption('downloads');await page.waitForFunction(()=>document.querySelector('#output-mode')?.value==='downloads');await page.getByLabel('Keep quick actions available after sign-in').click();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);assert.equal(await page.getByLabel('Keep quick actions available after sign-in').isChecked(),true);await page.getByLabel('Keep quick actions available after sign-in').click();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);assert.equal(await page.getByLabel('Keep quick actions available after sign-in').isChecked(),false);checks.push('Settings roundtrip; sign-in startup can be enabled and disabled through its native setting');

 const explorerToggle=page.getByLabel('Show SoraFiles actions in the file manager');
 assert.equal(await explorerToggle.isChecked(),false);
 await explorerToggle.check();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);
 assert.equal(await explorerToggle.isChecked(),true);
 assert.deepEqual((await page.evaluate(()=>window.__hostCalls.filter(c=>c.method==='saveSettings').at(-1))).params,{shellEntry:true});
 await explorerToggle.uncheck();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);
 assert.equal(await explorerToggle.isChecked(),false);
 checks.push('Explorer entry is opt-in and saves only the requested native setting');
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
 await page.getByRole('button',{name:'License',exact:true}).click();await page.getByLabel('License key',{exact:true}).fill('synthetic-key');await page.getByRole('button',{name:'Activate license',exact:true}).click();await page.getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill('retain me');await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);assert.equal(await page.getByRole('searchbox').inputValue(),'retain me');
 checks.push('Late native responses preserve text entered on a different screen');
 await page.evaluate(()=>window.__hostDelay=0);
 await page.evaluate(()=>window.__allowSyntheticActivation=true);await page.getByRole('button',{name:'License',exact:true}).click();await page.getByLabel('License key',{exact:true}).fill('synthetic-key');await page.getByRole('button',{name:'Activate license',exact:true}).click();await page.getByRole('heading',{name:'Desktop is activated',exact:true}).waitFor();
 await page.getByRole('button',{name:'Home',exact:true}).click();await page.locator('[data-tool="rotate-pdf"]').click();await page.getByRole('button',{name:'Process files',exact:true}).click();
 await page.getByText('1 saved, 1 failed, 0 cancelled. Saved outputs are kept.',{exact:true}).waitFor();
 assert.equal(await page.locator('[aria-label="Batch results"] li').count(),2);assert.equal(await page.locator('output').count(),0);
 const batchCall=await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1));assert.deepEqual(batchCall.params.selectionIds,['pdf-a','pdf-b']);
 checks.push('Multiple selected PDFs reach processing together; per-file success and failure are escaped and visible');
 await page.getByRole('button',{name:'Open result',exact:true}).click();await page.getByText('Requested the saved file in its default application.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Open containing folder',exact:true}).click();await page.getByText('Requested the containing folder.',{exact:true}).waitFor();
 const outputCalls=await page.evaluate(()=>window.__hostCalls.filter(call=>['openOutput','revealOutput'].includes(call.method)));assert.ok(outputCalls.every(call=>Object.keys(call.params).join()==='id'&&call.params.id==='b'.repeat(32)));
 checks.push('Output actions send only registered opaque IDs and never filesystem paths');
 await page.getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill('rotate');await page.locator('[data-tool="rotate-pdf"]').click();
 await page.getByLabel('Pages to rotate',{exact:true}).fill('1-3, 5, 2');await page.getByRole('button',{name:'Process files',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);
 assert.deepEqual((await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1))).params.options.rotations,[0,1,2,4].map(pageIndex=>({pageIndex,angle:90})));
 const beforeInvalid=await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').length);
 await page.getByLabel('Pages to rotate',{exact:true}).fill('3-1');await page.getByRole('button',{name:'Process files',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').length),beforeInvalid);
 await page.getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill('split');await page.locator('[data-tool="split-pdf"]').click();
 assert.equal(await page.getByLabel('Pages to extract',{exact:true}).isVisible(),false);
 await page.getByLabel('Split into',{exact:true}).selectOption('selected');await page.getByLabel('Pages to extract',{exact:true}).fill('2, 4-5');
 await page.getByRole('button',{name:'Process files',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);
 assert.deepEqual((await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1))).params.options,{mode:'selected',selected:[1,3,4]});
 await page.getByLabel('Split into',{exact:true}).selectOption('every');await page.getByLabel('Pages per file',{exact:true}).fill('3');
 await page.getByRole('button',{name:'Process files',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);
 assert.deepEqual((await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1))).params.options,{mode:'every',every:3});
 checks.push('Page ranges reach rotation and extraction; malformed ranges never invoke processing; hidden split options do not block submission');
 await page.getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill('merge');await page.locator('[data-tool="merge-pdf"]').click();
 assert.equal(await page.locator('[data-move-up="pdf-a"]').isDisabled(),true);
 await page.locator('[data-move-up="pdf-b"]').focus();await page.keyboard.press('Enter');
 assert.match(await page.locator('.selected li').first().innerText(),/Second document/);
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.remove),'pdf-b');
 await page.getByRole('button',{name:'Process files',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);
 assert.deepEqual((await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1))).params.selectionIds,['pdf-b','pdf-a']);
 await page.locator('[data-move-down="pdf-b"]').click();assert.match(await page.locator('.selected li').first().innerText(),/Invoice/);
 checks.push('Keyboard ordering controls change merge submission order and preserve focus without changing native selection IDs');
 await page.getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill('protect');await page.locator('[data-tool="protect-pdf"]').click();
 await page.getByLabel('Opening password',{exact:true}).fill('synthetic-opening-password');await page.getByLabel('Confirm password',{exact:true}).fill('different-password');await page.getByRole('button',{name:'Process files',exact:true}).click();await page.getByRole('alert').waitFor();
 assert.match(await page.getByRole('alert').innerText(),/matching passwords/);
 await page.getByLabel('Opening password',{exact:true}).fill('synthetic-opening-password');await page.getByLabel('Confirm password',{exact:true}).fill('synthetic-opening-password');
 await page.evaluate(()=>window.__hostDelay=400);await page.getByRole('button',{name:'Process files',exact:true}).click();assert.equal(await page.getByLabel('Opening password',{exact:true}).inputValue(),'');await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);await page.evaluate(()=>window.__hostDelay=0);
 checks.push('Protect PDF confirms passwords, masks them and clears fields before processing');
 await page.getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill('metadata');await page.locator('[data-tool="metadata-remover"]').click();
 await page.getByText(/Clean document properties from DOCX, XLSX and PPTX/).waitFor();await page.getByText(/Encrypted, digitally signed and macro-enabled Office files are not supported/).waitFor();await page.getByText(/This tool does not redact content/).waitFor();
 await page.getByRole('button',{name:'Process files',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);
 const metadataCall=await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1));assert.equal(metadataCall.params.tool,'metadata-remover');assert.deepEqual(metadataCall.params.options,{});
 checks.push('Metadata cleanup shows supported-format and redaction limits before submitting ordinary licensed processing');
 await page.getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill('pdf to excel');await page.locator('[data-tool="pdf-to-excel"]').click();
 await page.getByText(/Scanned tables and full-page visual sheets are not supported yet/).waitFor();
 await page.getByRole('button',{name:'Process files',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);
 assert.equal((await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1))).params.tool,'pdf-to-excel');
 checks.push('PDF-to-Excel explains text-preservation and scan limits before licensed processing');
 await page.getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill('pdf to word');await page.locator('[data-tool="pdf-to-word"]').click();
 await page.getByLabel('Text direction',{exact:true}).selectOption('rtl');
 assert.match(await page.locator('.processing-options').innerText(),/scanned and blank pages are not supported/);
 await page.getByRole('button',{name:'Process files',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);
 assert.deepEqual((await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1))).params.options,{direction:'rtl'});
 checks.push('Word text conversion exposes direction and honest scan/layout limits');
 await page.getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill('heic');await page.locator('[data-tool="heic-to-jpg"]').click();
 await page.getByLabel('JPG quality',{exact:true}).fill('92');assert.match(await page.locator('.processing-options').innerText(),/primary photo/);
 await page.getByRole('button',{name:'Process files',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);
 assert.deepEqual((await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1))).params.options,{quality:92});
 checks.push('HEIC conversion declares primary-photo limits and submits bounded JPG quality');
 await page.getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill('compress pdf');await page.locator('[data-tool="compress-pdf"]').click();
 assert.match(await page.locator('.processing-options').innerText(),/unchanged copy/);
 await page.getByRole('button',{name:'Process files',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);
 assert.deepEqual((await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1))).params.options,{});
 checks.push('PDF compression declares structural-only scope and unchanged-output behavior');
 await page.getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill('repair pdf');await page.locator('[data-tool="repair-pdf"]').click();
 assert.match(await page.locator('.processing-options').innerText(),/Missing or truncated data cannot be recovered/);
 await page.getByRole('button',{name:'Process files',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);
 assert.deepEqual((await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1))).params.options,{});
 checks.push('PDF repair explains recoverability limits before submitting a rewrite');
 await page.getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill('scanner');await page.locator('[data-tool="doc-scanner"]').click();
 assert.match(await page.locator('.processing-options').innerText(),/perspective cropping and searchable text are not available/);
 await page.getByLabel('Scan filter',{exact:true}).selectOption('receipt');await page.getByLabel('Rotate clockwise',{exact:true}).selectOption('90');
 await page.getByRole('button',{name:'Process files',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);
 assert.deepEqual((await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1))).params.options,{filter:'receipt',rotation:90,paper:'a4'});
 checks.push('Scanner exposes bounded image-only processing, filters, rotation and paper size');
 await page.getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill('remove background');await page.locator('[data-tool="remove-background"]').click();
 assert.match(await page.locator('.processing-options').innerText(),/existing transparency preserved/);
 await page.getByRole('button',{name:'Process files',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);
 assert.deepEqual((await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1))).params.options,{});
 checks.push('Background removal explains local input limits, transparency and mask review');
 await page.getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill('pdf to jpg');await page.locator('[data-tool="pdf-to-jpg"]').click();
 await page.getByLabel('Pages to export',{exact:true}).fill('3, 1');await page.getByLabel('JPG quality',{exact:true}).fill('82');
 await page.getByRole('button',{name:'Process files',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);
 assert.deepEqual((await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1))).params.options,{format:'jpeg',dpi:150,quality:82,selected:[0,2]});
 await page.getByLabel('Pages to export',{exact:true}).fill('3-1');const rasterCalls=await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').length);
 await page.getByRole('button',{name:'Process files',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').length),rasterCalls);
 checks.push('PDF image export exposes quality and ordered ranges; invalid ranges never invoke processing');
 await page.getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill('edit image');await page.locator('[data-tool="edit-image"]').click();
 const disclosure=page.locator('summary',{hasText:'Colour and detail'});await disclosure.focus();await page.keyboard.press('Enter');
 await page.getByLabel('Brightness',{exact:true}).fill('35');await page.getByLabel('Sharpness',{exact:true}).fill('20');
 await page.getByRole('button',{name:'Process files',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);
 const adjustments=(await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1))).params.options.adjustments;assert.equal(adjustments.brightness,35);assert.equal(adjustments.sharpness,20);assert.equal(Object.keys(adjustments).length,10);
 await disclosure.click();await page.getByLabel('Brightness',{exact:true}).fill('45');await page.getByRole('button',{name:'Reset colour and detail'}).click();assert.equal(await page.getByLabel('Brightness',{exact:true}).inputValue(),'0');
 checks.push('Image adjustment disclosure works with keyboard; all ten controls reach processing and reset is local');
 await page.setViewportSize(scaledViewport);await page.evaluate(()=>document.documentElement.style.zoom='2');
 for(const tool of ['merge-pdf','split-pdf','rotate-pdf','metadata-remover','pdf-to-word','pdf-to-jpg','edit-image','watermark-pdf','page-numbers']){
  await page.keyboard.press('Control+k');await page.getByRole('searchbox').fill(tool.replaceAll('-',' '));await page.keyboard.press('Enter');
  if(tool==='split-pdf')await page.getByLabel('Split into',{exact:true}).selectOption('selected');
  if(tool==='edit-image'){
   const summary=page.locator('summary',{hasText:'Colour and detail'});await summary.scrollIntoViewIfNeeded();
   const target=await summary.evaluate(element=>{
    const r=element.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    if(document.elementFromPoint(x,y)===element)return {x,y};
    // Edge 92 returns pre-zoom DOM rects but hit testing uses visual coordinates.
    // Verify the real hit target before clicking; do not force through overlays.
    const zoom=Number(getComputedStyle(document.documentElement).zoom);
    if(document.elementFromPoint(x*zoom,y*zoom)===element)return {x:x*zoom,y:y*zoom};
    throw Error('Adjustment disclosure is covered at 200% scaling');
   });await page.mouse.click(target.x,target.y);assert.equal(await summary.evaluate(element=>element.parentElement.open),true);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,tool+' workspace overflow');
  assert.equal(await page.locator('.selected').evaluate(el=>el.scrollWidth>el.clientWidth),false,tool+' selection overflow');
 }
 await page.screenshot({path:resolve(out,'workspace-ranges-200-percent.png')});await page.evaluate(()=>document.documentElement.style.zoom='1');
 checks.push('Ordering, range and metadata workspaces fit at 200% scaling');
 const contrast=[];
 for(const width of widths)for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Appearance').selectOption(theme);await page.waitForFunction(value=>document.documentElement.dataset.theme===value,theme);
  for(const nav of ['Home','All tools','License','Settings','Updates & about']){await page.getByRole('button',{name:nav,exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}/${theme}/${nav} overflow`);}
  // Mock settings responses above restore the fixture's unactivated state.
  await page.getByRole('button',{name:'License',exact:true}).click();await page.getByLabel('License key',{exact:true}).fill('synthetic-key');await page.getByRole('button',{name:'Activate license',exact:true}).click();await page.getByRole('heading',{name:'Desktop is activated',exact:true}).waitFor();
  await page.keyboard.press('Control+k');await page.getByRole('searchbox').fill('edit image');await page.keyboard.press('Enter');await page.locator('summary',{hasText:'Colour and detail'}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}/${theme}/adjustments overflow`);
  if([1180,380].includes(width))await page.screenshot({path:resolve(out,`adjustments-${width}-${theme}.png`),fullPage:true});
  await page.keyboard.press('Control+k');await page.getByRole('searchbox').fill('pdf to jpg');await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}/${theme}/PDF export overflow`);
  if(width===380)await page.screenshot({path:resolve(out,`pdf-export-${width}-${theme}.png`),fullPage:true});
  for(const tool of ['watermark-pdf','page-numbers']){
   await page.keyboard.press('Control+k');await page.getByRole('searchbox').fill(tool.replaceAll('-',' '));await page.keyboard.press('Enter');
   const controls=page.locator('#processing-form input, #processing-form select');await controls.first().focus();
   for(let index=0;index<await controls.count();index++){
    assert.equal(await controls.nth(index).evaluate(node=>node===document.activeElement),true,`${width}/${theme}/${tool} keyboard order ${index}`);
    await page.keyboard.press('Tab');
   }
   assert.equal(await page.getByRole('button',{name:'Process files',exact:true}).evaluate(node=>node===document.activeElement),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}/${theme}/${tool} overflow`);
   assert.equal(await page.locator('#processing-form').evaluate(form=>[...form.querySelectorAll('input, select, button')].every(node=>{const box=node.getBoundingClientRect(),bounds=form.getBoundingClientRect();return box.left>=bounds.left&&box.right<=bounds.right;})),true,`${width}/${theme}/${tool} form control fit`);
   if(tool==='watermark-pdf'){
    await page.getByLabel('Watermark text',{exact:true}).fill('REVIEW');await page.getByLabel('Opacity (%)',{exact:true}).fill('65');await page.getByLabel('Angle (degrees)',{exact:true}).fill('-30');await page.getByLabel('Pages to watermark',{exact:true}).fill('3, 1');
   }else{
    await page.getByLabel('Number format',{exact:true}).selectOption('roman');await page.getByLabel('Position',{exact:true}).selectOption('top-right');await page.getByLabel('Skip first pages',{exact:true}).fill('1');await page.getByLabel('Pages to number',{exact:true}).fill('1-3');
   }
   if(width===1180)await page.screenshot({path:resolve(out,`${tool}-${width}-${theme}.png`),fullPage:true});
   await page.getByRole('button',{name:'Process files',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#pending-action').hidden);
   const overlayCall=(await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1))).params;
   assert.equal(overlayCall.tool,tool);
   assert.deepEqual(overlayCall.options,tool==='watermark-pdf'?{text:'REVIEW',size:42,opacity:.65,angle:-30,margin:24,color:'#667085',selected:[0,2]}:{start:1,position:'top-right',format:'roman',size:10,margin:24,color:'#333b52',skip:1,selected:[0,1,2]});
  }
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
 }checks.push(`Five screens have no horizontal overflow at ${widths.join(', ')} CSS pixels in light and dark`);
 checks.push('Watermark and page-number controls fit their forms, follow keyboard order and submit all selected options in both themes at every tested width');

 await page.setViewportSize(scaledViewport);await page.evaluate(()=>document.documentElement.style.zoom='2');
 for(const nav of ['Home','All tools','License','Settings','Updates & about']){await page.getByRole('button',{name:nav,exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,nav+' 200% overflow');}
 await page.getByRole('button',{name:'Quit SoraFiles',exact:true}).scrollIntoViewIfNeeded();assert.equal(await page.getByRole('button',{name:'Quit SoraFiles',exact:true}).isVisible(),true);
 await page.screenshot({path:resolve(out,'settings-200-percent.png')});await page.evaluate(()=>document.documentElement.style.zoom='1');
 checks.push(`200% CSS scaling at a ${scaledViewport.width}×${scaledViewport.height} viewport preserves screen content and Quit; native DPI still requires platform validation`);
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'All tools',exact:true}).focus();await page.keyboard.press('Tab');assert.notEqual(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'none');checks.push('Keyboard focus is visible with reduced motion');
 checks.push('Five normal-text token pairs exceed 4.5:1 in both themes, including feedback and primary actions');
 // A recreated renderer has no pending original request. It reconnects using
 // a bounded native snapshot and receives the result through status polling.
 await page.addInitScript(()=>{
  const calls=window.__hostCalls;let polls=0;
  window.chrome.webview.postMessage=message=>{
   calls.push(message);
   const result=message.method==='getState'?{platform:'windows',theme:'light',output:'source',license:'trial',files:[],job:{busy:true,tool:'rotate-pdf',sources:['Background file.pdf'],result:null,error:null}}
    :message.method==='processingStatus'?(++polls<2?{busy:true}:{busy:false,sources:['Background file.pdf'],result:{state:'completed',name:'Background saved.pdf',outputId:'b'.repeat(32)},error:null})
    :message.method==='licenseStatus'?{license:'trial',plan:'trial'}:{};
   // Existing fake listeners are private; use a dedicated bridge on this load.
   setTimeout(()=>window.__backgroundReply?.({protocol:1,id:message.id,ok:true,result}),message.method==='processingStatus'?200:0);
  };
  window.chrome.webview.addEventListener=(_name,listener)=>{window.__backgroundReply=data=>listener({data});};
 });
 await page.reload();await page.getByRole('heading',{name:'Rotate PDF',exact:true}).waitFor();
 await page.getByRole('button',{name:'Cancel processing',exact:true}).waitFor();
 await page.getByRole('heading',{name:'Background saved.pdf',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Cancel processing',exact:true}).isVisible(),false);
 assert.equal(await page.getByRole('button',{name:'Open result',exact:true}).isEnabled(),true);
 checks.push('A recreated view reconnects to background processing, keeps cancellation available and displays saved output');
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 assert.equal(await page.getByLabel('Keep quick actions available after sign-in').isDisabled(),true);
 assert.equal(await page.getByLabel('Show SoraFiles actions in the file manager').isDisabled(),true);
 checks.push('Unavailable sign-in integration remains disabled after native state restoration');
 const trialPage=await browser.newPage({viewport:{width:1180,height:900}});trialPage.on('pageerror',error=>errors.push(error.message));
 try{
  await trialPage.addInitScript(()=>{
   const callbacks=new Map();window.__trialCalls=[];
   window.__trialStatus={license:'needs-verification',activationAvailable:true,trialPending:true,expiresAt:1900000000};
   window.__publishTrial=status=>{window.__trialStatus=status;callbacks.get('license-updated')?.({payload:status});};
   window.__TAURI__={core:{invoke:async(command,{method})=>{
    if(command!=='host_request')throw Error('Unexpected native command');window.__trialCalls.push(method);
    if(method==='getState')return {platform:'windows',theme:'light',output:'source',files:[],...window.__trialStatus};
    if(method==='licenseStatus')return window.__trialStatus;
    throw Error('Unexpected trial UI request: '+method);
   }},event:{listen:async(name,callback)=>{callbacks.set(name,callback);return ()=>callbacks.delete(name);}}};
  });
  await trialPage.goto('http://127.0.0.1:'+server.address().port);
  await trialPage.getByRole('button',{name:'License',exact:true}).click();
  await trialPage.getByRole('heading',{name:'Setting up your trial',exact:true}).waitFor();
  await trialPage.getByText('Connect to the internet to finish setting up your trial. We will retry automatically.',{exact:true}).waitFor();
  assert.equal(await trialPage.getByRole('button',{name:'Start free trial',exact:true}).count(),0);
  assert.ok((await trialPage.locator('main').innerText()).includes('Trial ends: '+new Intl.DateTimeFormat('en',{dateStyle:'medium'}).format(1900000000000)));
  await trialPage.evaluate(()=>window.__publishTrial({license:'trial',plan:'trial',activationAvailable:true,expiresAt:1900000000}));
  await trialPage.getByRole('heading',{name:'Your trial is active',exact:true}).waitFor();
  assert.equal(await trialPage.getByText(/We will retry automatically/).count(),0);
  await trialPage.screenshot({path:resolve(out,'automatic-trial-active.png')});
  await trialPage.evaluate(()=>window.__publishTrial({license:'needs-verification',activationAvailable:true}));
  await trialPage.getByRole('heading',{name:'Your trial needs a check',exact:true}).waitFor();
  await trialPage.getByText('Trial ends: Check required',{exact:true}).waitFor();
  await trialPage.getByText('Your trial may have ended, or this device could not verify it. You can activate a purchased license below.',{exact:true}).waitFor();
  assert.equal(await trialPage.getByRole('button',{name:'Activate license',exact:true}).isVisible(),true);
  assert.equal(await trialPage.getByText(/We will retry automatically/).count(),0);
  const calls=await trialPage.evaluate(()=>window.__trialCalls);assert.deepEqual(calls,['getState','licenseStatus']);
  checks.push('Native license-updated automatically changes pending trial to active, preserves its deadline, clears retry messaging after expiry and never calls startTrial');
 }finally{await trialPage.close();}
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'results.json'),JSON.stringify({status:'PASS',scope:'Browser UI with explicit fake native bridge',desktopOnly,widths,scaledViewport,checks,contrast},null,2));console.log(JSON.stringify({status:'PASS',desktopOnly,checks}));
}catch(error){await page.screenshot({path:resolve(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();await new Promise(r=>server.close(r));}
