const routes=new Set(['/api/desktop/redeem','/api/desktop/redemption-session']);
const closed=status=>Response.json({error:'Redemption is not ready. Keep your invitation private.'},{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"};
async function boundedJson(response){
 if(!response.body)throw Error('Missing response');const reader=response.body.getReader(),parts=[];let size=0,timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(Error('Response timeout'));void reader.cancel().catch(()=>{});},10000);});
 try{while(true){const {done,value}=await Promise.race([reader.read(),timeout]);if(done)break;size+=value.length;if(size>16384)throw Error('Response too large');parts.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }finally{clearTimeout(timer);void reader.cancel().catch(()=>{});}
}
// Optional binding to the license Worker's named RedemptionGateway. No routing
// or production binding is configured until identity and campaign launch pass.
export async function desktopRedemptionRequest(request,env){
 const url=new URL(request.url);if(!routes.has(url.pathname))return null;
 if(request.method!=='POST'||url.search)return closed(404);
 if(url.origin!=='https://sorafiles.com'||request.headers.get('origin')!=='https://sorafiles.com')return closed(403);
 if(!env.DESKTOP_REDEMPTION)return closed(503);
 try{
  const response=await env.DESKTOP_REDEMPTION.fetch(request);
  // Never forward provider diagnostics, cookies, redirects or arbitrary fields.
  if(response.status!==200){await response.body?.cancel();return closed([400,401,403,404,408,413,415,429,503].includes(response.status)?response.status:503);}
  if(!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();return closed(503);}
  const value=await boundedJson(response);if(!value||typeof value!=='object'||Array.isArray(value))return closed(503);
  if(url.pathname.endsWith('redemption-session')){
   if(typeof value.identityToken!=='string'||!value.identityToken||value.identityToken.length>8192)return closed(503);
   return Response.json({identityToken:value.identityToken},{headers});
  }
  if(typeof value.licenseKey!=='string'||!/^[A-Za-z0-9_-]{6,512}$/.test(value.licenseKey)||!['Personal','Team'].includes(value.edition)||value.maxDevices!==(value.edition==='Personal'?1:5)||value.emailSent!==false||!(value.expiresAt===null||typeof value.expiresAt==='string'&&value.expiresAt.length<=40&&Number.isFinite(Date.parse(value.expiresAt))))return closed(503);
  return Response.json({licenseKey:value.licenseKey,edition:value.edition,maxDevices:value.maxDevices,expiresAt:value.expiresAt,emailSent:false},{headers});
 }catch{return closed(503);}
}
