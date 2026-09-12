import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {RequestGuard,RateLimiter,requestContext} from '../license-service/request-guard.mjs';
import {LicenseStore} from '../license-service/store.mjs';
import {DodoAuthority} from '../license-service/authority.mjs';
import {plans} from '../shared/plans.mjs';
const now=1800000000;
const catalog=Object.values(plans).map(p=>({plan:p.id,amount:p.amount,interval:p.interval,activationLimit:p.maxDevices,currency:'EUR',productId:p.id,entitlementId:'ent-'+p.id,verified:true}));
test('authenticated challenge rejects forged nonce, body substitution, wrong action and replay',()=>{
 const store=new LicenseStore(':memory:'),pair=generateKeyPairSync('ed25519'),publicKey=pair.publicKey.export({format:'pem',type:'spki'});
 const guard=new RequestGuard({secret:randomBytes(32),store,now:()=>now}),body={licenseKey:'test-key'};
 try {const {token,challenge:c}=guard.issue({action:'activate',body,publicKey});
  const signature=sign(null,Buffer.from(`sorafiles-device-v1\n${c.id}\n${c.context}\n${c.expires}`),pair.privateKey).toString('base64url');
  const request={action:'activate',body,publicKey,signature,token};
  assert.throws(()=>guard.verify({...request,body:{licenseKey:'another'}}),/challenge/);
  assert.throws(()=>guard.verify({...request,action:'trial',body:{subjectToken:'another'}}),/challenge/);
  assert.throws(()=>guard.verify({...request,token:Buffer.from(JSON.stringify({...c,id:'attacker'})).toString('base64url')+'.'+token.split('.')[1]}),/challenge/);
  assert.ok(guard.verify(request));assert.throws(()=>guard.verify(request),/Replayed/);
 }finally{store.close();}
});
test('license boundary refuses filename, content, metadata and unknown request fields',()=>{for(const key of ['filename','file','content','metadata','text','image'])assert.throws(()=>requestContext('activate',{licenseKey:'key',[key]:'private'}));assert.throws(()=>requestContext('unknown',{}));assert.throws(()=>requestContext('activate',{licenseKey:'x'.repeat(4097)}));});
test('rate limiter is bounded and releases expired buckets',()=>{let time=now;const limiter=new RateLimiter({limit:2,maxKeys:1,now:()=>time});limiter.take('a');limiter.take('a');assert.throws(()=>limiter.take('a'));assert.throws(()=>limiter.take('b'));time+=61;limiter.take('b');});
test('Dodo grants bind product, customer, subscription, device limit and current status',async()=>{
 const grant={customer_id:'customer',entitlement_id:'ent-personal-monthly',integration_type:'license_key',status:'Delivered',subscription_id:'sub',license_key:{id:'license',status:'active',activations_limit:1}};
 const subscription={subscription_id:'sub',customer:{customer_id:'customer'},product_id:'personal-monthly',status:'active',next_billing_date:new Date((now+86400)*1000).toISOString()};
 const dodo={customerGrants:async()=>[grant],subscription:async()=>subscription};
 const authority=new DodoAuthority({dodo,catalog,now:()=>now}),resolve=()=>authority.resolve({customerId:'customer',licenseRef:'license'});
 assert.equal((await resolve()).plan,'personal-monthly');assert.equal((await resolve()).status,'active');
 subscription.cancel_at_next_billing_date=true;assert.equal((await resolve()).status,'active');
 subscription.status='cancelled';assert.equal((await resolve()).status,'inactive');subscription.status='active';
 grant.status='Revoked';assert.equal((await resolve()).status,'revoked');grant.status='Delivered';
 grant.license_key.activations_limit=5;await assert.rejects(resolve(),/limit mismatch/);grant.license_key.activations_limit=1;
 subscription.customer.customer_id='other';await assert.rejects(resolve(),/identity mismatch/);subscription.customer.customer_id='customer';
 grant.entitlement_id='unconfigured';await assert.rejects(resolve(),/Unknown/);
});
test('Lifetime rejects subscription/expiry configuration and a Dodo outage cannot issue fresh authority',async()=>{
 const grant={customer_id:'customer',entitlement_id:'ent-team-lifetime',integration_type:'license_key',status:'Delivered',license_key:{id:'license',status:'active',activations_limit:5}};
 const dodo={customerGrants:async()=>[grant]};const authority=new DodoAuthority({dodo,catalog,now:()=>now});const resolve=()=>authority.resolve({customerId:'customer',licenseRef:'license'});
 assert.equal((await resolve()).periodEnd,null);grant.license_key.expires_at=new Date((now+86400)*1000).toISOString();await assert.rejects(resolve(),/permanent/);
 dodo.customerGrants=async()=>{throw Error('Service unavailable');};await assert.rejects(resolve(),/unavailable/);
});
