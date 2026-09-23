const fail=(status)=>Object.assign(Error('Request rejected'),{httpStatus:status});
const actions=new Set(['trial','activate','refresh','devices']);
const exact=(value,keys)=>{if(!value||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw fail(400);};
export function json(status,body){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer'}});}
export function failure(error){const status=error.httpStatus||(error.code==='providerUnavailable'?503:400);return json(status,{error:error.code==='activationReconciliation'?'Your activation needs to be checked before another attempt. Contact SoraFiles support if it remains pending.':status===503?'License verification is temporarily unavailable. Please try again later.':status===429?'Please wait a moment and try again.':status===413?'The request is too large.':'The request could not be completed. Check your details and try again.'});}

export async function readBody(request,max){
 if(request.headers.has('content-encoding')||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')||''))throw fail(415);
 const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>max))throw fail(413);
 const reader=request.body?.getReader();if(!reader)return Buffer.alloc(0);
 const chunks=[];let size=0,timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(fail(408));void reader.cancel().catch(()=>{});},10000);});
 try {
  while(true){const {done,value}=await Promise.race([reader.read(),timeout]);if(done)break;size+=value.byteLength;if(size>max)throw fail(413);chunks.push(Buffer.from(value));}
  return Buffer.concat(chunks);
 } finally {clearTimeout(timer);void reader.cancel().catch(()=>{});}
}

// Entry called only by the binding-owning Worker, which supplies its HMAC bucket.
export async function handleLicenseRequest(request,{service,webhooks,limiter,bucket,getRuntime,acceptWebhook}){
 try {
  if(request.headers.has('origin'))throw fail(403);
  const url=new URL(request.url),path=url.pathname+url.search;
  if(path==='/health'&&request.method==='GET')return json(200,{status:'ok'});
  if(request.method!=='POST')throw fail(405);
  const route=path.match(/^\/v1\/(challenge|trial|activate|refresh|devices)$/),webhook=path==='/webhooks/dodo';
  if(!route&&!webhook)throw fail(404);
  if(!/^[a-f0-9]{64}$/.test(bucket||''))throw fail(403);
  try{limiter.take((webhook?'webhook:':'license:')+bucket);}catch{throw fail(429);}
  const raw=await readBody(request,webhook?1024*1024:16384);
  if(webhook){
   let receipt;try{receipt=acceptWebhook?await acceptWebhook(webhooks,raw,Object.fromEntries(request.headers)):webhooks.accept(raw,Object.fromEntries(request.headers));}catch{throw fail(400);}return json(202,receipt);
  }
  let body;try{body=JSON.parse(raw.toString('utf8'));}catch{throw fail(400);}
  if(route[1]==='challenge'){
   exact(body,['action','body','publicKey']);if(!actions.has(body.action)||typeof body.publicKey!=='string'||body.publicKey.length>2048)throw fail(400);
   if(getRuntime)({service}=await getRuntime());
   return json(200,service.challenge(body));
  }
  exact(body,['body','publicKey','signature','token']);
  if(typeof body.publicKey!=='string'||body.publicKey.length>2048||typeof body.signature!=='string'||body.signature.length>128||typeof body.token!=='string'||body.token.length>2048)throw fail(400);
  if(getRuntime)({service}=await getRuntime());
  return json(200,await service.execute(route[1],body));
 }catch(error){return failure(error);}
}
