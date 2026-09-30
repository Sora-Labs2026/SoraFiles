// Regression: dismiss completed results when the last selected input is removed.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
const directory=resolve('.artifacts/desktop-ui');
const server=createServer(async(req,res)=>{try{const path=resolve(directory,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!path.startsWith(directory+sep))throw Error();res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const batch of [false,true])for(const remove of [false,true]){
  const page=await browser.newPage();
  await page.addInitScript(({batch})=>{
   const file={id:'a'.repeat(32),name:'Original.pdf',format:'PDF',validated:true,bytes:123};
   window.__calls=[];
   window.chrome={webview:{postMessage(message){window.__calls.push(message);const output={state:'completed',name:'warm image-images.pdf',outputId:'b'.repeat(32)};let result=message.method==='getState'?{platform:'windows',theme:'light',output:'source',license:'trial',files:[file],job:{busy:false,tool:'rotate-pdf',sources:['Original.pdf'],result:batch?{state:'batch',results:[{...output,index:0}]}:output}}:{released:true};setTimeout(()=>window.__reply({data:{protocol:1,id:message.id,ok:true,result}}),0);},addEventListener(name,callback){window.__reply=callback;}}};
  },{batch});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('button',{name:'Open result',exact:true}).waitFor();
  if(remove)await page.locator('[data-remove]').click();else await page.getByRole('button',{name:'Clear selection',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('[data-remove]'));
  assert.equal(await page.locator('[data-open-output],[data-reveal-output]').count(),0);
  assert.equal(await page.getByText('warm image-images.pdf',{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.method==='releaseSelection').length),1);
  await page.close();
 }
 console.log('PASS: single and batch results cleared by Clear selection and removing the final file.');
}finally{await browser.close();server.close();}
