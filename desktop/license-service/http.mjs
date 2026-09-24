import {createServer} from 'node:http';
import {createHmac} from 'node:crypto';
import {RateLimiter} from './request-guard.mjs';

const actions=new Set(['trial','activate','refresh','validate','devices','replacementRequest','replacementStatus']);
const fail=(status,code)=>Object.assign(Error(code),{httpStatus:status});
function exact(value,keys){if(!value||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw fail(400,'Invalid request');}
async function readBody(req,maxBytes){
 if(req.headers['content-encoding'])throw fail(415,'Encoding not supported');
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type']||''))throw fail(415,'JSON required');
 const length=req.headers['content-length'];if(length&&(!/^\d+$/.test(length)||Number(length)>maxBytes))throw fail(413,'Request too large');
 const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>maxBytes)throw fail(413,'Request too large');chunks.push(chunk);}return Buffer.concat(chunks);
}
function json(res,status,body){if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer'});res.end(JSON.stringify(body));}

// Bind behind configured TLS ingress in production. No trust is placed in forwarded
// headers, browser origins, caller-supplied IPs, payment redirect parameters or plans.
export function createLicenseHttpServer({service,webhooks,rateSecret,limiter=new RateLimiter({limit:30}),onFailure=()=>{}}){
 if(!(rateSecret instanceof Uint8Array)||rateSecret.length<32)throw Error('Rate key required');
 const server=createServer({maxHeaderSize:8192,requestTimeout:15000,headersTimeout:10000},async(req,res)=>{
  try{
   const url=req.url;if(req.headers.origin)throw fail(403,'Origin not allowed');
   if(url==='/health'&&req.method==='GET'){json(res,200,{status:'ok'});return;}
   if(req.method!=='POST')throw fail(405,'Method not allowed');
   const route=url?.match(/^\/v1\/(challenge|trial|activate|refresh|validate|devices|replacementRequest|replacementStatus)$/);
   if(!route&&url!=='/webhooks/dodo')throw fail(404,'Not found');
   // Hash transient socket addresses; never persist address or raw request data.
   const rateKey=createHmac('sha256',rateSecret).update(req.socket.remoteAddress||'unknown').digest('hex');
   try{limiter.take((url==='/webhooks/dodo'?'webhook:':'license:')+rateKey);}catch{throw fail(429,'Too many requests');}
   const raw=await readBody(req,url==='/webhooks/dodo'?1024*1024:16384);
   if(url==='/webhooks/dodo'){
    let receipt;try{receipt=webhooks.accept(raw,req.headers);}catch{throw fail(400,'Invalid webhook');}
    json(res,202,receipt);return;
   }
   let body;try{body=JSON.parse(raw.toString('utf8'));}catch{throw fail(400,'Invalid JSON');}
   if(route[1]==='challenge'){
    exact(body,['action','body','publicKey']);if(!actions.has(body.action)||typeof body.publicKey!=='string'||body.publicKey.length>2048)throw fail(400,'Invalid challenge request');
    json(res,200,service.challenge(body));return;
   }
   exact(body,['body','publicKey','signature','token']);
   if(typeof body.publicKey!=='string'||body.publicKey.length>2048||typeof body.signature!=='string'||body.signature.length>128||typeof body.token!=='string'||body.token.length>2048)throw fail(400,'Invalid proof');
   const response=await service.execute(route[1],body);json(res,200,response);
  }catch(error){
   // Do not echo key material, provider response bodies, paths or stack traces.
   const status=error.httpStatus||(error.code==='providerUnavailable'?503:400);try{onFailure({status});}catch{}
   json(res,status,{error:error.code==='activationReconciliation'?'Your activation needs to be checked before another attempt. Contact SoraFiles support if it remains pending.':status===503?'License verification is temporarily unavailable. Please try again later.':status===429?'Please wait a moment and try again.':status===413?'The request is too large.':'The request could not be completed. Check your details and try again.'});
  }
 });
 server.keepAliveTimeout=5000;server.maxRequestsPerSocket=100;
 return server;
}
