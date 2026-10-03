import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {LicenseService} from '../license-service/service.mjs';import {LicenseStore} from '../license-service/store.mjs';import {RequestGuard} from '../license-service/request-guard.mjs';
import {trustedPortal} from '../shared/portal.mjs';import {requestContext} from '../shared/license-request.mjs';
const keys=()=>{const p=generateKeyPairSync('ed25519');return {privateKey:p.privateKey.export({format:'pem',type:'pkcs8'}),publicKey:p.publicKey.export({format:'pem',type:'spki'})};};
function setup({plan='personal-monthly',link='https://live.dodopayments.com/customer-portal/session/abc'}={}){
 const now=1800000000,signing=keys(),store=new LicenseStore(':memory:'),guard=new RequestGuard({secret:randomBytes(32),store,now:()=>now}),portals=[];
 const state={ref:'lic',plan,status:'active',periodEnd:plan.includes('lifetime')?null:now+86400,observedAt:now};
 const dodo={activate:async()=>({id:'instance-1',license_key_id:'lic',customer:{customer_id:'customer'}}),deactivate:async()=>{},validate:async()=>({valid:false}),portal:async customerId=>{portals.push(customerId);return {link};}};
 const service=new LicenseService({store,guard,dodo,authority:{resolve:async()=>state},signing:{privateKey:signing.privateKey,kid:'test'},now:()=>now});
 async function execute(action,body,device){const {challenge:c,token}=service.challenge({action,body,publicKey:device.publicKey});const signature=sign(null,Buffer.from(`sorafiles-device-v1\n${c.id}\n${c.context}\n${c.expires}`),device.privateKey).toString('base64url');return service.execute(action,{body,publicKey:device.publicKey,signature,token});}
 return {store,execute,portals};
}

test('an activated subscriber gets a signed-in portal link for their own customer, even when renewal is failing',async()=>{const s=setup(),device=keys();try{
 const {licenseRef,instanceId}=await s.execute('activate',{licenseKey:'key'},device);
 // dodo.validate reports invalid: a lapsed renewal must still reach billing.
 assert.deepEqual(await s.execute('portal',{licenseKey:'key',licenseRef,instanceId},device),{portalUrl:'https://live.dodopayments.com/customer-portal/session/abc'});
 assert.deepEqual(s.portals,['customer']);
}finally{s.store.close();}});

test('portal access needs the activated device, its instance and the same key',async()=>{const s=setup(),device=keys(),other=keys();try{
 const {licenseRef,instanceId}=await s.execute('activate',{licenseKey:'key'},device);
 await assert.rejects(s.execute('portal',{licenseKey:'key',licenseRef,instanceId},other),/not activated/);
 await assert.rejects(s.execute('portal',{licenseKey:'key',licenseRef,instanceId:'instance-2'},device),/Wrong activation instance/);
 await assert.rejects(s.execute('portal',{licenseKey:'other-key',licenseRef,instanceId},device),/Activation history required/);
 assert.deepEqual(s.portals,[]);
}finally{s.store.close();}});

test('lifetime licenses have no subscription portal and untrusted provider links are refused',async()=>{
 const lifetime=setup({plan:'personal-lifetime'}),device=keys();try{
  const {licenseRef,instanceId}=await lifetime.execute('activate',{licenseKey:'key'},device);
  await assert.rejects(lifetime.execute('portal',{licenseKey:'key',licenseRef,instanceId},device),error=>error.reason==='no-subscription');
 }finally{lifetime.store.close();}
 const forged=setup({link:'https://evil.test/portal'}),again=keys();try{
  const {licenseRef,instanceId}=await forged.execute('activate',{licenseKey:'key'},again);
  await assert.rejects(forged.execute('portal',{licenseKey:'key',licenseRef,instanceId},again),error=>error.code==='providerUnavailable');
 }finally{forged.store.close();}
});

test('portal links are limited to Dodo HTTPS hosts and the request schema is exact',()=>{
 for(const url of ['https://live.dodopayments.com/customer-portal/session/x','https://test.dodopayments.com/customer-portal/session/x','https://customer.dodopayments.com/session/x'])assert.ok(trustedPortal(url));
 for(const url of ['http://live.dodopayments.com/x','https://live.dodopayments.com.evil.test/','https://checkout.dodopayments.com/x','https://u@live.dodopayments.com/','https://live.dodopayments.com:444/','javascript:alert(1)',null])assert.equal(trustedPortal(url),false);
 assert.match(requestContext('portal',{licenseKey:'k',licenseRef:'r',instanceId:'i'}),/^portal:/);
 assert.throws(()=>requestContext('portal',{licenseRef:'r',instanceId:'i'}),/fields/);
});
