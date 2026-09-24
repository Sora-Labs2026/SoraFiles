import test from 'node:test';
import assert from 'node:assert/strict';
import {LicenseClient,trustedCheckout} from '../core/license-client.mjs';
import {replacementPrice} from '../shared/replacement-prices.mjs';

function fixture(){
 let flow=null,saved=null;const calls=[],now=1800000000000,old='a'.repeat(43);
 const client=new LicenseClient({keys:{test:'unused'},now:()=>now,readDevice:async()=>({}),readLicense:async()=>saved,saveLicense:async value=>saved=value,readReplacement:async()=>flow,saveReplacement:async value=>flow=value});
 client.request=async(action,body)=>{calls.push({action,body});if(action==='replacementEmailStart')return {verificationId:'verify-id',maskedEmail:'j***@example.com',expiresAt:now/1000+600,resendAfter:now/1000+60};
  if(action==='replacementEmailVerify')return {identityToken:'private-identity',licenseRef:'license',plan:'personal-monthly',devices:[{id:old,current:false,active:true}],expiresAt:now/1000+1800};
  return {orderId:'order',status:'payment-pending',fee:replacementPrice('personal-monthly'),checkoutUrl:'https://checkout.dodopayments.com/session'};
 };
 return {client,calls,old,read:()=>flow,save:value=>flow=value,license:()=>saved};
}
test('replacement keeps purchaser proof and key private, and payment pending never activates',async()=>{
 const f=fixture();await assert.rejects(f.client.replacementRequest(f.old),/Verify/);
 const start=await f.client.replacementEmailStart('private-key');assert.equal(start.replacement.maskedEmail,'j***@example.com');
 await assert.rejects(f.client.replacementEmailVerify('123456'),/eight-digit/);
 const verified=await f.client.replacementEmailVerify('12345678');assert.equal(verified.replacement.fee.amount,99);
 await assert.rejects(f.client.replacementRequest('b'.repeat(43)),/Choose/);
 const payment=await f.client.replacementRequest(f.old);assert.equal(payment.replacement.stage,'payment');
 const status=await f.client.replacementStatus();assert.equal(status.replacement.status,'payment-pending');assert.equal(f.license(),null);
 for(const response of [start,verified,payment,status]){const text=JSON.stringify(response);for(const secret of ['private-key','private-identity','checkout.dodopayments','verify-id'])assert.equal(text.includes(secret),false);}
 assert.equal((await f.client.replacementCheckout()).checkoutUrl,'https://checkout.dodopayments.com/session');
});
test('re-verifying an expired checkout session preserves its single order',async()=>{
 const f=fixture();await f.client.replacementEmailStart('private-key');await f.client.replacementEmailVerify('12345678');await f.client.replacementRequest(f.old);
 f.save({...f.read(),expiresAt:1});await f.client.replacementEmailStart();assert.equal(f.read().orderId,'order');
 await f.client.replacementEmailVerify('12345678');assert.equal(f.read().stage,'payment');assert.equal(f.read().orderId,'order');
 assert.equal(f.calls.filter(call=>call.action==='replacementRequest').length,1);
});
test('payment URL and fixed fee are checked before storage or browser opening',async()=>{
 for(const url of ['https://checkout.dodopayments.com.evil.example/a','http://checkout.dodopayments.com/a','https://user@checkout.dodopayments.com/a','file:///secret','javascript:alert(1)'])assert.equal(trustedCheckout(url),false);
 const f=fixture();await f.client.replacementEmailStart('private-key');await f.client.replacementEmailVerify('12345678');
 f.client.request=async()=>({orderId:'order',status:'payment-pending',fee:{...replacementPrice('personal-monthly'),amount:1},checkoutUrl:'https://checkout.dodopayments.com/session'});
 await assert.rejects(f.client.replacementRequest(f.old),/Invalid replacement/);assert.equal(f.read().stage,'verified');
});
