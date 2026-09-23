import {createHmac} from 'node:crypto';
import {DurableObject,WorkerEntrypoint} from 'cloudflare:workers';
import {DurableLicenseStore} from './store.mjs';
import {DurableRateLimiter} from './rate-limit.mjs';
import {handleLicenseRequest,json,failure} from './transport.mjs';
import {reconcileBatch} from './reconcile.mjs';
import {DodoClient} from '../dodo.mjs';
import {fetchVerifiedCatalog} from '../catalog.mjs';
import {DodoAuthority} from '../authority.mjs';
import {RequestGuard} from '../request-guard.mjs';
import {LicenseService} from '../service.mjs';
import {verifyDodoWebhook} from '../signing.mjs';
import {replaceDevice} from '../replacements.mjs';
import {authorizeSupportReplacement} from './support-auth.mjs';
import {PromotionStore,PromotionService} from '../promotions.mjs';
import {handleRedemptionBinding,executeRedemption} from './redemption.mjs';

const secret=(value)=>{if(typeof value!=='string'||!/^[a-f0-9]{64}$/i.test(value))throw Error('Secret configuration required');return Buffer.from(value,'hex');};
const unavailable=()=>json(503,{error:'License verification is temporarily unavailable. Please try again later.'});

// No public routes, account IDs, keys or product mappings are shipped in config.
// A stable singleton owns the launch ledger; never shard by caller-controlled ID.
export default {
 async fetch(request,env){
  try {
   if(request.headers.has('origin'))return failure({httpStatus:403});
   const ip=request.headers.get('CF-Connecting-IP');if(!ip)return failure({httpStatus:403});
   const bucket=createHmac('sha256',secret(env.RATE_HMAC_SECRET)).update(ip).digest('hex');
   const headers=new Headers(request.headers);
   for(const name of ['CF-Connecting-IP','X-Forwarded-For','X-Real-IP','Forwarded','X-Sora-Rate-Bucket'])headers.delete(name);
   headers.set('X-Sora-Rate-Bucket',bucket);
   const stub=env.LICENSE_LEDGER.get(env.LICENSE_LEDGER.idFromName('license-ledger-v1'));
   return await stub.fetch(new Request(request,{headers}));
  }catch{return unavailable();}
 }
};

// Named RPC entrypoint has no public HTTP operations. The binding holder also
// needs an explicitly configured operator signing key; Access context does not
// propagate automatically across Worker service bindings.
export class SupportOperations extends WorkerEntrypoint {
 fetch(){return new Response(null,{status:404});}
 async replace(packet){
  try{const stub=this.env.LICENSE_LEDGER.get(this.env.LICENSE_LEDGER.idFromName('license-ledger-v1'));return await stub.supportReplace(packet);}
  catch{return {ok:false,error:'Replacement did not complete. Check the private support record before retrying the same ticket.'};}
 }
}

export class RedemptionGateway extends WorkerEntrypoint {
 fetch(request){return handleRedemptionBinding(request,this.env);}
}

export class LicenseLedgerObject extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.store=new DurableLicenseStore(ctx.storage);this.limiter=new DurableRateLimiter(this.store);this.redemptionLimiter=new DurableRateLimiter(this.store,{limit:12});this.cached=null;this.loading=null;}
 async runtime(){
  if(this.cached&&this.cached.until>Date.now())return this.cached;
  if(this.loading)return this.loading;
  this.loading=(async()=>{
   const env=this.env;if(!['test_mode','live_mode'].includes(env.DODO_MODE)||!env.DODO_API_KEY||!env.DODO_WEBHOOK_SECRET)throw Error('Provider configuration required');
   const dodo=new DodoClient({apiKey:env.DODO_API_KEY,mode:env.DODO_MODE,request:async(url,options)=>{
    // Workers supports manual redirects, not redirect:error. Never forward API
    // credentials to a redirect target; fail the original request instead.
    const response=await fetch(url,{...options,redirect:'manual'});
    if(response.status>=300&&response.status<400)throw Error('Provider redirect refused');
    return response;
   }});
   const catalog=await fetchVerifiedCatalog(dodo,JSON.parse(env.DODO_CATALOG_JSON));
   const promotions=env.SORA_PROMOTIONS_ENCRYPTION_KEY?new PromotionService({store:new PromotionStore(this.store,{encryptionKey:secret(env.SORA_PROMOTIONS_ENCRYPTION_KEY)}),dodo,verifyIdentity:async token=>{
    if(!env.REDEMPTION_IDENTITY||env.REDEMPTION_ENABLED!=='true')throw Error('Recipient verification is not configured');
    return env.REDEMPTION_IDENTITY.verify({token});
   }}):null;
   const authority=new DodoAuthority({dodo,catalog,promotions});
   const guard=new RequestGuard({store:this.store,secret:secret(env.CHALLENGE_HMAC_SECRET)});
   const service=new LicenseService({store:this.store,guard,dodo,authority,signing:{privateKey:env.ENTITLEMENT_ED25519_PRIVATE_KEY,kid:env.ENTITLEMENT_KEY_ID}});
   return this.cached={service,authority,dodo,guard,promotions,until:Date.now()+300000};
  })();
  try{return await this.loading;}finally{this.loading=null;}
 }
 async acceptWebhook(_webhooks,raw,headers){
  // Invalid public input must not throw inside blockConcurrencyWhile: Cloudflare
  // resets the object on that failure, interrupting unrelated activations.
  const {id}=verifyDodoWebhook(raw,headers,this.env.DODO_WEBHOOK_SECRET);
  return this.ctx.blockConcurrencyWhile(()=>this.ctx.storage.transaction(async()=>{
   const receipt={accepted:true,duplicate:!this.store.queueWebhook(id,Math.floor(Date.now()/1000))};
   if(await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(Date.now()+30000);
   return receipt;
  }));
 }
 async fetch(request){
  try{return await handleLicenseRequest(request,{getRuntime:()=>this.runtime(),limiter:this.limiter,bucket:request.headers.get('X-Sora-Rate-Bucket'),acceptWebhook:(...args)=>this.acceptWebhook(...args)});}
  catch{return unavailable();}
 }
 async supportReplace(packet){
  try{
   this.limiter.take('support:global');
   const request=authorizeSupportReplacement(this.store,packet,this.env.SUPPORT_OPERATORS_JSON);
   const {guard,dodo,authority}=await this.runtime();
   const result=await replaceDevice({store:this.store,guard,dodo,authority,request,licenseKey:packet.licenseKey});
   return {ok:true,...result};
  }catch{return {ok:false,error:'Replacement did not complete. Check the private support record before retrying the same ticket.'};}
 }
 redemption(request){return executeRedemption(request,{limiter:this.redemptionLimiter,getRuntime:()=>this.runtime(),identity:this.env.REDEMPTION_IDENTITY,enabled:this.env.REDEMPTION_ENABLED==='true'&&!!this.env.SORA_PROMOTIONS_ENCRYPTION_KEY});}
 async alarm(){
  // Schedule before external I/O so exhaustion/crash cannot lose retry work.
  await this.ctx.storage.setAlarm(Date.now()+30000);
  try {const {authority}=await this.runtime();await reconcileBatch(this.store,authority);await this.ctx.blockConcurrencyWhile(async()=>{if(this.store.pendingWebhookBoundary()===null)await this.ctx.storage.deleteAlarm();});}
  catch { /* Receipt/cursor remain durable. No payloads or keys are logged. */ }
 }
}
