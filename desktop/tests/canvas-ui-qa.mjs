// Canvas contract: previews from a fake native bridge drive the crop frame,
// resize options and PDF page picking. Engines are tested separately.
import {chromium} from 'playwright';import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';import {once} from 'node:events';import assert from 'node:assert/strict';
import sharp from 'sharp';
const folder=resolve('.artifacts/desktop-ui');
const server=createServer(async(req,res)=>{try{const path=resolve(folder,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!path.startsWith(folder+sep))throw Error('path');const data=await readFile(path);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'}[extname(path)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});server.listen(0,'127.0.0.1');await once(server,'listening');
const image='data:image/webp;base64,'+(await sharp({create:{width:400,height:200,channels:3,background:'#4477aa'}}).webp().toBuffer()).toString('base64');
const page1='data:image/jpeg;base64,'+(await sharp({create:{width:60,height:84,channels:3,background:'#ffffff'}}).jpeg().toBuffer()).toString('base64');
const browser=await chromium.launch({...process.env.SORA_BROWSER_EXECUTABLE?{executablePath:process.env.SORA_BROWSER_EXECUTABLE}:{channel:process.env.SORA_BROWSER_CHANNEL||'msedge'},headless:true}),errors=[],checks=[];
const page=await browser.newPage({viewport:{width:1400,height:1000}});page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(({image,page1})=>{
 const listeners=[],calls=[];window.__hostCalls=calls;window.__selection='image';
 const files={image:[{id:'a'.repeat(32),name:'Photo.png',format:'PNG',validated:true,bytes:1000}],pdf:[{id:'b'.repeat(32),name:'Report.pdf',format:'PDF',validated:true,bytes:1000}],many:[{id:'c'.repeat(32),name:'One.png',format:'PNG',validated:true,bytes:10},{id:'d'.repeat(32),name:'Two.pdf',format:'PDF',validated:true,bytes:10}]};
 const previews={image:[{index:0,kind:'image',src:image,width:400,height:200,sourceWidth:800,sourceHeight:400}],pdf:[{index:0,kind:'pdf',pages:3,thumbs:[1,2,3].map(page=>({page,src:page1,width:60,height:84}))}],many:[{index:0,kind:'image',src:image,width:400,height:200,sourceWidth:800,sourceHeight:400},{index:1,kind:'pdf',pages:3,thumbs:[{page:1,src:page1,width:60,height:84}]}]};
 const reply=message=>{calls.push(message);let result,ok=true,error;
  switch(message.method){
   case 'getState':result={platform:'windows',output:'source',theme:'light',license:'trial',plan:'trial',expiresAt:1900000000,version:'Development build'};break;
   case 'selectFiles':result={files:files[window.__selection],rejected:false};break;
   case 'previewSelection':result={previews:previews[window.__selection]};break;
   case 'releaseSelection':result={released:true};break;
   case 'processFiles':result={state:'completed',path:'C:/out.png',name:'out.png',bytes:10};break;
   default:ok=false;error='Unavailable';
  }
  setTimeout(()=>listeners.forEach(fn=>fn({data:{protocol:1,id:message.id,ok,result,error}})),0);
 };
 window.chrome=window.chrome||{};Object.defineProperty(window.chrome,'webview',{value:{postMessage:reply,addEventListener:(_name,fn)=>listeners.push(fn)}});
},{image,page1});
const lastProcess=async()=>(await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1))).params;
const openTool=async(query)=>{await page.locator('.sidebar').getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill(query);await page.keyboard.press('Enter');await page.locator('#processing-form').waitFor();};
const choose=async(selection)=>{
 await page.evaluate(value=>{window.__selection=value;},selection);
 if(await page.getByRole('button',{name:'Clear selection',exact:true}).count())await page.getByRole('button',{name:'Clear selection',exact:true}).click();
 await page.getByRole('button',{name:'Choose files',exact:true}).first().click();
};
try{
 await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('heading',{name:'File tools for your desktop.'}).waitFor();
 await choose('image');await openTool('resize image');
 const frame=page.locator('.canvas-frame.is-cropping');await frame.waitFor();
 assert.equal(await page.locator('#processing-form [data-crop-only]').isVisible(),true);
 assert.equal(await page.getByLabel('Width (px)').inputValue(),'800');assert.equal(await page.getByLabel('Height (px)').inputValue(),'400');
 checks.push('Single image shows a crop canvas; size fields start at the source size');
 await page.getByRole('button',{name:'1:1',exact:true}).click();
 assert.equal(await page.getByLabel('Width (px)').inputValue(),'400');assert.equal(await page.getByLabel('Height (px)').inputValue(),'400');
 assert.match(await page.locator('[data-crop-caption]').innerText(),/Crop 400 × 400 px/);
 assert.equal(await page.getByRole('button',{name:'1:1',exact:true}).getAttribute('aria-pressed'),'true');
 checks.push('Ratio chip crops centrally, shows the selected state and sets the output size');
 const box=await page.locator('.crop-box').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-500,box.y+box.height/2,{steps:5});await page.mouse.up();
 await page.getByRole('button',{name:'Process files',exact:true}).click();await page.waitForFunction(()=>window.__hostCalls.some(call=>call.method==='processFiles'));
 let request=await lastProcess();
 assert.equal(request.tool,'resize-image');assert.deepEqual(request.options.crop,{left:0,top:0,width:400,height:400});
 assert.equal(request.options.width,400);assert.equal(request.options.height,400);assert.equal(request.options.fit,'inside');
 checks.push('Dragging moves the frame within the image; processing receives the exact source-pixel crop');
 await page.getByRole('button',{name:'Free',exact:true}).click();
 const handle=await page.locator('.crop-handle[data-handle="br"]').boundingBox();
 await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+100,handle.y+handle.height/2-60,{steps:5});await page.mouse.up();
 assert.doesNotMatch(await page.locator('[data-crop-caption]').innerText(),/Crop 400 × 400/);
 checks.push('Free ratio corner handle resizes the frame');
 await page.locator('.crop-box').focus();const before=await page.locator('.crop-box').getAttribute('style');await page.keyboard.press('Shift+ArrowRight');
 assert.notEqual(await page.locator('.crop-box').getAttribute('style'),before);checks.push('Arrow keys move the crop frame');
 await page.getByRole('button',{name:'Original',exact:true}).click();
 await page.getByLabel('Width (px)').fill('200');assert.equal(await page.getByLabel('Height (px)').inputValue(),'100');
 checks.push('Keep aspect ratio links width and height');
 await page.locator('input[name="fit"][value="contain"]').check();assert.equal(await page.getByLabel('Padding colour').isVisible(),true);
 await page.getByLabel('Padding colour').selectOption('transparent');
 await page.locator('.segmented label',{hasText:'Percentage'}).click();assert.equal(await page.getByLabel('Width (px)').isVisible(),false);
 await page.getByRole('button',{name:'Process files',exact:true}).click();await page.waitForFunction(()=>window.__hostCalls.filter(call=>call.method==='processFiles').length===2);
 request=await lastProcess();assert.equal(request.options.percent,100);assert.equal(request.options.width,undefined);assert.equal(request.options.fit,'contain');assert.equal(request.options.background,'transparent');
 checks.push('Percentage mode, pad mode and transparent padding reach processing');
 await openTool('rotate pdf');await choose('pdf');
 await page.locator('.page-thumb[data-page-number="1"]').waitFor();
 await page.locator('.page-thumb[data-page-number="1"]').click();await page.locator('.page-thumb[data-page-number="3"]').click();
 assert.equal(await page.getByLabel('Pages to rotate').inputValue(),'1, 3');
 await page.getByLabel('Pages to rotate').fill('2-3');
 assert.deepEqual(await page.locator('.page-thumb[aria-pressed="true"]').evaluateAll(nodes=>nodes.map(node=>node.dataset.pageNumber)),['2','3']);
 checks.push('PDF thumbnails and the page field stay in sync in both directions');
 await openTool('split pdf');await page.locator('.page-thumb[data-page-number="2"]').click();
 assert.equal(await page.getByLabel('Split into').inputValue(),'selected');assert.equal(await page.getByLabel('Pages to extract').inputValue(),'2');
 checks.push('Picking a page in Split switches to selected pages');
 await openTool('image converter');await choose('many');
 await page.locator('.thumb-grid li').first().waitFor();assert.equal(await page.locator('.thumb-grid li').count(),2);
 assert.equal(await page.locator('.canvas-frame').count(),0);checks.push('Several files show a thumbnail grid');
 await openTool('compress pdf');await choose('pdf');
 const strength=page.getByLabel('Compression strength',{exact:true});
 assert.equal(await page.locator('.strength-field output').innerText(),'60 · Balanced');
 assert.equal(await page.getByLabel('At strength 100 only, allow a smaller-file option').isDisabled(),true);
 await strength.focus();await page.keyboard.press('End');
 assert.equal(await page.locator('.strength-field output').innerText(),'100 · Maximum safe');
 await page.getByLabel('At strength 100 only, allow a smaller-file option').check();
 await page.getByRole('button',{name:'Process files',exact:true}).click();
 await page.waitForFunction(()=>window.__hostCalls.filter(call=>call.method==='processFiles').at(-1)?.params.tool==='compress-pdf');
 assert.deepEqual((await lastProcess()).options,{strength:100,smallest:true});
 checks.push('Compress PDF: strength slider shows the level name; smaller-file option unlocks only at 100');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:'PASS',checks},null,1));
}catch(error){
 const debug=await page.evaluate(()=>({calls:window.__hostCalls.map(call=>call.method),canvas:document.querySelector('#workspace-canvas')?.outerHTML.slice(0,300)??null,heading:document.querySelector('h1')?.textContent,main:document.querySelector('main')?.innerText.slice(0,400)})).catch(()=>null);
 console.error(JSON.stringify({status:'FAIL',checks,errors,debug},null,1));throw error;
}finally{await browser.close();server.close();}
