import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {LicenseService} from '../license-service/service.mjs';import {LicenseStore} from '../license-service/store.mjs';import {RequestGuard} from '../license-service/request-guard.mjs';import {deviceIdentity,verifyEntitlement} from '../shared/entitlement.mjs';
const keys=()=>{const p=generateKeyPairSync('ed25519');return {privateKey:p.privateKey.export({format:'pem',type:'pkcs8'}),publicKey:p.publicKey.export({format:'pem',type:'spki'})};};
function setup({file=':memory:',secret=randomBytes(32)}={}){let now=1800000000,counter=0;const signing=keys(),store=new LicenseStore(file),guard=new RequestGuard({secret,store,now:()=>now});const calls=[];
 const state={ref:'lic',plan:'personal-monthly',status:'active',periodEnd:now+86400,observedAt:now};
 const dodo={activate:async()=>({id:'instance-'+(++counter),license_key_id:'lic',customer:{customer_id:'customer'}}),deactivate:async(key,id)=>calls.push({op:'deactivate',id}),validate:async()=>({valid:true})};
 const service=new LicenseService({store,guard,dodo,authority:{resolve:async()=>({...state,observedAt:now})},signing:{privateKey:signing.privateKey,kid:'test'},verifyTrialSubject:async()=> 'a'.repeat(64),now:()=>now});
 async function execute(action,body,device){const {challenge:c,token}=service.challenge({action,body,publicKey:device.publicKey});const signature=sign(null,Buffer.from(`sorafiles-device-v1\n${c.id}\n${c.context}\n${c.expires}`),device.privateKey).toString('base64url');return service.execute(action,{body,publicKey:device.publicKey,signature,token});}
 const verify=(token,device)=>verifyEntitlement(token,{keys:{test:signing.publicKey},deviceId:deviceIdentity(device.publicKey),now:now*1000});
 return {store,service,dodo,calls,state,execute,verify,activationCount:()=>counter,advance:seconds=>now+=seconds};
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

test('a lost activation response can be retried after restart without consuming a second provider seat',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'sf-activation-')),file=join(directory,'licenses.sqlite'),secret=randomBytes(32),device=keys();let s=setup({file,secret});
 try{
  const first=await s.execute('activate',{licenseKey:'key'},device);assert.equal(s.activationCount(),1);s.store.close();s=setup({file,secret});
  const recovered=await s.execute('activate',{licenseKey:' key '},device);
  assert.equal(recovered.instanceId,first.instanceId);assert.equal(s.activationCount(),0);assert.ok(s.verify(recovered.entitlement,device));
  s.state.status='revoked';await assert.rejects(s.execute('activate',{licenseKey:'key'},device),/inactive/);assert.equal(s.activationCount(),0);
 }finally{s.store.close();rmSync(directory,{recursive:true,force:true});}
});

test('concurrent activation requests reserve one provider call and recover the completed result',async()=>{
 const s=setup(),device=keys();let release,entered;const started=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);const activate=s.dodo.activate;
 s.dodo.activate=async(...args)=>{entered();await gate;return activate(...args);};
 try{const first=s.execute('activate',{licenseKey:'key'},device);await started;
  await assert.rejects(s.execute('activate',{licenseKey:'key'},device),error=>error.code==='activationReconciliation');release();const result=await first;
  assert.equal((await s.execute('activate',{licenseKey:'key'},device)).instanceId,result.instanceId);assert.equal(s.activationCount(),1);
 }finally{release();s.store.close();}
});

test('provider timeout stays blocked across service restart and stores no raw license key',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'sf-activation-')),file=join(directory,'licenses.sqlite'),secret=randomBytes(32),device=keys();let s=setup({file,secret});
 try{
  s.dodo.activate=async()=>{throw Object.assign(Error('timeout'),{code:'providerUnavailable'});};
  await assert.rejects(s.execute('activate',{licenseKey:'private-key'},device),error=>error.code==='activationReconciliation');
  const saved=s.store.db.prepare('SELECT * FROM activation_attempts').get();assert.equal(saved.status,'blocked');assert.equal(JSON.stringify(saved).includes('private-key'),false);
  s.store.close();s=setup({file,secret});await assert.rejects(s.execute('activate',{licenseKey:'private-key'},device),/reconciliation/);assert.equal(s.activationCount(),0);
 }finally{s.store.close();rmSync(directory,{recursive:true,force:true});}
});

test('failed compensation blocks another activation; successful deactivation permits deliberate reactivation',async()=>{
 const s=setup(),device=keys();try{
  const first=await s.execute('activate',{licenseKey:'key'},device);
  await s.execute('deactivate',{licenseKey:'key',licenseRef:first.licenseRef,instanceId:first.instanceId},device);
  const next=await s.execute('activate',{licenseKey:'key'},device);assert.notEqual(next.instanceId,first.instanceId);
  const other=keys();s.dodo.deactivate=async()=>{throw Error('timeout');};
  await assert.rejects(s.execute('activate',{licenseKey:'key'},other),/reconciliation/);const count=s.activationCount();
  await assert.rejects(s.execute('activate',{licenseKey:'key'},other),/reconciliation/);assert.equal(s.activationCount(),count);
 }finally{s.store.close();}
});

test('refresh cannot resurrect a device deactivated during provider verification',async()=>{
 const s=setup(),device=keys();try{
  const activation=await s.execute('activate',{licenseKey:'key'},device);
  s.dodo.validate=async()=>{s.store.deactivate(activation.licenseRef,deviceIdentity(device.publicKey));return {valid:true};};
  await assert.rejects(s.execute('refresh',{licenseKey:'key',licenseRef:activation.licenseRef,instanceId:activation.instanceId},device),/not activated/);
  assert.equal(s.store.active(activation.licenseRef,deviceIdentity(device.publicKey)),undefined);
 }finally{s.store.close();}
});

test('changing the fingerprint secret fails closed rather than losing activation retry records',()=>{
 const s=setup();try{const otherGuard=new RequestGuard({secret:randomBytes(32),store:s.store});
  assert.throws(()=>new LicenseService({...s.service,guard:otherGuard}),/Activation key changed/);
 }finally{s.store.close();}
});
