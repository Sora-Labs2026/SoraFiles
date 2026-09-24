import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {LicenseStore} from '../license-service/store.mjs';
import {RequestGuard} from '../license-service/request-guard.mjs';
import {ReplacementEmailService} from '../license-service/replacement-email.mjs';
import {PaidReplacementService} from '../license-service/paid-replacements.mjs';
import {LicenseService} from '../license-service/service.mjs';
import {createLicenseHttpServer} from '../license-service/http.mjs';
import {LicenseClient} from '../core/license-client.mjs';
import {deviceIdentity} from '../shared/entitlement.mjs';
import {replacementPrices} from '../shared/replacement-prices.mjs';

const pair=()=>{const keys=generateKeyPairSync('ed25519');return {publicKey:keys.publicKey.export({format:'pem',type:'spki'}),privateKey:keys.privateKey.export({format:'pem',type:'pkcs8'})};};
async function fixture(){
 let now=1800000000,checkoutCalls=0,providerReads=0,deactivateCalls=0,serial=0,payment=null;
 const store=new LicenseStore(':memory:'),guard=new RequestGuard({store,secret:randomBytes(32),now:()=>now}),signer=pair(),old=pair(),next=pair();
 const plan='personal-lifetime',key='synthetic-key',mail=[],state={ref:'license',plan,status:'active',periodEnd:null};
 const products=Object.fromEntries(Object.keys(replacementPrices).map(plan=>[plan,'product_'+plan]));
 const dodo={
  activate:async()=>({id:'instance_'+ ++serial,license_key_id:'license',customer:{customer_id:'customer'}}),
  validate:async()=>({valid:true}),deactivate:async(_key,instanceId)=>{if(instanceId==='instance_1')deactivateCalls++;},
  customer:async id=>({customer_id:id,email:'purchaser@example.com'}),
  product:async id=>({product_id:id,name:'SoraFiles device replacement',is_recurring:false,price:{type:'one_time_price',currency:'USD',price:replacementPrices[plan].amount,tax_inclusive:true},entitlements:[]}),
  replacementCheckout:async({orderId,productId,customerId})=>{
   checkoutCalls++;payment={payment_id:'payment',metadata:{sorafiles_replacement:orderId},checkout_session_id:'checkout',customer:{customer_id:customerId},currency:'USD',total_amount:replacementPrices[plan].amount,product_cart:[{product_id:productId,quantity:1}],refunds:[],disputes:[],status:'processing'};
   return {session_id:'checkout',checkout_url:'https://test.checkout.dodopayments.com/session'};
  },
  checkoutStatus:async id=>{providerReads++;return {session_id:id,payment_id:'payment'};},payment:async()=>payment,
 };
 const authority={resolve:async()=>({...state,observedAt:now})};
 const email=new ReplacementEmailService({store,guard,dodo,authority,now:()=>now,sendCode:async packet=>mail.push(packet)});
 const replacements=new PaidReplacementService({store,guard,dodo,authority,products,now:()=>now,verifyIdentity:(token,context)=>email.identity(token,context)});
 const service=new LicenseService({store,guard,dodo,authority,replacements,replacementEmail:email,now:()=>now,signing:{privateKey:signer.privateKey,kid:'test'}});
 const server=createLicenseHttpServer({service,webhooks:{},rateSecret:randomBytes(32)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const makeClient=device=>{let license=null,replacement=null;return {device,license:()=>license,replacement:()=>replacement,client:new LicenseClient({origin:`http://127.0.0.1:${server.address().port}`,allowLocalTesting:true,keys:{test:signer.publicKey},now:()=>now*1000,readDevice:async()=>device,readLicense:async()=>license,saveLicense:async value=>license=value,readReplacement:async()=>replacement,saveReplacement:async value=>replacement=value})};};
 const original=makeClient(old),replacement=makeClient(next);await original.client.activate(key);
 return {key,store,email,replacements,original,replacement,oldId:deviceIdentity(old.publicKey),mail,payment:()=>payment,checkoutCalls:()=>checkoutCalls,providerReads:()=>providerReads,deactivateCalls:()=>deactivateCalls,advance:seconds=>now+=seconds,async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));store.close();}};
}

test('real HTTP email ownership is required before checkout and paid webhook cannot bypass fresh ownership proof',async()=>{
 const f=await fixture();try{
  const {client,device}=f.replacement,request={licenseRef:'license',oldDeviceId:f.oldId,licenseKey:f.key,identityToken:randomBytes(32).toString('base64url')};
  await assert.rejects(client.request('replacementRequest',request,device));assert.equal(f.checkoutCalls(),0);
  const start=await client.replacementEmailStart(f.key);assert.equal(start.replacement.maskedEmail,'p***@example.com');assert.equal(f.mail[0].to,'purchaser@example.com');
  await assert.rejects(client.request('replacementRequest',{...request,identityToken:f.replacement.replacement().verificationId},device));assert.equal(f.checkoutCalls(),0);
  await client.replacementEmailVerify(f.mail.at(-1).code);await client.replacementRequest(f.oldId);assert.equal(f.checkoutCalls(),1);
  const flow=structuredClone(f.replacement.replacement());f.payment().status='succeeded';assert.equal(f.replacements.applyPayment(f.payment()),true);
  assert.equal(f.store.db.prepare('SELECT status FROM paid_replacements').get().status,'paid');assert.equal(f.replacement.license(),null);
  const status={orderId:flow.orderId,licenseKey:f.key,identityToken:request.identityToken};
  await assert.rejects(client.request('replacementStatus',status,device));assert.equal(f.providerReads(),0);assert.equal(f.deactivateCalls(),0);
  f.advance(1801);await assert.rejects(client.replacementStatus());assert.equal(f.providerReads(),0);assert.equal(f.deactivateCalls(),0);
  // Expired proof cannot activate the reserved replacement, even though payment succeeded.
  await assert.rejects(client.activate(f.key));
  assert.equal(f.replacement.license(),null);
  await client.replacementEmailStart();const verified=await client.replacementEmailVerify(f.mail.at(-1).code);
  assert.equal(verified.replacement.stage,'payment');assert.deepEqual(verified.replacement.devices,[]);
  assert.equal(f.replacement.replacement().orderId,flow.orderId);assert.notEqual(f.replacement.replacement().identityToken,flow.identityToken);
  const complete=await client.replacementStatus();assert.equal(complete.replacement.stage,'complete');assert.equal(complete.license,'active');assert.equal(complete.plan,'personal-lifetime');
  assert.equal(f.checkoutCalls(),1);assert.equal(f.deactivateCalls(),1);assert.equal(f.replacement.replacement(),null);
  assert.equal((await client.authorize()).plan,'personal-lifetime');assert.equal((await f.original.client.validateOnline()).active,false);
 }finally{await f.close();}
});

test('real verified token cannot create or finish another device replacement',async()=>{
 const f=await fixture();try{
  const {client,device}=f.replacement;await client.replacementEmailStart(f.key);await client.replacementEmailVerify(f.mail.at(-1).code);
  const token=f.replacement.replacement().identityToken;
  await assert.rejects(client.request('replacementRequest',{licenseRef:'license',oldDeviceId:f.oldId,licenseKey:f.key,identityToken:token},pair()));assert.equal(f.checkoutCalls(),0);
  await client.replacementRequest(f.oldId);const flow=f.replacement.replacement();
  await assert.rejects(client.request('replacementRequest',{licenseRef:'license',oldDeviceId:randomBytes(32).toString('base64url'),licenseKey:f.key,identityToken:token},device));
  await assert.rejects(client.request('replacementStatus',{orderId:flow.orderId,licenseKey:'wrong-key',identityToken:token},device));
  assert.equal(f.checkoutCalls(),1);assert.equal(f.providerReads(),0);assert.equal(f.deactivateCalls(),0);
 }finally{await f.close();}
});
