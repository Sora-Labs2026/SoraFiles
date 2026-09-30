// Actual built free Web workflow, using only repository-owned synthetic files.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {PDFDocument} from 'pdf-lib';
import assert from 'node:assert/strict';
const root=resolve('dist'),out=resolve('.artifacts/recovery-web-unlock');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 let path=new URL(req.url,'http://local').pathname;if(!extname(path))path=path.replace(/\/$/,'')+'/index.html';
 const file=resolve(root,'.'+path);if(!file.startsWith(root+sep))throw Error();
 const bytes=await readFile(file);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.wasm':'application/wasm','.json':'application/json'}[extname(file)]||'application/octet-stream'});res.end(bytes);
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({...process.env.SORA_BROWSER_EXECUTABLE?{executablePath:process.env.SORA_BROWSER_EXECUTABLE}:{channel:process.env.SORA_BROWSER_CHANNEL||'msedge'},headless:true});
try{
 const context=await browser.newContext({acceptDownloads:true});await context.route('**/*',route=>route.request().url().startsWith(base)||route.request().url().startsWith('blob:')?route.continue():route.abort());
 const page=await context.newPage();await page.goto(base+'/unlock-pdf');
 const workbench=page.locator('[data-extra-workbench]');await workbench.waitFor();
 assert.equal(await page.locator('[data-desktop-promo]').count(),0);
 assert.equal(await page.locator('main a[href^="/desktop"]').count(),0);
 await workbench.locator('input[type=file]').setInputFiles('tests/fixtures/sorafiles-qa/protected.pdf');
 await workbench.locator('[data-extra-password]').fill('SoraQA2026!');
 await workbench.locator('[data-extra-start]').click();
 const downloadLink=workbench.locator('a[download]').first();await downloadLink.waitFor({timeout:60000});
 const downloaded=page.waitForEvent('download');await downloadLink.click();const file=await downloaded;
 const target=resolve(out,'unlocked-fixture.pdf');await file.saveAs(target);
 const document=await PDFDocument.load(await readFile(target));assert.ok(document.getPageCount()>0);assert.equal(document.isEncrypted,false);
 await page.screenshot({path:resolve(out,'free-web-result.png'),fullPage:false});
 await writeFile(resolve(out,'result.json'),JSON.stringify({status:'PASS',pages:document.getPageCount(),encrypted:document.isEncrypted,
  scope:'Actual built free Web Unlock PDF, known-password synthetic input; independently parsed output; no Desktop CTA or license activation'},null,2));
 console.log('PASS: free Web Unlock PDF processed the protected fixture without Desktop licensing; output independently parsed.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
