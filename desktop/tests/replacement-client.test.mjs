import test from 'node:test';
import assert from 'node:assert/strict';
import {LicenseClient,trustedCheckout} from '../core/license-client.mjs';
import {replacementPrice} from '../shared/replacement-prices.mjs';
import {replacementMessages} from '../shared/replacement-messages.mjs';
import {generateKeyPairSync} from 'node:crypto';
import {deviceIdentity} from '../shared/entitlement.mjs';

const email='Buyer@Example.com';
function fixture(){
 const pair=generateKeyPairSync('ed25519'),device={publicKey:pair.publicKey.export({type:'spki',format:'pem'}),privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'})};
 let flow=null,saved=null,now=1800000000000;const calls=[],old=deviceIdentity(device.publicKey);
 const client=new LicenseClient({keys:{test:'unused'},now:()=>now,readDevice:async()=>device,readLicense:async()=>saved,saveLicense:async value=>saved=value,readReplacement:async()=>flow,saveReplacement:async value=>flow=value});
 client.request=async(action,body)=>{calls.push({action,body});if(action==='replacementEmailStart')return {verificationId:'verify-id-'+calls.length,maskedEmail:'b***@example.com',expiresAt:now/1000+600,resendAfter:now/1000+60};
  if(action==='replacementEmailVerify')return {identityToken:'private-identity',licenseRef:'license',plan:'personal-monthly',devices:[{id:old,current:true,active:true}],expiresAt:now/1000+1800};
  return {orderId:'order',status:'payment-pending',fee:replacementPrice('personal-monthly'),checkoutUrl:'https://checkout.dodopayments.com/session'};
 };
 return {client,calls,old,read:()=>flow,save:value=>flow=value,license:()=>saved,seedLicense:value=>saved=value,advance:ms=>now+=ms};
}
test('opening the flow sends nothing and a code needs a typed purchase email',async()=>{
 const f=fixture();
 assert.deepEqual(await f.client.replacementState(),{replacement:{stage:'idle'}});
 for(const value of [undefined,'','   ','not-an-email','a@b'])await assert.rejects(f.client.replacementEmailStart({licenseKey:'private-key',email:value}),{message:replacementMessages['email-required']});
 await assert.rejects(f.client.replacementEmailStart({email}),{message:replacementMessages['license-key-required']});
 await assert.rejects(f.client.replacementEmailResend(),{message:replacementMessages['send-first']});
 assert.equal(f.calls.length,0);
 await f.client.replacementEmailStart({licenseKey:'private-key',email});
 assert.deepEqual(f.calls.map(call=>call.action),['replacementEmailStart']);
 assert.equal(f.calls[0].body.email,'buyer@example.com');assert.equal(f.calls[0].body.licenseKey,'private-key');
});
test('resend is explicit, respects cooldown and reuses the validated email',async()=>{
 const f=fixture();await f.client.replacementEmailStart({licenseKey:'private-key',email});
 await assert.rejects(f.client.replacementEmailResend(),{message:replacementMessages['email-cooldown']});assert.equal(f.calls.length,1);
 f.advance(60000);const resent=await f.client.replacementEmailResend();
 assert.equal(f.calls.length,2);assert.equal(f.calls[1].body.email,'buyer@example.com');assert.equal(f.read().verificationId,'verify-id-2');assert.equal(resent.replacement.stage,'email');
});
test('expired or changed email verification returns to the email form without sending',async()=>{
 const f=fixture();await f.client.replacementEmailStart({licenseKey:'private-key',email});
 f.advance(601000);
 assert.deepEqual((await f.client.replacementState()).replacement,{stage:'idle',email:'buyer@example.com',expired:true});
 await assert.rejects(f.client.replacementEmailVerify('12345678'),{message:replacementMessages['code-expired']});
 const reset=await f.client.replacementReset();assert.deepEqual(reset.replacement,{stage:'idle',email:'buyer@example.com'});
 await assert.rejects(f.client.replacementEmailVerify('12345678'),{message:replacementMessages['send-first']});
 assert.equal(f.calls.length,1);
 // A different address starts a fresh verification; no earlier proof survives.
 await f.client.replacementEmailStart({licenseKey:'private-key',email:'other@example.com'});assert.equal(f.read().email,'other@example.com');assert.equal(f.read().identityToken,undefined);
});
test('server reason codes become specific messages and never fake a sent state',async()=>{
 const pair=generateKeyPairSync('ed25519'),device={publicKey:pair.publicKey.export({type:'spki',format:'pem'}),privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'})};
 for(const reason of ['email-mismatch','email-delivery-failed','email-cooldown','code-expired']){
  let flow=null;
  const client=new LicenseClient({keys:{test:'unused'},readDevice:async()=>device,readLicense:async()=>({licenseKey:'private-key'}),saveLicense:async()=>{},readReplacement:async()=>flow,saveReplacement:async value=>flow=value,
   fetchImpl:async url=>url.endsWith('/v1/challenge')?Response.json({challenge:null}):new Response(JSON.stringify({error:'x',reason}),{status:reason==='email-delivery-failed'?503:400,headers:{'content-type':'application/json'}})});
  client.request=async(action,body)=>client.post('/v1/'+action,body);
  await assert.rejects(client.replacementEmailStart({email}),{message:replacementMessages[reason]});
  assert.equal(flow,null);
 }
});
test('replacement keeps purchaser proof and key private, and payment pending never activates',async()=>{
 const f=fixture();await assert.rejects(f.client.replacementRequest(f.old),/Verify/);
 const start=await f.client.replacementEmailStart({licenseKey:'private-key',email});assert.equal(start.replacement.maskedEmail,'b***@example.com');
 await assert.rejects(f.client.replacementEmailVerify('123456'),/eight-digit/);
 const verified=await f.client.replacementEmailVerify('12345678');assert.equal(verified.replacement.fee.amount,99);
 await assert.rejects(f.client.replacementRequest('b'.repeat(43)),/Choose/);
 const payment=await f.client.replacementRequest(f.old);assert.equal(payment.replacement.stage,'payment');
 const status=await f.client.replacementStatus();assert.equal(status.replacement.status,'payment-pending');assert.equal(f.license(),null);
 for(const response of [start,verified,payment,status]){const text=JSON.stringify(response);for(const secret of ['private-key','private-identity','checkout.dodopayments','verify-id'])assert.equal(text.includes(secret),false);}
 assert.equal((await f.client.replacementCheckout()).checkoutUrl,'https://checkout.dodopayments.com/session');
});
test('re-verifying an expired checkout session preserves its single order',async()=>{
 const f=fixture();await f.client.replacementEmailStart({licenseKey:'private-key',email});await f.client.replacementEmailVerify('12345678');await f.client.replacementRequest(f.old);
 f.save({...f.read(),expiresAt:1});
 await assert.rejects(f.client.replacementReset(),{message:replacementMessages['payment-pending']});
 await f.client.replacementEmailStart({email});assert.equal(f.read().orderId,'order');
 await f.client.replacementEmailVerify('12345678');assert.equal(f.read().stage,'payment');assert.equal(f.read().orderId,'order');
 assert.equal(f.calls.filter(call=>call.action==='replacementRequest').length,1);
});
test('payment URL and fixed fee are checked before storage or browser opening',async()=>{
 for(const url of ['https://checkout.dodopayments.com.evil.example/a','http://checkout.dodopayments.com/a','https://user@checkout.dodopayments.com/a','file:///secret','javascript:alert(1)'])assert.equal(trustedCheckout(url),false);
 const f=fixture();await f.client.replacementEmailStart({licenseKey:'private-key',email});await f.client.replacementEmailVerify('12345678');
 f.client.request=async()=>({orderId:'order',status:'payment-pending',fee:{...replacementPrice('personal-monthly'),amount:1},checkoutUrl:'https://checkout.dodopayments.com/session'});
 await assert.rejects(f.client.replacementRequest(f.old),/Invalid replacement/);assert.equal(f.read().stage,'verified');
});

test('confirmed release clears the old local grant without activating the requester',async()=>{
 const f=fixture();f.seedLicense({licenseRef:'license',instanceId:'old-instance',licenseKey:'private-key',entitlement:'old-grant'});
 await f.client.replacementEmailStart({email});await f.client.replacementEmailVerify('12345678');await f.client.replacementRequest(f.old);
 f.client.request=async action=>{assert.equal(action,'replacementStatus');return {orderId:'order',status:'complete',replacementAuthorized:true,revokedInstanceId:'old-instance',fee:replacementPrice('personal-monthly')};};
 f.client.activate=async()=>{assert.fail('Replacement must not automatically reactivate the old computer');};
 const result=await f.client.replacementStatus();assert.equal(result.license,'revoked');assert.equal(result.activationAvailable,true);assert.equal(result.trialPending,false);
 assert.deepEqual(f.license(),{revoked:true,deactivationPending:true,lastTrustedTime:1800000000000});assert.deepEqual(f.read(),{stage:'complete'});
 await assert.rejects(f.client.authorize(),/verification/);await assert.rejects(f.client.trial(),/license key/);
 assert.deepEqual(await f.client.replacementState(),{replacement:{stage:'complete'}});
});

test('releasing another seat preserves an unrelated active local seat',async()=>{
 const f=fixture(),saved={licenseRef:'license',licenseKey:'private-key',entitlement:'keep-this-grant'};f.seedLicense(saved);
 f.save({stage:'payment',plan:'personal-monthly',licenseRef:'license',licenseKey:'private-key',oldDeviceId:'b'.repeat(43),orderId:'order',identityToken:'proof',devices:[]});
 f.client.request=async()=>({orderId:'order',status:'complete',replacementAuthorized:true,revokedInstanceId:'old-instance',fee:replacementPrice('personal-monthly')});
 const result=await f.client.replacementStatus();assert.equal(result.license,undefined);assert.deepEqual(f.license(),saved);
});

test('checking an old completed order never clears a newer activation on the same device',async()=>{
 const f=fixture(),saved={licenseRef:'license',instanceId:'new-instance',licenseKey:'private-key',entitlement:'new-grant'};f.seedLicense(saved);
 f.save({stage:'payment',plan:'personal-monthly',licenseRef:'license',licenseKey:'private-key',oldDeviceId:f.old,orderId:'order',identityToken:'proof',devices:[]});
 f.client.request=async()=>({orderId:'order',status:'complete',replacementAuthorized:true,revokedInstanceId:'old-instance',fee:replacementPrice('personal-monthly')});
 const result=await f.client.replacementStatus();assert.equal(result.license,undefined);assert.deepEqual(f.license(),saved);
});
test('cancel revocation returns to device choice (or the email form once verification expires) and never leaks the order',async()=>{
 const f=fixture();await assert.rejects(f.client.replacementCancel(),/No revocation payment/);
 await f.client.replacementEmailStart({licenseKey:'private-key',email});await f.client.replacementEmailVerify('12345678');await f.client.replacementRequest(f.old);
 const request=f.client.request;f.client.request=async(action,body)=>{f.calls.push({action,body});if(action==='replacementCancel')return {orderId:'order',status:'cancelled',fee:replacementPrice('personal-monthly')};return request(action,body);};
 const cancelled=await f.client.replacementCancel();
 assert.equal(cancelled.replacement.stage,'verified');assert.equal(cancelled.replacement.status,undefined);assert.equal(cancelled.replacement.checkoutAvailable,undefined);
 assert.deepEqual(f.calls.at(-1).body,{orderId:'order',licenseKey:'private-key',identityToken:'private-identity'});
 assert.equal(f.read().orderId,undefined);assert.equal(f.read().checkoutUrl,undefined);assert.equal(JSON.stringify(cancelled).includes('private-'),false);
 // A new device choice creates a new order.
 assert.equal((await f.client.replacementRequest(f.old)).replacement.stage,'payment');
 // Verification expired: cancelling returns to the email form with the typed email.
 f.advance(1801000);const later=await f.client.replacementCancel();assert.deepEqual(later.replacement,{stage:'idle',email:'buyer@example.com'});
});
test('cancel after payment went through follows the normal payment status path',async()=>{
 const f=fixture();await f.client.replacementEmailStart({licenseKey:'private-key',email});await f.client.replacementEmailVerify('12345678');await f.client.replacementRequest(f.old);
 f.client.request=async action=>action==='replacementCancel'?{orderId:'order',status:'payment-confirmed',fee:replacementPrice('personal-monthly')}:{orderId:'order',status:'payment-confirmed',fee:replacementPrice('personal-monthly')};
 const result=await f.client.replacementCancel();assert.equal(result.replacement.stage,'payment');assert.equal(result.replacement.status,'payment-confirmed');assert.equal(f.read().orderId,'order');
});
