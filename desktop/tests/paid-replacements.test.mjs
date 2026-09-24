import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {LicenseStore} from '../license-service/store.mjs';
import {RequestGuard} from '../license-service/request-guard.mjs';
import {LicenseService} from '../license-service/service.mjs';
import {PaidReplacementService,verifyReplacementProduct,queueReplacementEvent} from '../license-service/paid-replacements.mjs';
import {replacementPrices} from '../shared/replacement-prices.mjs';
import {deviceIdentity,verifyEntitlement} from '../shared/entitlement.mjs';
import {verifyValidationProof} from '../shared/validation-proof.mjs';

const pair=()=>{const p=generateKeyPairSync('ed25519');return {privateKey:p.privateKey.export({format:'pem',type:'pkcs8'}),publicKey:p.publicKey.export({format:'pem',type:'spki'})};};
function setup(plan='personal-annual'){
 let now=1800000000,serial=0,checkoutCalls=0,deactivateCalls=0;
 const store=new LicenseStore(':memory:'),guard=new RequestGuard({store,secret:randomBytes(32),now:()=>now}),signer=pair();
 const state={ref:'lic',plan,status:'active',periodEnd:now+365*86400,observedAt:now};
 const products=Object.fromEntries(Object.keys(replacementPrices).map(p=>[p,'product_'+p]));
 const product=p=>({product_id:products[p],name:'SoraFiles device replacement',is_recurring:false,price:{type:'one_time_price',currency:'USD',price:replacementPrices[p].amount,tax_inclusive:true},entitlements:[]});
 let payment=null;
 const dodo={activate:async()=>({id:'instance_'+ ++serial,license_key_id:'lic',customer:{customer_id:'customer'}}),validate:async()=>({valid:true}),deactivate:async()=>{deactivateCalls++;},product:async()=>product(plan),replacementCheckout:async({orderId,productId,customerId})=>{checkoutCalls++;payment={payment_id:'payment_'+checkoutCalls,metadata:{sorafiles_replacement:orderId},checkout_session_id:'checkout_'+checkoutCalls,customer:{customer_id:customerId},currency:'USD',total_amount:replacementPrices[plan].amount,product_cart:[{product_id:productId,quantity:1}],refunds:[],disputes:[],status:'processing'};return {session_id:payment.checkout_session_id,checkout_url:'https://test.checkout.dodopayments.com/session'};},checkoutStatus:async id=>({session_id:id,payment_id:payment.payment_id}),payment:async()=>payment};
 const authority={resolve:async()=>({...state,observedAt:now})};
 const replacements=new PaidReplacementService({store,guard,dodo,authority,products,now:()=>now,verifyIdentity:async token=>({customerId:token==='owner'?'customer':'someone_else',verified:token==='owner'})});
 const service=new LicenseService({store,guard,dodo,authority,replacements,signing:{privateKey:signer.privateKey,kid:'test'},now:()=>now});
 const execute=async(action,body,device)=>{const {challenge:c,token}=service.challenge({action,body,publicKey:device.publicKey});const signature=sign(null,Buffer.from(`sorafiles-device-v1\n${c.id}\n${c.context}\n${c.expires}`),device.privateKey).toString('base64url');return service.execute(action,{body,publicKey:device.publicKey,signature,token});};
 return {store,guard,dodo,state,product,replacements,execute,advance:n=>now+=n,checkoutCalls:()=>checkoutCalls,deactivateCalls:()=>deactivateCalls,payment:()=>payment,verify:(response,device,body)=>verifyValidationProof(response.validation,{keys:{test:signer.publicKey},deviceId:deviceIdentity(device.publicKey),...body,now:now*1000}),verifyGrant:(token,device)=>verifyEntitlement(token,{keys:{test:signer.publicKey},deviceId:deviceIdentity(device.publicKey),now:now*1000})};
}

test('all six replacement products require exact fixed amounts, no promotions or license grant',()=>{
 const expected=[99,999,4999,399,3999,19999];assert.deepEqual(Object.values(replacementPrices).map(p=>p.amount),expected);
 for(const plan of Object.keys(replacementPrices)){const s=setup(plan);try{const product=s.product(plan);assert.equal(verifyReplacementProduct(plan,product,product.product_id).amount,replacementPrices[plan].amount);for(const change of [{price:{...product.price,price:1}},{price:{...product.price,currency:'EUR'}},{price:{...product.price,discount:10}},{is_recurring:true},{entitlements:[{id:'license'}]}])assert.throws(()=>verifyReplacementProduct(plan,{...product,...change},product.product_id));}finally{s.store.close();}}
});

test('occupied seat moves only after verified exact payment; retries preserve checkout and reserved seat',async()=>{
 const s=setup(),old=pair(),next=pair(),intruder=pair();try{
  await s.execute('activate',{licenseKey:'secret-key'},old);
  const body={licenseRef:'lic',oldDeviceId:deviceIdentity(old.publicKey),licenseKey:'secret-key',identityToken:'owner'};
  await assert.rejects(s.execute('replacementRequest',{...body,identityToken:'key-only'},next),/ownership/);assert.equal(s.checkoutCalls(),0);
  const order=await s.execute('replacementRequest',body,next);assert.equal(order.fee.amount,999);assert.equal(order.status,'payment-pending');
  assert.equal((await s.execute('replacementRequest',body,next)).orderId,order.orderId);assert.equal(s.checkoutCalls(),1);
  await assert.rejects(s.execute('replacementRequest',body,intruder),/pending/);
  const status={orderId:order.orderId,licenseKey:'secret-key',identityToken:'owner'};
  await assert.rejects(s.execute('replacementStatus',status,intruder),/unavailable/);
  assert.equal((await s.execute('replacementStatus',status,next)).status,'payment-pending');assert.ok(s.store.active('lic',body.oldDeviceId));
  s.payment().status='succeeded';s.payment().total_amount=998;
  await assert.rejects(s.execute('replacementStatus',status,next),/mismatch/);assert.ok(s.store.active('lic',body.oldDeviceId));
  s.payment().total_amount=999;assert.equal((await s.execute('replacementStatus',status,next)).replacementAuthorized,true);
  assert.equal(s.deactivateCalls(),1);assert.equal((await s.execute('replacementStatus',status,next)).status,'complete');assert.equal(s.deactivateCalls(),1);
  await assert.rejects(s.execute('activate',{licenseKey:'secret-key'},old),/replaced/);
  await assert.rejects(s.execute('activate',{licenseKey:'secret-key'},intruder),/limit/);
  const activated=await s.execute('activate',{licenseKey:'secret-key'},next);assert.equal(s.verifyGrant(activated.entitlement,next).plan,'personal-annual');
  assert.equal(s.store.db.prepare('SELECT COUNT(*) n FROM permanent_devices').get().n,1);
  assert.ok(s.store.db.prepare('SELECT activated FROM paid_replacements').get().activated);
  assert.equal(JSON.stringify(s.store.db.prepare('SELECT * FROM paid_replacements').all()).includes('secret-key'),false);
 }finally{s.store.close();}
});

test('paid release outage keeps seat reserved; retry recovers invalid old provider instance',async()=>{
 const s=setup(),old=pair(),next=pair();try{
  await s.execute('activate',{licenseKey:'key'},old);const order=await s.execute('replacementRequest',{licenseRef:'lic',oldDeviceId:deviceIdentity(old.publicKey),licenseKey:'key',identityToken:'owner'},next);
  s.payment().status='succeeded';s.dodo.deactivate=async()=>{throw Object.assign(Error('outage'),{code:'providerUnavailable'});};
  const status={orderId:order.orderId,licenseKey:'key',identityToken:'owner'};await assert.rejects(s.execute('replacementStatus',status,next),/outage/);
  assert.equal(s.store.db.prepare('SELECT status FROM paid_replacements').get().status,'paid');assert.equal(s.store.db.prepare('SELECT COUNT(*) n FROM permanent_devices').get().n,1);
  s.dodo.validate=async()=>({valid:false});assert.equal((await s.execute('replacementStatus',status,next)).status,'complete');
 }finally{s.store.close();}
});

test('unused Team seats activate without a checkout or replacement fee',async()=>{
 const s=setup('team-lifetime');try{for(let n=0;n<5;n++)await s.execute('activate',{licenseKey:'key'},pair());assert.equal(s.checkoutCalls(),0);assert.equal(s.store.db.prepare('SELECT COUNT(*) n FROM paid_replacements').get().n,0);}finally{s.store.close();}
});

test('signed online validation binds request and preserves paid period; outages do not sign revocation',async()=>{
 const s=setup(),device=pair();try{
  const activation=await s.execute('activate',{licenseKey:'key'},device),body={licenseKey:'key',licenseRef:'lic',instanceId:activation.instanceId,nonce:randomBytes(32).toString('base64url')};
  const response=await s.execute('validate',body,device),claim=s.verify(response,device,body);assert.equal(claim.status,'active');assert.equal(s.verifyGrant(claim.entitlement,device).exp,s.state.periodEnd);
  assert.throws(()=>s.verify(response,device,{...body,nonce:randomBytes(32).toString('base64url')}),/claims/);
  s.dodo.validate=async()=>{throw Object.assign(Error('network'),{code:'providerUnavailable'});};await assert.rejects(s.execute('validate',body,device),/network/);
  s.dodo.validate=async()=>({valid:true});s.advance(1);s.state.status='revoked';const revoked=s.verify(await s.execute('validate',body,device),device,body);assert.equal(revoked.status,'inactive');assert.equal(revoked.reason,'license-inactive');
 }finally{s.store.close();}
});

test('replacement receipt blocks old device with signed reason even when provider is offline',async()=>{
 const s=setup('personal-lifetime'),old=pair(),next=pair();try{
  const activation=await s.execute('activate',{licenseKey:'key'},old);await s.execute('replacementRequest',{licenseRef:'lic',oldDeviceId:deviceIdentity(old.publicKey),licenseKey:'key',identityToken:'owner'},next);
  s.payment().status='succeeded';queueReplacementEvent(s.store,'event1',{type:'payment.succeeded',data:{payment_id:s.payment().payment_id}},1800000000);await s.replacements.reconcile();
  assert.equal(s.store.db.prepare('SELECT COUNT(*) n FROM replacement_payment_events WHERE completed IS NOT NULL').get().n,1);
  s.dodo.validate=async()=>{throw Error('offline');};const body={licenseKey:'key',licenseRef:'lic',instanceId:activation.instanceId,nonce:randomBytes(32).toString('base64url')};
  const claim=s.verify(await s.execute('validate',body,old),old,body);assert.equal(claim.status,'inactive');assert.equal(claim.reason,'device-replaced');
 }finally{s.store.close();}
});

test('overlapping checkout requests commit one durable intent before contacting the provider',async()=>{
 const s=setup(),old=pair(),next=pair();let release,entered;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 try{
  await s.execute('activate',{licenseKey:'key'},old);
  const checkout=s.dodo.replacementCheckout;s.dodo.replacementCheckout=async args=>{entered();await gate;return checkout(args);};
  const body={licenseRef:'lic',oldDeviceId:deviceIdentity(old.publicKey),licenseKey:'key',identityToken:'owner'};
  const first=s.execute('replacementRequest',body,next);await ready;
  await assert.rejects(s.execute('replacementRequest',body,next),/reconciliation/);
  assert.equal(s.store.db.prepare('SELECT COUNT(*) n FROM paid_replacements').get().n,1);
  assert.ok(s.store.active('lic',body.oldDeviceId));release();await first;assert.equal(s.checkoutCalls(),1);
 }finally{release?.();s.store.close();}
});

test('an ambiguous checkout failure is never retried automatically or allowed to release the old seat',async()=>{
 const s=setup(),old=pair(),next=pair();try{
  await s.execute('activate',{licenseKey:'key'},old);let calls=0;
  s.dodo.replacementCheckout=async()=>{calls++;throw Error('timeout after provider creation');};
  const body={licenseRef:'lic',oldDeviceId:deviceIdentity(old.publicKey),licenseKey:'key',identityToken:'owner'};
  await assert.rejects(s.execute('replacementRequest',body,next),/timeout/);
  await assert.rejects(s.execute('replacementRequest',body,next),/reconciliation/);
  assert.equal(calls,1);assert.ok(s.store.active('lic',body.oldDeviceId));
  assert.equal(s.store.db.prepare('SELECT status FROM paid_replacements').get().status,'creating');
 }finally{s.store.close();}
});

test('payment ownership, session, quantity, discounts, refunds and disputes cannot authorize a replacement',async()=>{
 const s=setup(),old=pair(),next=pair();try{
  await s.execute('activate',{licenseKey:'key'},old);const body={licenseRef:'lic',oldDeviceId:deviceIdentity(old.publicKey),licenseKey:'key',identityToken:'owner'};
  await s.execute('replacementRequest',body,next);const valid={...s.payment(),status:'succeeded'};
  for(const patch of [{customer:{customer_id:'other'}},{checkout_session_id:'other'},{currency:'EUR'},{discount_id:'promo'}, {refunds:[{id:'refund'}]},{disputes:[{id:'dispute'}]},{product_cart:[{...valid.product_cart[0],quantity:2}]},{subscription_id:'subscription'}]){
   assert.throws(()=>s.replacements.applyPayment({...valid,...patch}),/mismatch/);assert.ok(s.store.active('lic',body.oldDeviceId));
  }
  assert.equal(s.replacements.applyPayment(valid),true);assert.equal(s.replacements.applyPayment(valid),true);
  assert.equal(s.store.db.prepare('SELECT COUNT(*) n FROM paid_replacements WHERE status=\'paid\'').get().n,1);
 }finally{s.store.close();}
});

test('an online validation already waiting on Dodo cannot renew the old device after payment transfers its seat',async()=>{
 const s=setup(),old=pair(),next=pair();let release,entered;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 try{
  const activation=await s.execute('activate',{licenseKey:'key'},old);
  await s.execute('replacementRequest',{licenseRef:'lic',oldDeviceId:deviceIdentity(old.publicKey),licenseKey:'key',identityToken:'owner'},next);
  s.dodo.validate=async()=>{entered();await gate;return {valid:true};};
  const body={licenseKey:'key',licenseRef:'lic',instanceId:activation.instanceId,nonce:randomBytes(32).toString('base64url')};
  const validating=s.execute('validate',body,old);await ready;s.payment().status='succeeded';s.replacements.applyPayment(s.payment());release();
  const claim=s.verify(await validating,old,body);assert.equal(claim.reason,'device-replaced');assert.equal(claim.status,'inactive');assert.equal(claim.entitlement,undefined);
 }finally{release?.();s.store.close();}
});
