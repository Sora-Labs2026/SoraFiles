import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {LicenseStore} from '../license-service/store.mjs';
import {LicenseLedger} from '../license-service/ledger.mjs';
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
 let payment=null,providerKey;
 const dodo={activate:async()=>({id:'instance_'+ ++serial,license_key_id:'lic',customer:{customer_id:'customer'}}),validate:async()=>({valid:true}),deactivate:async()=>{deactivateCalls++;},product:async()=>product(plan),replacementCheckout:async({orderId,productId,customerId})=>{checkoutCalls++;payment={payment_id:'payment_'+checkoutCalls,metadata:{sorafiles_replacement:orderId},checkout_session_id:'checkout_'+checkoutCalls,customer:{customer_id:customerId},currency:'USD',total_amount:replacementPrices[plan].amount,product_cart:[{product_id:productId,quantity:1}],refunds:[],disputes:[],status:'processing'};return {session_id:payment.checkout_session_id,checkout_url:'https://test.checkout.dodopayments.com/session'};},checkoutStatus:async id=>({session_id:id,payment_id:payment.payment_id}),payment:async()=>payment};
 const activate=dodo.activate;dodo.activate=async key=>{providerKey=key;return activate();};
 dodo.customerGrants=async()=>[{customer_id:'customer',integration_type:'license_key',license_key:{id:'lic',key:providerKey}}];
 dodo.licenseKey=async()=>({id:'lic',customer_id:'customer',key:providerKey});
 const authority={resolve:async()=>({...state,observedAt:now})};
 const replacements=new PaidReplacementService({store,guard,dodo,authority,products,now:()=>now,verifyIdentity:async token=>({customerId:token==='owner'?'customer':'someone_else',verified:token==='owner'})});
 const service=new LicenseService({store,guard,dodo,authority,replacements,signing:{privateKey:signer.privateKey,kid:'test'},now:()=>now});
 const execute=async(action,body,device)=>{const {challenge:c,token}=service.challenge({action,body,publicKey:device.publicKey});const signature=sign(null,Buffer.from(`sorafiles-device-v1\n${c.id}\n${c.context}\n${c.expires}`),device.privateKey).toString('base64url');return service.execute(action,{body,publicKey:device.publicKey,signature,token});};
 return {store,guard,dodo,state,product,replacements,execute,advance:n=>now+=n,checkoutCalls:()=>checkoutCalls,deactivateCalls:()=>deactivateCalls,payment:()=>payment,verify:(response,device,body)=>verifyValidationProof(response.validation,{keys:{test:signer.publicKey},deviceId:deviceIdentity(device.publicKey),...body,now:now*1000}),verifyGrant:(token,device)=>verifyEntitlement(token,{keys:{test:signer.publicKey},deviceId:deviceIdentity(device.publicKey),now:now*1000})};
}

test('all six replacement products require exact fixed amounts, no promotions or license grant',()=>{
 const expected=[99,99,1999,399,399,7999];assert.deepEqual(Object.values(replacementPrices).map(p=>p.amount),expected);
 for(const plan of Object.keys(replacementPrices)){const s=setup(plan);try{const product=s.product(plan);assert.equal(verifyReplacementProduct(plan,product,product.product_id).amount,replacementPrices[plan].amount);for(const change of [{price:{...product.price,price:1}},{price:{...product.price,currency:'EUR'}},{price:{...product.price,discount:10}},{is_recurring:true},{entitlements:[{id:'license'}]}])assert.throws(()=>verifyReplacementProduct(plan,{...product,...change},product.product_id));}finally{s.store.close();}}
});

test('verified exact payment releases occupied seat for a new device without reserving the requester',async()=>{
 const s=setup(),old=pair(),next=pair(),intruder=pair();try{
  await s.execute('activate',{licenseKey:'secret-key'},old);
  const body={licenseRef:'lic',oldDeviceId:deviceIdentity(old.publicKey),licenseKey:'secret-key',identityToken:'owner'};
  await assert.rejects(s.execute('replacementRequest',{...body,identityToken:'key-only'},next),/ownership/);assert.equal(s.checkoutCalls(),0);
  const order=await s.execute('replacementRequest',body,next);assert.equal(order.fee.amount,99);assert.equal(order.status,'payment-pending');
  assert.equal((await s.execute('replacementRequest',body,next)).orderId,order.orderId);assert.equal(s.checkoutCalls(),1);
  await assert.rejects(s.execute('replacementRequest',body,intruder),/pending/);
  const status={orderId:order.orderId,licenseKey:'secret-key',identityToken:'owner'};
  await assert.rejects(s.execute('replacementStatus',status,intruder),/unavailable/);
  assert.equal((await s.execute('replacementStatus',status,next)).status,'payment-pending');assert.ok(s.store.active('lic',body.oldDeviceId));
  s.payment().status='succeeded';s.payment().total_amount=998;
  await assert.rejects(s.execute('replacementStatus',status,next),/mismatch/);assert.ok(s.store.active('lic',body.oldDeviceId));
  s.payment().total_amount=99;assert.equal((await s.execute('replacementStatus',status,next)).replacementAuthorized,true);
  assert.equal(s.deactivateCalls(),1);assert.equal((await s.execute('replacementStatus',status,next)).status,'complete');assert.equal(s.deactivateCalls(),1);
  const activated=await s.execute('activate',{licenseKey:'secret-key'},intruder);assert.equal(s.verifyGrant(activated.entitlement,intruder).plan,'personal-annual');
  await assert.rejects(s.execute('activate',{licenseKey:'secret-key'},next),/limit/);
  assert.equal(s.store.db.prepare('SELECT COUNT(*) n FROM permanent_devices').get().n,1);
  assert.equal(s.store.db.prepare('SELECT new_device FROM paid_replacements').get().new_device,null);
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

test('current device starts replacement; background payment releases it after token expiry and one new device wins the seat',async()=>{
 const s=setup('personal-lifetime'),old=pair();try{
  await s.execute('activate',{licenseKey:'key'},old);
  const body={licenseRef:'lic',oldDeviceId:deviceIdentity(old.publicKey),licenseKey:'key',identityToken:'owner'};
  const order=await s.execute('replacementRequest',body,old);
  assert.ok(s.store.active('lic',body.oldDeviceId));assert.equal(s.deactivateCalls(),0);
  s.advance(3600);s.replacements.verifyIdentity=async()=>{throw Error('Expired token');};
  s.payment().status='succeeded';queueReplacementEvent(s.store,'paid-background',{type:'payment.succeeded',data:{payment_id:s.payment().payment_id}},1800003600);
  await s.replacements.reconcile();assert.equal(s.deactivateCalls(),1);
  assert.equal(s.store.db.prepare('SELECT COUNT(*) n FROM permanent_devices').get().n,0);
  assert.equal((await s.execute('replacementStatus',{orderId:order.orderId,licenseKey:'key',identityToken:'expired'},old)).status,'complete');
  const competing=await Promise.allSettled([s.execute('activate',{licenseKey:'key'},old),s.execute('activate',{licenseKey:'key'},pair())]);
  assert.equal(competing.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(s.store.db.prepare('SELECT COUNT(*) n FROM permanent_devices').get().n,1);
 }finally{s.store.close();}
});

test('unattended release retries paid records after acknowledged event and checks retrieved provider identity',async()=>{
 for(const fault of ['outage','customer','id','key']){
  const s=setup(),old=pair();try{
   await s.execute('activate',{licenseKey:'key'},old);
   await s.execute('replacementRequest',{licenseRef:'lic',oldDeviceId:deviceIdentity(old.publicKey),licenseKey:'key',identityToken:'owner'},old);
   s.payment().status='succeeded';queueReplacementEvent(s.store,'event',{type:'payment.succeeded',data:{payment_id:s.payment().payment_id}},1800000000);
   s.dodo.customerGrants=async()=>[];
   s.dodo.licenseKey=async()=>fault==='outage'?Promise.reject(Error('offline')):{id:fault==='id'?'other':'lic',customer_id:fault==='customer'?'other':'customer',key:fault==='key'?'other':'key'};
   await assert.rejects(s.replacements.reconcile(),/unavailable/);
   assert.equal(s.store.db.prepare('SELECT COUNT(*) n FROM replacement_payment_events WHERE completed IS NULL').get().n,0);
   assert.equal(s.store.db.prepare('SELECT status FROM paid_replacements').get().status,'paid');
   assert.equal(s.store.db.prepare('SELECT COUNT(*) n FROM permanent_devices').get().n,1);assert.equal(s.deactivateCalls(),0);
   s.dodo.licenseKey=async()=>({id:'lic',customer_id:'customer',key:'key'});
   await s.replacements.reconcile();assert.equal(s.store.db.prepare('SELECT status FROM paid_replacements').get().status,'complete');assert.equal(s.deactivateCalls(),1);
  }finally{s.store.close();}
 }
});

test('migration preserves legacy destination reservation and does not reinterpret existing transfers',async()=>{
 const s=setup(),old=pair(),reserved=pair(),other=pair();try{
  await s.execute('activate',{licenseKey:'key'},old);
  await s.execute('replacementRequest',{licenseRef:'lic',oldDeviceId:deviceIdentity(old.publicKey),licenseKey:'key',identityToken:'owner'},reserved);
  const db=s.store.db;
  // Reconstruct the pre-release-mode table with a real existing checkout.
  db.prepare('UPDATE paid_replacements SET new_device=?').run(deviceIdentity(reserved.publicKey));
  db.exec('ALTER TABLE paid_replacements DROP COLUMN requester_device; ALTER TABLE paid_replacements DROP COLUMN mode;');
  const migrated=new LicenseLedger(db),row=db.prepare('SELECT * FROM paid_replacements').get();
  assert.equal(row.mode,'transfer');assert.equal(row.requester_device,deviceIdentity(reserved.publicKey));
  s.payment().status='succeeded';s.replacements.applyPayment(s.payment());await s.replacements.finishRelease(s.replacements.row(row.id),'key');
  await assert.rejects(s.execute('activate',{licenseKey:'key'},old),/replaced/);
  assert.throws(()=>migrated.activate('lic',deviceIdentity(other.publicKey),'unreserved',1800000000),/limit/);
  const result=await s.execute('activate',{licenseKey:'key'},reserved);assert.equal(result.licenseRef,'lic');
 }finally{s.store.close();}
});

test('completed revocation permits fresh same-device binding repeatedly but never restores revoked instances or trial',async()=>{
 const s=setup('personal-lifetime'),device=pair(),deviceId=deviceIdentity(device.publicKey);try{
  await s.execute('trial',{},device);
  let activation=await s.execute('activate',{licenseKey:'key'},device);
  const revoked=[];
  for(let cycle=0;cycle<2;cycle++){
   const body={licenseRef:'lic',oldDeviceId:deviceId,licenseKey:'key',identityToken:'owner'};
   const order=await s.execute('replacementRequest',body,device);
   assert.equal(s.checkoutCalls(),cycle+1);
   assert.equal((await s.execute('replacementRequest',body,device)).orderId,order.orderId);
   s.payment().status='succeeded';s.replacements.applyPayment(s.payment());
   await assert.rejects(s.execute('activate',{licenseKey:'key'},device),/replaced/);
   await assert.rejects(s.execute('trial',{},device),/revoked/);
   await s.replacements.finishRelease(s.replacements.row(order.orderId),'key');
   assert.equal((await s.execute('replacementStatus',{orderId:order.orderId,licenseKey:'key',identityToken:'owner'},device)).revokedInstanceId,activation.instanceId);
   revoked.push(activation.instanceId);
   const staleActivate=s.dodo.activate;s.dodo.activate=async()=>({id:activation.instanceId,license_key_id:'lic',customer:{customer_id:'customer'}});
   await assert.rejects(s.execute('activate',{licenseKey:'key'},device),/replaced/);
   s.dodo.activate=staleActivate;
   activation=await s.execute('activate',{licenseKey:'key'},device);
   assert.equal((await s.execute('replacementStatus',{orderId:order.orderId,licenseKey:'key',identityToken:'owner'},device)).revokedInstanceId,revoked.at(-1));
   assert.ok(!revoked.includes(activation.instanceId));assert.equal(s.verifyGrant(activation.entitlement,device).plan,'personal-lifetime');
   await assert.rejects(s.execute('trial',{},device),/revoked/);
   for(const instanceId of revoked){
    const validate={licenseKey:'key',licenseRef:'lic',instanceId,nonce:randomBytes(32).toString('base64url')};
    assert.equal(s.verify(await s.execute('validate',validate,device),device,validate).reason,'device-replaced');
    await assert.rejects(s.execute('refresh',{licenseKey:'key',licenseRef:'lic',instanceId},device),/instance/);
   }
  }
  assert.equal(s.store.db.prepare('SELECT COUNT(*) n FROM paid_replacements').get().n,2);
  assert.equal(s.store.db.prepare('SELECT COUNT(*) n FROM permanent_devices').get().n,1);
 }finally{s.store.close();}
});

test('revoked device without prior trial cannot obtain one but can activate a different valid license',async()=>{
 const s=setup('personal-lifetime'),device=pair();try{
  await s.execute('activate',{licenseKey:'key'},device);
  const order=await s.execute('replacementRequest',{licenseRef:'lic',oldDeviceId:deviceIdentity(device.publicKey),licenseKey:'key',identityToken:'owner'},device);
  s.payment().status='succeeded';s.replacements.applyPayment(s.payment());await s.replacements.finishRelease(s.replacements.row(order.orderId),'key');
  await assert.rejects(s.execute('trial',{},device),/revoked/);
  s.state.ref='new-license';s.dodo.activate=async()=>({id:'new-key-instance',license_key_id:'new-license',customer:{customer_id:'customer'}});
  const activated=await s.execute('activate',{licenseKey:'new-key'},device);
  assert.equal(activated.licenseRef,'new-license');assert.equal(s.verifyGrant(activated.entitlement,device).plan,'personal-lifetime');
 }finally{s.store.close();}
});

test('cancel: in-progress payment blocks it, unpaid order cancels, late payment is flagged for refund, paid order wins',async()=>{
 const s=setup(),old=pair(),next=pair(),intruder=pair();try{
  await s.execute('activate',{licenseKey:'key'},old);
  const body={licenseRef:'lic',oldDeviceId:deviceIdentity(old.publicKey),licenseKey:'key',identityToken:'owner'};
  const order=await s.execute('replacementRequest',body,next),cancel={orderId:order.orderId,licenseKey:'key',identityToken:'owner'};
  await assert.rejects(s.execute('replacementCancel',cancel,intruder),/unavailable/);
  await assert.rejects(s.execute('replacementCancel',cancel,next),error=>error.reason==='payment-in-progress'&&error.httpStatus===409);
  assert.equal(s.replacements.row(order.orderId).status,'pending');
  // No payment attempt yet: the order is cancelled and the seat is untouched.
  const status=s.dodo.checkoutStatus;s.dodo.checkoutStatus=async id=>({session_id:id});
  assert.equal((await s.execute('replacementCancel',cancel,next)).status,'cancelled');
  assert.equal((await s.execute('replacementCancel',cancel,next)).status,'cancelled');
  assert.ok(s.store.active('lic',body.oldDeviceId));assert.equal(s.deactivateCalls(),0);
  // A stale payment page completed afterwards never revokes; it is recorded for refund once.
  const stale={...s.payment(),status:'succeeded'};
  assert.equal(s.replacements.applyPayment(stale),false);assert.equal(s.replacements.applyPayment(stale),false);
  const row=s.replacements.row(order.orderId);assert.equal(row.status,'refund-required');assert.equal(row.payment_id,stale.payment_id);
  assert.ok(s.store.active('lic',body.oldDeviceId));
  // A cancelled order does not block choosing again: a fresh order and checkout.
  s.dodo.checkoutStatus=status;
  const second=await s.execute('replacementRequest',body,next);assert.notEqual(second.orderId,order.orderId);assert.equal(s.checkoutCalls(),2);
  // Payment already succeeded: cancel completes the revocation instead.
  s.payment().status='succeeded';
  const result=await s.execute('replacementCancel',{...cancel,orderId:second.orderId},next);
  assert.equal(result.status,'complete');assert.equal(result.replacementAuthorized,true);assert.equal(s.store.active('lic',body.oldDeviceId),undefined);
 }finally{s.store.close();}
});

test('cancel: a failed payment can be cancelled',async()=>{
 const s=setup(),old=pair(),next=pair();try{
  await s.execute('activate',{licenseKey:'key'},old);
  const order=await s.execute('replacementRequest',{licenseRef:'lic',oldDeviceId:deviceIdentity(old.publicKey),licenseKey:'key',identityToken:'owner'},next);
  s.payment().status='failed';
  assert.equal((await s.execute('replacementCancel',{orderId:order.orderId,licenseKey:'key',identityToken:'owner'},next)).status,'cancelled');
 }finally{s.store.close();}
});
