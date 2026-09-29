// Desktop rating contract: shared aggregate in the heading, occasional prompt
// only after successful runs, keyboard rating, silent failures, persistence.
import {chromium} from 'playwright';import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';import {once} from 'node:events';import assert from 'node:assert/strict';
const folder=resolve('.artifacts/desktop-ui');
const server=createServer(async(req,res)=>{try{const path=resolve(folder,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!path.startsWith(folder+sep))throw Error('path');const data=await readFile(path);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'}[extname(path)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({...process.env.SORA_BROWSER_EXECUTABLE?{executablePath:process.env.SORA_BROWSER_EXECUTABLE}:{channel:process.env.SORA_BROWSER_CHANNEL||'msedge'},headless:true}),errors=[],checks=[];
const mock=({failSubmit=false}={})=>({failSubmit});
async function open(options={}){
 const context=await browser.newContext({viewport:{width:1300,height:950}});const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(({failSubmit})=>{
  Math.random=()=>0;
  const listeners=[],calls=[];window.__hostCalls=calls;
  let aggregate={subject:'resize-image',count:1284,average:4.82,userRating:null};
  const reply=message=>{calls.push(message);let result,ok=true,error;
   switch(message.method){
    case 'getState':result={platform:'windows',output:'source',theme:'light',license:'trial',plan:'trial',expiresAt:1900000000,version:'Development build'};break;
    case 'selectFiles':result={files:[{id:'a'.repeat(32),name:'Photo.png',format:'PNG',validated:true,bytes:1000}],rejected:false};break;
    case 'previewSelection':result={previews:[]};break;
    case 'processFiles':result={state:'completed',path:'C:/out.png',name:'out.png',bytes:10};break;
    case 'ratingStatus':result={rating:{...aggregate,subject:message.params.subject}};break;
    case 'ratingSubmit':if(failSubmit){ok=false;error='Ratings are unavailable right now.';break;}aggregate={...aggregate,count:aggregate.count+1,userRating:message.params.rating};result={rating:aggregate};break;
    default:ok=false;error='Unavailable';
   }
   setTimeout(()=>listeners.forEach(fn=>fn({data:{protocol:1,id:message.id,ok,result,error}})),0);
  };
  window.chrome=window.chrome||{};Object.defineProperty(window.chrome,'webview',{value:{postMessage:reply,addEventListener:(_name,fn)=>listeners.push(fn)}});
 },mock(options));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('heading',{name:'File tools for your desktop.'}).waitFor();
 await page.getByRole('button',{name:'Choose files',exact:true}).first().click();await page.locator('.selected li').first().waitFor();
 await page.locator('.sidebar').getByRole('button',{name:'All tools',exact:true}).click();await page.getByRole('searchbox').fill('resize image');await page.keyboard.press('Enter');await page.locator('#processing-form').waitFor();
 return {context,page};
}
const run=async page=>{const before=await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='processFiles').length);await page.getByRole('button',{name:'Process files',exact:true}).click();await page.waitForFunction(count=>window.__hostCalls.filter(call=>call.method==='processFiles').length>count&&document.querySelector('#pending-action').hidden,before);};
try{
 let {context,page}=await open();
 await page.locator('.tool-rating').waitFor();
 assert.match(await page.locator('.tool-rating').innerText(),/4\.8\s*·\s*1,284 ratings/);
 assert.equal(await page.locator('.tool-rating').getAttribute('aria-label'),'4.8 out of 5 · 1,284 ratings');
 checks.push('Workspace heading shows the shared aggregate from the rating service');
 assert.equal(await page.locator('.rating-prompt').count(),0,'no prompt before using the tool');
 await run(page);assert.equal(await page.locator('.rating-prompt').count(),0,'no prompt after the first success');
 await run(page);await page.locator('.rating-prompt').waitFor();
 checks.push('Prompt appears only after repeated successful use');
 await page.getByRole('radio',{name:'1 star'}).focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
 await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='ratingSubmit').length),0,'arrow keys only choose');
 await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__hostCalls.some(call=>call.method==='ratingSubmit'));
 const submit=await page.evaluate(()=>window.__hostCalls.filter(call=>call.method==='ratingSubmit').map(call=>call.params));
 assert.deepEqual(submit.at(-1),{subject:'resize-image',rating:4});
 await page.getByText('Thanks for rating!').waitFor();
 checks.push('Keyboard: arrows choose without submitting, Enter confirms once; stars are labelled radios');
 await page.locator('.rating-prompt').waitFor({state:'detached',timeout:8000});
 await run(page);assert.equal(await page.locator('.rating-prompt').count(),0,'never asks again after rating');
 await page.reload();await page.getByRole('heading',{name:'File tools for your desktop.'}).waitFor();
 assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('sf-rating-prompts'))).rated['resize-image'],4,'rating state persists across restarts');
 checks.push('Prompt never returns after rating, including after a restart');
 await context.close();
 ({context,page}=await open({failSubmit:true}));
 await run(page);await run(page);await page.locator('.rating-prompt').waitFor();
 await page.getByRole('radio',{name:'5 stars'}).check();
 await page.getByText('Your rating could not be sent. Your files are not affected. Please try again later.').waitFor();
 assert.equal(await page.getByRole('radio',{name:'5 stars'}).isEnabled(),true,'can retry after a failure');
 await page.getByRole('button',{name:'Not now',exact:true}).click();assert.equal(await page.locator('.rating-prompt').count(),0);
 const stored=JSON.parse(await page.evaluate(()=>localStorage.getItem('sf-rating-prompts')));assert.ok(stored.dismissed['resize-image']>0&&stored.lastDismissed>0);
 await run(page);await run(page);assert.equal(await page.locator('.rating-prompt').count(),0,'no prompt soon after a dismissal');
 checks.push('Failures are shown gently and allow retry; Not now is remembered');
 await context.close();
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:'PASS',checks},null,1));
}catch(error){console.error(JSON.stringify({status:'FAIL',checks,errors},null,1));throw error;}finally{await browser.close();server.close();}
