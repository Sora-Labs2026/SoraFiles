// Run the actual Web worker and Desktop worker against the same existing local
// fixtures/model. All HTTP traffic stays on an ephemeral loopback fixture server.
import {build} from 'vite';import {chromium} from 'playwright';import {createServer} from 'node:http';import {once} from 'node:events';
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve,join,extname,sep} from 'node:path';import {createHash} from 'node:crypto';
import sharp from 'sharp';import {removeBackground} from '../core/background.mjs';import {backgroundModel} from '../shared/background-model.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),root=resolve('.artifacts/parity-background-ui');await mkdir(root,{recursive:true});
await writeFile(join(root,'index.html'),'<html><body><script type="module" src="/entry.js"></script></body></html>');
await writeFile(join(root,'entry.js'),`import Worker from '../../src/workers/background-removal.worker?worker';
window.runWeb=bytes=>new Promise((resolve,reject)=>{const worker=new Worker(),timer=setTimeout(()=>{worker.terminate();reject(Error('Web timeout'));},180000);worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(Error('Web worker error'));};worker.onmessage=async({data})=>{if(data.type==='result'){clearTimeout(timer);worker.terminate();resolve(Array.from(new Uint8Array(await data.blob.arrayBuffer())));}else if(data.type==='error'){clearTimeout(timer);worker.terminate();reject(Error('Web inference rejected'));}};worker.postMessage({file:new Blob([new Uint8Array(bytes)]),publicPath:location.origin+'/model/',device:'cpu',model:'isnet_quint8',pixelLimit:12000000,cleanup:false});});`);
await build({configFile:false,root,publicDir:false,build:{outDir:'dist',emptyOutDir:true,target:'es2022'}});
const served=join(root,'dist'),manifestBytes=await readFile(resolve('.artifacts/desktop-probe-cache',hash(backgroundModel.origin+'resources.json')));
if(hash(manifestBytes)!==backgroundModel.manifestSha256)throw Error('Model manifest changed');
const allowed=new Map();for(const asset of Object.values(JSON.parse(manifestBytes)))for(const chunk of asset.chunks)allowed.set(chunk.name,chunk.hash);
const server=createServer(async(req,res)=>{try{
 if(req.method!=='GET')throw Error();const url=new URL(req.url,'http://local');let bytes;
 if(url.pathname.startsWith('/model/')){
  const name=url.pathname.slice(7);if(name==='resources.json')bytes=manifestBytes;else{if(!allowed.has(name))throw Error();bytes=await readFile(resolve('.artifacts/desktop-probe-cache',hash(backgroundModel.origin+name)));if(hash(bytes)!==allowed.get(name))throw Error();}
 }else{const file=resolve(served,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(served+sep))throw Error();bytes=await readFile(file);}
 res.writeHead(200,{'Content-Type':url.pathname==='/'?'text/html':extname(url.pathname)==='.js'?'text/javascript':'application/octet-stream','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cross-Origin-Resource-Policy':'same-origin'});res.end(bytes);
 }catch{res.writeHead(404);res.end();}});
server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({...(process.env.SORA_BROWSER_EXECUTABLE?{executablePath:process.env.SORA_BROWSER_EXECUTABLE}:{channel:process.env.SORA_BROWSER_CHANNEL||'msedge'}),headless:true});
const results=[];try{
 const page=await browser.newPage();await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());await page.goto(origin);await page.waitForFunction(()=>typeof window.runWeb==='function');
 for(const name of ['product','hair','soft-alpha']){
  const input=await readFile('.artifacts/astra-complex/'+name+'.png'),source=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const web=Buffer.from(await page.evaluate(bytes=>window.runWeb(bytes),[...input]));const desktop=await removeBackground(input);
  const a=await sharp(web).ensureAlpha().raw().toBuffer(),b=await sharp(desktop.bytes).ensureAlpha().raw().toBuffer();if(a.length!==b.length||b.length!==source.data.length)throw Error('Output dimensions changed');
  let alphaError=0,max=0,intersection=0,union=0,alphaIncrease=0;
  for(let i=3;i<a.length;i+=4){const delta=Math.abs(a[i]-b[i]);alphaError+=delta;max=Math.max(max,delta);if(a[i]>127&&b[i]>127)intersection++;if(a[i]>127||b[i]>127)union++;if(b[i]>source.data[i])alphaIncrease++;}
  await writeFile(join(root,name+'-web.png'),web);await writeFile(join(root,name+'-desktop.png'),desktop.bytes);
  results.push({fixture:name,sha256:hash(input),width:source.info.width,height:source.info.height,alphaMAE:alphaError/(a.length/4),maxAlphaDifference:max,foregroundIoU:union?intersection/union:1,sourceAlphaIncreasePixels:alphaIncrease});
  console.log(JSON.stringify(results.at(-1)));
 }
 const report={status:'MEASURED',scope:'Actual Web/desktop workers, CPU ISNET uint8, cleanup disabled, existing local synthetic fixtures. Default fp16 Web model, GPU, real photos and full parity are not certified.',results};await mkdir('.artifacts/parity',{recursive:true});await writeFile('.artifacts/parity/background-workers.json',JSON.stringify(report,null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
