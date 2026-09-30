// Desktop renderer contract only. Synthetic bridge responses do not certify delivery or payments.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
const folder=resolve('.artifacts/desktop-ui');
const server=createServer(async(req,res)=>{try{const path=resolve(folder,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!path.startsWith(folder+sep))throw Error();const bytes=await readFile(path);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'}[extname(path)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({...process.env.SORA_BROWSER_EXECUTABLE?{executablePath:process.env.SORA_BROWSER_EXECUTABLE}:{channel:process.env.SORA_BROWSER_CHANNEL||'msedge'},headless:true});
try{
 const page=await browser.newPage({viewport:{width:1180,height:900}});
 await page.addInitScript(()=>{
  const listeners=[];window.__calls=[];let stage='idle';const fee={plan:'team-lifetime',amount:7999,currency:'USD',formatted:'$79.99',perSeat:true};
  const snapshot=()=>({replacement:{stage:window.__forceStage??stage,maskedEmail:'j***@example.com',expiresAt:1900000000,resendAfter:1800000000,plan:'team-lifetime',fee,devices:window.__emptySeats?[]:[{id:'a'.repeat(43),current:true,active:true}],...(stage==='payment'?{status:'payment-pending',checkoutAvailable:true}:{})}});
  window.chrome=window.chrome||{};Object.defineProperty(window.chrome,'webview',{value:{addEventListener:(_name,fn)=>listeners.push(fn),postMessage:message=>{
   window.__calls.push(message);let result={};
   if(message.method==='getState')result={license:'not-activated',platform:'windows'};
   if(message.method==='replacementState')result=snapshot();
   if(message.method==='replacementEmailStart'||message.method==='replacementEmailResend'){stage='email';result=snapshot();}
   if(message.method==='replacementReset'){stage='idle';result={replacement:{stage:'idle',email:'buyer@example.com'}};}
   if(message.method==='replacementEmailVerify'){stage='verified';result=snapshot();}
   if(message.method==='replacementRequest'){stage='payment';result=snapshot();}
   if(message.method==='replacementCheckout')result={opened:true};
   if(message.method==='replacementStatus'){stage='complete';result={...snapshot(),license:'revoked',plan:'',activationAvailable:true,trialPending:false,expiresAt:null};}
   queueMicrotask(()=>listeners.forEach(fn=>fn({data:{protocol:1,id:message.id,ok:true,result}})));
  }}});
 });
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.getByRole('button',{name:'License',exact:true}).click();
 await page.evaluate(()=>{window.__emptySeats=true;window.__forceStage='verified'});
 await page.getByRole('button',{name:'Revoke Device',exact:true}).click();
 await page.getByText(/No occupied device is available to revoke/).waitFor();
 assert.equal(await page.getByRole('button',{name:'Verify email again',exact:true}).count(),0);
 await page.getByRole('button',{name:'Back to license',exact:true}).click();
 await page.evaluate(()=>{window.__emptySeats=false;window.__forceStage=undefined});
 await page.getByRole('button',{name:'Revoke Device',exact:true}).click();
 // Opening the screen sends nothing; an empty email is refused locally.
 await page.getByLabel('Email used for purchase',{exact:true}).waitFor();
 assert.equal((await page.evaluate(()=>window.__calls)).some(call=>/replacementEmail(Start|Resend)/.test(call.method)),false);
 await page.getByLabel('License key',{exact:true}).fill('synthetic-private-key');await page.getByRole('button',{name:'Send code',exact:true}).click();
 await page.getByText('Enter the email address you used for your purchase.',{exact:true}).waitFor();
 assert.equal((await page.evaluate(()=>window.__calls)).some(call=>call.method==='replacementEmailStart'),false);
 await page.getByLabel('Email used for purchase',{exact:true}).fill(' Buyer@Example.com ');await page.getByLabel('License key',{exact:true}).fill('synthetic-private-key');
 await page.getByRole('button',{name:'Send code',exact:true}).click();
 await page.getByText('j***@example.com',{exact:true}).waitFor();
 assert.deepEqual((await page.evaluate(()=>window.__calls)).find(call=>call.method==='replacementEmailStart').params,{email:'Buyer@Example.com',licenseKey:'synthetic-private-key'});
 assert.equal(await page.getByRole('button',{name:'Resend code',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Use a different email',exact:true}).click();await page.getByLabel('Email used for purchase',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Email used for purchase',{exact:true}).inputValue(),'buyer@example.com');
 await page.getByLabel('License key',{exact:true}).fill('synthetic-private-key');await page.getByRole('button',{name:'Send code',exact:true}).click();await page.getByText('j***@example.com',{exact:true}).waitFor();
 await page.getByLabel('Email verification code',{exact:true}).fill('12345678');await page.getByRole('button',{name:'Verify email',exact:true}).click();
 await page.getByRole('button',{name:'Pay $79.99 and revoke',exact:true}).waitFor();
 assert.match(await page.getByLabel('Device to revoke',{exact:true}).innerText(),/This device/);
 assert.equal((await page.evaluate(()=>window.__calls)).some(call=>call.method==='replacementRequest'),false);
 await page.getByRole('button',{name:'Pay $79.99 and revoke',exact:true}).click();await page.getByRole('button',{name:'Check payment',exact:true}).waitFor();
 const calls=await page.evaluate(()=>window.__calls);assert.deepEqual(calls.find(call=>call.method==='replacementEmailVerify').params,{code:'12345678'});
 assert.deepEqual(calls.find(call=>call.method==='replacementRequest').params,{oldDeviceId:'a'.repeat(43)});
 assert.deepEqual(calls.find(call=>call.method==='replacementCheckout').params,{});
 assert.equal(await page.locator('body').innerText().then(text=>/Dodo|Cloudflare|identityToken|anti-resale/.test(text)),false);
 await page.getByRole('button',{name:'Check payment',exact:true}).click();await page.getByText('The selected device has been revoked and its license seat is free.',{exact:true}).waitFor();
 await page.getByText(/To process files on that device again, enter the same or a new license key and activate it online/).waitFor();
 assert.equal((await page.evaluate(()=>window.__calls)).some(call=>call.method==='activate'),false);
 await page.getByRole('button',{name:'Back to license',exact:true}).click();
 await page.getByRole('heading',{name:'Device revoked',exact:true}).waitFor();
 await page.getByLabel('License key',{exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Setting up your trial',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Replace device',exact:true}).count(),0);
 await page.getByRole('button',{name:'Revoke Device',exact:true}).click();
 await page.getByRole('button',{name:'Send code',exact:true}).waitFor();await page.getByLabel('Email used for purchase',{exact:true}).waitFor();
 await page.getByLabel('License key',{exact:true}).waitFor();
 assert.equal(await page.getByText('The selected device has been revoked and its license seat is free.',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Back to license',exact:true}).click();
 await page.evaluate(()=>{window.__emptySeats=true;window.__forceStage='verified'});
 await page.getByRole('button',{name:'Revoke Device',exact:true}).click();
 await page.getByText(/No occupied device is available to revoke/).waitFor();
 assert.equal(await page.getByRole('button',{name:'Verify email again',exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 console.log('PASS: Desktop Revoke Device sends nothing on open, requires a typed purchase email and explicit Send code, disables early resend, resets on email change; masked address, masked address, explicit exact fee consent, native checkout without URL, and payment status renderer flow.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
