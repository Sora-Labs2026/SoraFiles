import {createServer} from 'node:http';
import {createHmac} from 'node:crypto';
import {RateLimiter} from './request-guard.mjs';
// Deploy behind HTTPS, same first-party origin and ingress request limits. The
// injected identity verifier must bind a verified email/account to a Dodo customer.
export function createPromotionHttpServer({promotions,rateSecret,issueIdentitySession=null,origin='https://sorafiles.com'}){
 if(!(typeof rateSecret==='string'||rateSecret instanceof Uint8Array)||rateSecret.length<32||new URL(origin).origin!==origin||!origin.startsWith('https://')||issueIdentitySession!==null&&typeof issueIdentitySession!=='function')throw Error('Promotion HTTP configuration required');
 const sessions=new RateLimiter({limit:12});
 return createServer({maxHeaderSize:8192,requestTimeout:15000},async(req,res)=>{
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"});res.end(JSON.stringify(data));};
  if(req.method!=='POST'||!['/api/desktop/redeem','/api/desktop/redemption-session'].includes(req.url))return reply(404,{error:'Not found.'});
  if(req.headers.origin!==origin||req.headers['content-type']?.split(';')[0]!=='application/json')return reply(403,{error:'Request not accepted.'});
  try{
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>12000){reply(413,{error:'Request too large.'});req.resume();return;}chunks.push(chunk);}
   let request;try{request=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return reply(400,{error:'Check your request.'});}
   const rateBucket=createHmac('sha256',rateSecret).update(req.socket.remoteAddress||'unknown').digest('hex');
   if(req.url==='/api/desktop/redemption-session'){
    try{sessions.take(rateBucket);}catch{return reply(429,{error:'Please wait before trying again.'});}
    if(!request||Object.getPrototypeOf(request)!==Object.prototype||Object.keys(request).length)return reply(400,{error:'Request not accepted.'});
    if(!issueIdentitySession)return reply(503,{error:'Recipient verification is not configured.'});
    // Only the deployment adapter can verify an existing HttpOnly account cookie
    // and mint a short-lived proof accepted by PromotionService.verifyIdentity.
    const token=await issueIdentitySession({cookie:req.headers.cookie||''});
    if(typeof token!=='string'||!token||token.length>8192)return reply(401,{error:'Verify your invitation account.'});
    return reply(200,{identityToken:token});
   }
   reply(200,await promotions.redeem(request,{rateBucket}));
  }catch(error){const status=error.code==='rateLimited'?429:error.code==='redemptionPending'?503:400;reply(status,{error:status===429?'Please wait before trying again.':status===503?'Your redemption is being prepared. Retry with the same verified account.':'This code cannot be redeemed. Check your code or contact support.'});}
 });
}
