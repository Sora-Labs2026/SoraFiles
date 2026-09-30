// Local enabled-flow preview only. Publication config and campaigns stay disabled.
import {chromium} from 'playwright';import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';import assert from 'node:assert/strict';
const root=resolve('dist'),out=resolve('.artifacts/redemption-ui-qa'),calls=[];await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://local');
 if(url.pathname.startsWith('/api/')){
  let text='';for await(const chunk of req)text+=chunk;
  const body=JSON.parse(text);calls.push({path:url.pathname,body});
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify(url.pathname.endsWith('session')?{identityToken:'synthetic-verified-session'}:{licenseKey:'synthetic-private-license',edition:'Personal',maxDevices:1,expiresAt:null,emailSent:false}));return;
 }
 let path=url.pathname;if(!extname(path))path=path.replace(/\/$/,'')+'/index.html';const file=resolve(root,'.'+path);if(!file.startsWith(root+sep))throw Error();
 let bytes=await readFile(file);
 if(path==='/desktop/redeem/index.html')bytes=Buffer.from(bytes.toString().replace('data-redemption-enabled="false"','data-redemption-enabled="true"').replace('<p data-redemption-status','<form data-redemption-form><label>Invitation code<input name="code" type="password" autocomplete="off"></label><button type="submit">Redeem invitation</button></form><p data-redemption-status'));
 res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[extname(file)]||'application/octet-stream'});res.end(bytes);
}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.SORA_BROWSER_EXECUTABLE,headless:true});
try{
 const context=await browser.newContext({viewport:{width:375,height:800}});await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/desktop/redeem?code=ignored-url-code');await page.getByLabel('Invitation code',{exact:true}).waitFor();assert.equal(new URL(page.url()).search,'');
 await page.getByLabel('Invitation code',{exact:true}).fill('SORA-SYNTHETIC-INVITATION');await page.getByRole('button',{name:'Redeem invitation',exact:true}).click();
 await page.getByText('Your invitation was redeemed. Save your license key privately.',{exact:true}).waitFor();
 assert.equal(calls.length,2);assert.deepEqual(calls[0].body,{});assert.deepEqual(calls[1].body,{code:'SORA-SYNTHETIC-INVITATION',identityToken:'synthetic-verified-session'});
 assert.equal(await page.locator('[data-redemption-key]').inputValue(),'');await page.getByRole('button',{name:'Show key',exact:true}).click();assert.equal(await page.locator('[data-redemption-key]').inputValue(),'synthetic-private-license');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.locator('script[src*="analytics"]').count(),0);
 assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('synthetic-private-license')),false);
 await page.screenshot({path:resolve(out,'synthetic-redemption.png')});await page.evaluate(()=>dispatchEvent(new Event('pagehide')));assert.equal(await page.locator('[data-redemption-key]').inputValue(),'');assert.equal(await page.locator('[data-redemption-result]').isVisible(),false);assert.deepEqual(errors,[]);
 const report={status:'PASS',scope:'Built page and client with local synthetic identity/redemption; no account verification or Dodo issuance',checks:['code absent from URL','identity requested before code submission','no client edition/device authority','explicit key reveal','no key in browser storage','clear on departure','375px layout','no analytics']};await writeFile(resolve(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
