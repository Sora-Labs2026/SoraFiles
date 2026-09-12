import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {LicenseService} from '../license-service/service.mjs';import {LicenseStore} from '../license-service/store.mjs';import {RequestGuard} from '../license-service/request-guard.mjs';import {deviceIdentity,verifyEntitlement} from '../shared/entitlement.mjs';
const keys=()=>{const p=generateKeyPairSync('ed25519');return {privateKey:p.privateKey.export({format:'pem',type:'pkcs8'}),publicKey:p.publicKey.export({format:'pem',type:'spki'})};};
function setup(){let now=1800000000,counter=0;const signing=keys(),store=new LicenseStore(':memory:'),guard=new RequestGuard({secret:randomBytes(32),store,now:()=>now});const calls=[];
 const state={ref:'lic',plan:'personal-monthly',status:'active',periodEnd:now+86400,observedAt:now};
 const dodo={activate:async()=>({id:'instance-'+(++counter),license_key_id:'lic',customer:{customer_id:'customer'}}),deactivate:async(key,id)=>calls.push({op:'deactivate',id}),validate:async()=>({valid:true})};
 const service=new LicenseService({store,guard,dodo,authority:{resolve:async()=>({...state,observedAt:now})},signing:{privateKey:signing.privateKey,kid:'test'},verifyTrialSubject:async()=> 'a'.repeat(64),now:()=>now});
 async function execute(action,body,device){const {challenge:c,token}=service.challenge({action,body,publicKey:device.publicKey});const signature=sign(null,Buffer.from(`sorafiles-device-v1\n${c.id}\n${c.context}\n${c.expires}`),device.privateKey).toString('base64url');return service.execute(action,{body,publicKey:device.publicKey,signature,token});}
 const verify=(token,device)=>verifyEntitlement(token,{keys:{test:signing.publicKey},deviceId:deviceIdentity(device.publicKey),now:now*1000});
 return {store,service,dodo,calls,state,execute,verify,advance:seconds=>now+=seconds};
}
test('activation through proof, Dodo state, cap, entitlement, refresh, deactivation and replacement',async()=>{const s=setup(),device=keys(),other=keys();try{
 const activated=await s.execute('activate',{licenseKey:'key'},device);assert.equal(s.verify(activated.entitlement,device).maxDevices,1);
 await assert.rejects(s.execute('activate',{licenseKey:'key'},other),/limit/);assert.equal(s.calls.length,1);
 const body={licenseKey:'key',licenseRef:activated.licenseRef,instanceId:activated.instanceId};
 assert.ok((await s.execute('devices',{licenseRef:'lic'},device)).devices[0].current);
 assert.ok(s.verify((await s.execute('refresh',body,device)).entitlement,device));
 await assert.rejects(s.execute('refresh',body,other),/not activated/);
 await s.execute('deactivate',body,device);await assert.rejects(s.execute('refresh',body,device),/not activated/);
 const replacement=await s.execute('activate',{licenseKey:'key'},other);assert.ok(s.verify(replacement.entitlement,other));
 }finally{s.store.close();}});
test('revocation rejects refresh and existing offline grant remains independently verifiable until lease expiry',async()=>{const s=setup(),device=keys();try{
 const activation=await s.execute('activate',{licenseKey:'key'},device);s.advance(1);s.state.status='revoked';
 await assert.rejects(s.execute('refresh',{licenseKey:'key',licenseRef:'lic',instanceId:activation.instanceId},device),/inactive/);
 // Offline machines cannot receive immediate revocation. This is an explicit lease limitation.
 assert.ok(s.verify(activation.entitlement,device));s.advance(86400);assert.throws(()=>s.verify(activation.entitlement,device),/expired/);
 }finally{s.store.close();}});
test('trial retry preserves original deadline and a new key cannot reuse the verified subject',async()=>{const s=setup(),device=keys();try{
 const first=s.verify((await s.execute('trial',{subjectToken:'verified'},device)).entitlement,device);s.advance(3600);
 const retry=s.verify((await s.execute('trial',{subjectToken:'verified'},device)).entitlement,device);assert.equal(first.exp,retry.exp);
 await assert.rejects(s.execute('trial',{subjectToken:'verified'},keys()),/already used/);s.advance(7*86400);await assert.rejects(s.execute('trial',{subjectToken:'verified'},device),/expired/);
 }finally{s.store.close();}});
