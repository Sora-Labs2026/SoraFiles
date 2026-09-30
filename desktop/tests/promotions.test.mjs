import test from 'node:test';import assert from 'node:assert/strict';
import {randomBytes,generateKeyPairSync} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {Worker} from 'node:worker_threads';
import {LicenseStore} from '../license-service/store.mjs';import {PromotionStore,PromotionService} from '../license-service/promotions.mjs';
import {entitlementClaims,signEntitlement} from '../license-service/signing.mjs';import {verifyEntitlement} from '../shared/entitlement.mjs';import {DodoClient} from '../license-service/dodo.mjs';
const time=1800000000,bucket={rateBucket:'a'.repeat(64)},identity={subjectHash:'b'.repeat(64),customerId:'cus_test'};
function fixture(){const db=new LicenseStore(':memory:'),store=new PromotionStore(db,{encryptionKey:randomBytes(32)}),keys=[];let calls=0,now=time,loseResponse=false;
 const dodo={importedLicenses:async()=>keys,importLicense:async({customerId,productId,key,maxDevices,expiresAt})=>{calls++;const value={id:'lic_'+calls,customer_id:customerId,product_id:productId,key,activations_limit:maxDevices,expires_at:expiresAt,status:'active',source:'import'};keys.push(value);if(loseResponse){loseResponse=false;throw Error('lost response');}return value;}};
 const service=new PromotionService({store,dodo,verifyIdentity:async token=>token==='verified'?identity:{...identity,subjectHash:'c'.repeat(64)},now:()=>now});
 const create=(overrides={})=>store.create({id:'campaign',name:'Test',tier:'Personal',duration:'30-days',productId:'prod_promo',quantity:2,starts:time-1,ends:time+86400,enabled:true,...overrides},time);
 return {db,store,service,keys,create,calls:()=>calls,lose:()=>{loseResponse=true;},advance:value=>{now=value;}};
}
test('giveaway generates separate high-entropy codes, encrypts actual keys and recovers a lost Dodo response without reissuing',async()=>{
 const f=fixture();try{const [code]=f.create();assert.match(code,/^SORA(?:-[A-F0-9]{8}){4}$/);f.lose();await assert.rejects(f.service.redeem({code,identityToken:'verified'},bucket),{code:'redemptionPending'});
  const result=await f.service.redeem({code,identityToken:'verified'},bucket);assert.equal(f.calls(),1);assert.equal(result.maxDevices,1);assert.equal(result.emailSent,false);assert.notEqual(result.licenseKey,code);assert.match(result.licenseKey,/^SF-LIC-/);
  assert.deepEqual(await f.service.redeem({code,identityToken:'verified'},bucket),result);
  await assert.rejects(f.service.redeem({code,identityToken:'different'},bucket),{code:'redemptionUnavailable'});
  const dump=JSON.stringify([f.db.db.prepare('SELECT * FROM promo_redemptions').all(),f.db.db.prepare('SELECT * FROM promo_codes').all(),f.db.db.prepare('SELECT * FROM promo_audit').all()]);assert.ok(!dump.includes(code));assert.ok(!dump.includes(result.licenseKey));
  assert.equal(f.store.list()[0].claimed,1);assert.equal(f.store.list()[0].ready,1);
 }finally{f.db.close();}
});
test('campaign rejects expiry, future start, disable, arbitrary client plan and invalid codes uniformly; rate limit persists',async()=>{
 const f=fixture();try{const [disabled]=f.create({enabled:false}),[future]=f.create({id:'future',starts:time+30});
  for(const code of [disabled,future,'SORA-00000000-00000000-00000000-00000000'])await assert.rejects(f.service.redeem({code,identityToken:'verified'},bucket),{code:'redemptionUnavailable'});
  f.store.setEnabled('campaign',true,time);await assert.rejects(f.service.redeem({code:disabled,identityToken:'verified',maxDevices:999},bucket),{code:'redemptionUnavailable'});
  f.advance(time+86400);await assert.rejects(f.service.redeem({code:disabled,identityToken:'verified'},bucket),{code:'redemptionUnavailable'});
  for(let i=0;i<5;i++)await assert.rejects(f.service.redeem({code:'invalid',identityToken:'verified'},bucket));
  await assert.rejects(f.service.redeem({code:disabled,identityToken:'verified'},bucket),{code:'rateLimited'});
  assert.equal(f.calls(),0);
 }finally{f.db.close();}
});
test('all eight Personal/Team duration campaigns produce signed device-limited entitlements; revocation blocks new authority',async()=>{
 const pair=generateKeyPairSync('ed25519'),privateKey=pair.privateKey.export({type:'pkcs8',format:'pem'}),publicKey=pair.publicKey.export({type:'spki',format:'pem'});
 for(const tier of ['Personal','Team'])for(const [duration,days] of [['30-days',30],['90-days',90],['1-year',365],['lifetime',null]]){
  const f=fixture();try{const [code]=f.create({tier,duration});const result=await f.service.redeem({code,identityToken:'verified'},bucket),state=await f.service.resolve({customerId:identity.customerId,licenseRef:result.licenseRef});
   assert.equal(state.periodEnd,days===null?null:time+days*86400);f.db.sync(state);f.db.bind(state.ref,identity.customerId);
   const cap=tier==='Personal'?1:5;for(let i=0;i<cap;i++)f.db.activate(state.ref,'d'+i,'i'+i,time);assert.throws(()=>f.db.activate(state.ref,'extra','x',time),/limit/);
   const claims=entitlementClaims({license:f.db.activate(state.ref,'d0','i0',time),deviceId:'d0',now:time});
   const token=signEntitlement(claims,{privateKey,kid:'test'}),verified=verifyEntitlement(token,{keys:{test:publicKey},deviceId:'d0',now:time*1000});assert.equal(verified.maxDevices,cap);assert.equal(verified.exp,days===null?null:time+days*86400);
   if(days!==null){verifyEntitlement(token,{keys:{test:publicKey},deviceId:'d0',now:(time+days*86400-1)*1000});assert.throws(()=>verifyEntitlement(token,{keys:{test:publicKey},deviceId:'d0',now:(time+days*86400)*1000}));}
   assert.throws(()=>verifyEntitlement(code,{keys:{test:publicKey},deviceId:'d0',now:time*1000}));
   const row=f.store.registered(state.ref);f.store.revoke(row.id,time+1);assert.equal((await f.service.resolve({customerId:identity.customerId,licenseRef:state.ref})).status,'revoked');
   await assert.rejects(f.service.redeem({code,identityToken:'verified'},bucket),{code:'redemptionUnavailable'});
  }finally{f.db.close();}
 }
});
test('Dodo checkout delegates discounts and giveaway import fixes device limit and expiry server-side',async()=>{
 const calls=[],dodo=new DodoClient({apiKey:'synthetic-server-key',request:async(url,options)=>{calls.push({url,body:JSON.parse(options.body),headers:options.headers});return new Response('{}');}});
 await dodo.checkout('prod','USD');assert.equal(calls[0].body.billing_currency,'USD');assert.equal(calls[0].body.feature_flags.allow_discount_code,true);assert.equal(calls[0].body.feature_flags.allow_currency_selection,false);assert.equal(calls[0].body.discount_code,undefined);
 assert.throws(()=>dodo.checkout('prod'),/currency required/);assert.throws(()=>dodo.checkout('prod','invalid'),/currency required/);assert.equal(calls.length,1);
 await dodo.importLicense({customerId:'cus',productId:'prod',key:'synthetic-license',maxDevices:5,expiresAt:null});assert.deepEqual(calls[1].body,{customer_id:'cus',product_id:'prod',key:'synthetic-license',activations_limit:5,expires_at:null});assert.ok(calls[1].url.endsWith('/license_keys'));
});
test('independent SQLite workers racing one code reserve it for exactly one verified subject',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sora-promo-')),file=join(dir,'db.sqlite'),key=randomBytes(32),db=new LicenseStore(file),store=new PromotionStore(db,{encryptionKey:key});
 const [code]=store.create({id:'race',name:'Race',tier:'Team',duration:'lifetime',productId:'prod',quantity:1,starts:time-1,ends:time+10,enabled:true},time);db.close();
 try{const results=await Promise.all(Array.from({length:12},(_,i)=>new Promise((resolve,reject)=>{const worker=new Worker(new URL('./promotion-worker.mjs',import.meta.url),{workerData:{file,key:key.toString('hex'),code,time,i}});let result;worker.once('message',value=>{result=value;});worker.once('exit',code=>code===0?resolve(result):reject(Error('Race worker failed')));worker.once('error',reject);})));assert.equal(results.filter(r=>r.won).length,1);
  const bytes=await readFile(file);assert.ok(!bytes.includes(Buffer.from(code)));
 }finally{assert.equal(join(tmpdir(),dir.split(/[/\\]/).at(-1)),dir);await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
});
