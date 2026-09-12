// Test-only loopback server. Downloads only allowlisted engine assets; no file-upload endpoint.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('.artifacts/desktop-probe-ui'),cache=resolve('.artifacts/desktop-probe-cache');
await mkdir(cache,{recursive:true});const offline=process.argv.includes('--offline');
const origins={office:'https://cdn.zetaoffice.net/zetaoffice_latest/',model:'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/'};
const types={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.png':'image/png'};
const server=createServer(async(req,res)=>{try{
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}
 if(req.headers.host!=='127.0.0.1:8128'){res.writeHead(403);res.end();return;}
 const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1:8128').pathname);
 if(path.includes('\\')||path.includes('\0')||path.split('/').includes('..'))throw Error('Path');
 let data,type=path==='/'?'text/html; charset=utf-8':types[extname(path)]||'application/octet-stream';
 const match=path.match(/^\/(office|model)\/([A-Za-z0-9_./-]+)$/);
 if(match){const url=new URL(match[2],origins[match[1]]);if(!url.href.startsWith(origins[match[1]]))throw Error('Origin');
  const key=createHash('sha256').update(url.href).digest('hex'),file=resolve(cache,key);
  try{data=await readFile(file);}catch{if(offline)throw Error('Pack asset missing offline');const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(180000)});if(!response.ok)throw Error('Asset '+response.status);data=Buffer.from(await response.arrayBuffer());await writeFile(file,data);await writeFile(file+'.json',JSON.stringify({url:url.href,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}));console.log('Cached',match[1],match[2],data.length);}
 }else if(path.startsWith('/fixture/')){const name=path.slice(9);if(!['complex.docx','product.png'].includes(name))throw Error('Fixture');data=await readFile(resolve('.artifacts/astra-complex',name));}
 else {const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+sep))throw Error('Path');data=await readFile(file);
  if(path.endsWith('/zetaHelper.js'))data=Buffer.from(data.toString().replace('https://cdn.zetaoffice.net/zetaoffice_latest/','https://sorafiles-probe.invalid/office/'));
 }
 res.writeHead(200,{'Content-Type':type,'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cross-Origin-Resource-Policy':'same-origin','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self' blob: data:; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' blob: data:; worker-src 'self' blob: data:; connect-src 'self' blob: data:; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; frame-src 'self' about:;"});res.end(data);
 }catch(e){console.log('Probe resource failed',req.url,e.message);res.writeHead(404);res.end('Probe resource unavailable');}});
server.listen(8128,'127.0.0.1',()=>console.log('Native probe server ready; asset fetch mode:',offline?'offline':'allowlisted download'));
