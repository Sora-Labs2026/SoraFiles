import {createHmac} from 'node:crypto';
import {readBody,json} from './transport.mjs';
const paths=new Map([['/api/desktop/redemption-session','session'],['/api/desktop/redeem','redeem']]);
const reject=status=>Object.assign(Error('Redemption request rejected'),{httpStatus:status});
export function redemptionFailure(error){
 const status=error.httpStatus||(error.code==='rateLimited'?429:error.code==='redemptionPending'||error.code==='providerUnavailable'?503:400);
 return json(status,{error:status===429?'Please wait before trying again.':status===503?'Redemption is not ready. Keep your code and retry with the same verified account.':status===401?'Verify the account associated with your invitation, then try again.':'This code could not be redeemed. Check it or contact support.'});
}

// Private service-binding entry only. The first-party site supplies the original
// Cloudflare connecting-IP header. Never expose this handler as a public Worker.
export async function handleRedemptionBinding(request,env){
 try{
  const url=new URL(request.url),action=paths.get(url.pathname);
  if(request.method!=='POST'||!action||url.search)throw reject(404);
  if(url.origin!=='https://sorafiles.com'||request.headers.get('origin')!=='https://sorafiles.com')throw reject(403);
  const ip=request.headers.get('CF-Connecting-IP');
  if(!ip||typeof env.RATE_HMAC_SECRET!=='string'||!/^[a-f0-9]{64}$/i.test(env.RATE_HMAC_SECRET))throw reject(503);
  const cookie=request.headers.get('cookie')||'';if(cookie.length>8192)throw reject(413);
  const raw=await readBody(request,12000);let body;try{body=JSON.parse(raw.toString('utf8'));}catch{throw reject(400);}
  const rateBucket=createHmac('sha256',Buffer.from(env.RATE_HMAC_SECRET,'hex')).update(ip).digest('hex');
  const stub=env.LICENSE_LEDGER.get(env.LICENSE_LEDGER.idFromName('license-ledger-v1'));
  const result=await stub.redemption({action,body,rateBucket,cookie:action==='session'?cookie:''});
  return json(result.status,result.body);
 }catch(error){return redemptionFailure(error);}
}

export async function executeRedemption({action,body,rateBucket,cookie},{limiter,getRuntime,identity,enabled}){
 try{
  if(!['session','redeem'].includes(action)||typeof rateBucket!=='string'||!/^[a-f0-9]{64}$/.test(rateBucket))throw reject(400);
  try{limiter.take('redemption:'+rateBucket);}catch{throw reject(429);}
  if(!enabled||!identity)throw reject(503);
  if(action==='session'){
   if(!body||Object.getPrototypeOf(body)!==Object.prototype||Object.keys(body).length)throw reject(400);
   if(typeof cookie!=='string'||cookie.length>8192)throw reject(400);
   const token=await identity.issue({cookie});
   if(typeof token!=='string'||!token||token.length>8192)throw reject(401);
   return {status:200,body:{identityToken:token}};
  }
  const {promotions}=await getRuntime();if(!promotions)throw reject(503);
  return {status:200,body:await promotions.redeem(body,{rateBucket})};
 }catch(error){const response=redemptionFailure(error);return {status:response.status,body:await response.json()};}
}
