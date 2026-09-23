// Local test-only runtime. Never referenced by Wrangler configuration.
import {WorkerEntrypoint} from 'cloudflare:workers';
import {LicenseLedgerObject,RedemptionGateway} from '../../license-service/cloudflare/worker.mjs';
import {PromotionStore,PromotionService} from '../../license-service/promotions.mjs';
export {RedemptionGateway};
export class TestLedger extends LicenseLedgerObject {
 async runtime(){
  if(this.testRuntime)return this.testRuntime;
  const store=new PromotionStore(this.store,{encryptionKey:Buffer.from(this.env.SORA_PROMOTIONS_ENCRYPTION_KEY,'hex')}),db=this.store.db;
  db.exec('CREATE TABLE IF NOT EXISTS test_provider(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
  const dodo={
   importedLicenses:async()=>db.prepare('SELECT value FROM test_provider').all().map(row=>JSON.parse(row.value)),
   importLicense:async({customerId,productId,key,maxDevices,expiresAt})=>{
    const value={id:'synthetic-license',customer_id:customerId,product_id:productId,key,activations_limit:maxDevices,expires_at:expiresAt,status:'active',source:'import'};
    db.prepare('INSERT INTO test_provider VALUES(?,?)').run(value.id,JSON.stringify(value));
    // Model a provider storing the license but losing its response.
    throw Error('Synthetic lost response');
   }
  };
  return this.testRuntime={promotions:new PromotionService({store,dodo,verifyIdentity:token=>this.env.REDEMPTION_IDENTITY.verify({token})})};
 }
 async seed(){
  const {promotions}=await this.runtime(),now=Math.floor(Date.now()/1000);
  return promotions.store.create({id:'fixture',name:'Synthetic',tier:'Personal',duration:'lifetime',productId:'synthetic-product',quantity:1,starts:now-1,ends:now+86400,enabled:true},now)[0];
 }
}
export class TestIdentity extends WorkerEntrypoint {
 issue({cookie}){return cookie==='fixture=verified'?'synthetic-subject-token':null;}
 verify({token}){return token==='synthetic-subject-token'?{subjectHash:'a'.repeat(64),customerId:'synthetic-customer'}:null;}
}
export default {async fetch(request,env){
 if(new URL(request.url).pathname!=='/seed')return new Response(null,{status:404});
 const stub=env.LICENSE_LEDGER.get(env.LICENSE_LEDGER.idFromName('license-ledger-v1'));
 return Response.json({code:await stub.seed()});
}};
