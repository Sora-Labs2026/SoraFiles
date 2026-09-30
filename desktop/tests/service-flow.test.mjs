import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {LicenseService} from '../license-service/service.mjs';import {LicenseStore} from '../license-service/store.mjs';import {RequestGuard} from '../license-service/request-guard.mjs';import {deviceIdentity,verifyEntitlement} from '../shared/entitlement.mjs';
const keys=()=>{const p=generateKeyPairSync('ed25519');return {privateKey:p.privateKey.export({format:'pem',type:'pkcs8'}),publicKey:p.publicKey.export({format:'pem',type:'spki'})};};
function setup({file=':memory:',secret=randomBytes(32)}={}){let now=1800000000,counter=0;const signing=keys(),store=new LicenseStore(file),guard=new RequestGuard({secret,store,now:()=>now});const calls=[];
 const state={ref:'lic',plan:'personal-monthly',status:'active',periodEnd:now+86400,observedAt:now};
 const dodo={activate:async()=>({id:'instance-'+(++counter),license_key_id:'lic',customer:{customer_id:'customer'}}),deactivate:async(key,id)=>calls.push({op:'deactivate',id}),validate:async()=>({valid:true})};
 const service=new LicenseService({store,guard,dodo,authority:{resolve:async()=>({...state,observedAt:now})},signing:{privateKey:signing.privateKey,kid:'test'},now:()=>now});
 async function execute(action,body,device){const {challenge:c,token}=service.challenge({action,body,publicKey:device.publicKey});const signature=sign(null,Buffer.from(`sorafiles-device-v1\n${c.id}\n${c.context}\n${c.expires}`),device.privateKey).toString('base64url');return service.execute(action,{body,publicKey:device.publicKey,signature,token});}
 const verify=(token,device)=>verifyEntitlement(token,{keys:{test:signing.publicKey},deviceId:deviceIdentity(device.publicKey),now:now*1000});
 return {store,service,dodo,calls,state,execute,verify,activationCount:()=>counter,advance:seconds=>now+=seconds};
}
test('paid activation binds the device and refuses unapproved transfer requests',async()=>{const s=setup(),device=keys(),other=keys();try{
 const activated=await s.execute('activate',{licenseKey:'key'},device);assert.equal(s.verify(activated.entitlement,device).maxDevices,1);
 await assert.rejects(s.execute('activate',{licenseKey:'key'},other),/limit/);assert.equal(s.calls.length,1);
 const body={licenseKey:'key',licenseRef:activated.licenseRef,instanceId:activated.instanceId};
 assert.ok((await s.execute('devices',{licenseRef:'lic'},device)).devices[0].current);
 assert.ok(s.verify((await s.execute('refresh',body,device)).entitlement,device));
 await assert.rejects(s.execute('refresh',body,other),/not activated/);
 await assert.rejects(s.execute('deactivate',body,device),/fields/);
 s.store.revokeDevice('lic',deviceIdentity(device.publicKey));
 await assert.rejects(s.execute('activate',{licenseKey:'key'},other),/limit/);
 }finally{s.store.close();}});
test('revocation rejects refresh and existing offline grant remains independently verifiable until lease expiry',async()=>{const s=setup(),device=keys();try{
 const activation=await s.execute('activate',{licenseKey:'key'},device);s.advance(1);s.state.status='revoked';
 await assert.rejects(s.execute('refresh',{licenseKey:'key',licenseRef:'lic',instanceId:activation.instanceId},device),/inactive/);
 // Offline machines cannot receive immediate revocation. This is an explicit lease limitation.
 assert.ok(s.verify(activation.entitlement,device));s.advance(86400);assert.throws(()=>s.verify(activation.entitlement,device),/expired/);
 }finally{s.store.close();}});

test('revocation between provisional registration and final signing issues no entitlement or permanent binding',async()=>{
 const s=setup(),device=keys();try{
  const finish=s.store.finishActivation.bind(s.store),issue=s.service.issue.bind(s.service);let signed=0;
  s.service.issue=(...args)=>{signed++;return issue(...args);};
  s.store.finishActivation=(...args)=>{if(args[2]==='complete')s.store.sync({...s.state,status:'revoked',observedAt:1800000001});return finish(...args);};
  await assert.rejects(s.execute('activate',{licenseKey:'synthetic-key'},device),/inactive/);
  assert.equal(signed,0);assert.equal(s.store.db.prepare('SELECT COUNT(*) AS n FROM permanent_devices').get().n,0);assert.equal(s.calls.length,1);
 }finally{s.store.close();}
});
test('device trial retry preserves its original deadline without a sign-in provider',async()=>{const s=setup(),device=keys();try{
 const first=s.verify((await s.execute('trial',{},device)).entitlement,device);s.advance(3600);
 const retry=s.verify((await s.execute('trial',{},device)).entitlement,device);assert.equal(first.exp,retry.exp);
 const other=keys();assert.ok(s.verify((await s.execute('trial',{},other)).entitlement,other));s.advance(7*86400);await assert.rejects(s.execute('trial',{},device),/expired/);
 }finally{s.store.close();}});

test('installation trial time can only shorten a new trial and never changes an existing deadline',async()=>{const s=setup();try{
 const device=keys(),first=s.verify((await s.execute('trial',{installedAt:1800000000-2*86400},device)).entitlement,device);
 assert.equal(first.exp,1800000000+5*86400);s.advance(3600);
 for(const body of [{},{installedAt:1900000000},{installedAt:1}])assert.equal(s.verify((await s.execute('trial',body,device)).entitlement,device).exp,first.exp);
 const future=keys();assert.equal(s.verify((await s.execute('trial',{installedAt:1900000000},future)).entitlement,future).exp,1800003600+7*86400);
 const expired=keys();await assert.rejects(s.execute('trial',{installedAt:1800000000-8*86400},expired),/expired/);await assert.rejects(s.execute('trial',{},expired),/expired/);
 for(const installedAt of [-1,0,1.5,'1800000000',null,Number.MAX_SAFE_INTEGER+1])await assert.rejects(s.execute('trial',{installedAt},keys()),/fields/);
 }finally{s.store.close();}});

test('device trial survives a service restart and never accepts client identity or duration fields',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'sf-device-trial-')),file=join(directory,'licenses.sqlite'),secret=randomBytes(32),device=keys();let s=setup({file,secret});
 try{
  const first=s.verify((await s.execute('trial',{},device)).entitlement,device);assert.equal(first.exp-first.iat,7*86400);
  assert.throws(()=>s.verify((s.service.issue(null,deviceIdentity(device.publicKey),{iat:first.iat,exp:first.exp})),keys()),/claims/);
  s.store.close();s=setup({file,secret});s.advance(86400);
  const retry=s.verify((await s.execute('trial',{},device)).entitlement,device);assert.equal(retry.exp,first.exp);
  for(const body of [{subjectToken:'arbitrary'},{deviceId:'other'},{days:30},{plan:'personal-lifetime'}])await assert.rejects(s.execute('trial',body,device),/fields/);
  const rows=s.store.db.prepare('SELECT * FROM trials').all();assert.equal(rows.length,1);assert.equal(JSON.stringify(rows).includes(device.publicKey),false);
  s.advance(6*86400);await assert.rejects(s.execute('trial',{},device),/expired/);
 }finally{s.store.close();rmSync(directory,{recursive:true,force:true});}
});

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

test('failed compensation blocks retries without releasing the original device binding',async()=>{
 const s=setup(),device=keys();try{
  const first=await s.execute('activate',{licenseKey:'key'},device);
  const next=await s.execute('activate',{licenseKey:'key'},device);assert.equal(next.instanceId,first.instanceId);
  const other=keys();s.dodo.deactivate=async()=>{throw Error('timeout');};
  await assert.rejects(s.execute('activate',{licenseKey:'key'},other),/reconciliation/);const count=s.activationCount();
  await assert.rejects(s.execute('activate',{licenseKey:'key'},other),/reconciliation/);assert.equal(s.activationCount(),count);
 }finally{s.store.close();}
});

test('refresh cannot resurrect a device revoked during provider verification',async()=>{
 const s=setup(),device=keys();try{
  const activation=await s.execute('activate',{licenseKey:'key'},device);
  s.dodo.validate=async()=>{s.store.revokeDevice(activation.licenseRef,deviceIdentity(device.publicKey));return {valid:true};};
  await assert.rejects(s.execute('refresh',{licenseKey:'key',licenseRef:activation.licenseRef,instanceId:activation.instanceId},device),/not activated/);
  assert.equal(s.store.active(activation.licenseRef,deviceIdentity(device.publicKey)),undefined);
 }finally{s.store.close();}
});

test('changing the fingerprint secret fails closed rather than losing activation retry records',()=>{
 const s=setup();try{const otherGuard=new RequestGuard({secret:randomBytes(32),store:s.store});
  assert.throws(()=>new LicenseService({...s.service,guard:otherGuard}),/Activation key changed/);
 }finally{s.store.close();}
});

test('permanent device seats survive revocation and a service restart',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'sf-permanent-binding-')),file=join(directory,'licenses.sqlite'),secret=randomBytes(32),device=keys();let s=setup({file,secret});
 try{
  await s.execute('activate',{licenseKey:'key'},device);
  s.store.revokeDevice('lic',deviceIdentity(device.publicKey));s.store.close();s=setup({file,secret});
  await assert.rejects(s.execute('activate',{licenseKey:'key'},keys()),/limit/);
  assert.equal(s.store.db.prepare('SELECT COUNT(*) AS n FROM permanent_devices').get().n,1);
  assert.throws(()=>s.store.rollbackActivation('lic',deviceIdentity(device.publicKey)),/cannot be released/);
 }finally{s.store.close();rmSync(directory,{recursive:true,force:true});}
});

test('another service replica cannot permanently bind a still-provisional registration',()=>{
 const directory=mkdtempSync(join(tmpdir(),'sf-provisional-binding-')),file=join(directory,'licenses.sqlite');const first=new LicenseStore(file);let other;
 try{first.sync({ref:'lic',plan:'personal-lifetime',status:'active',observedAt:1800000000});first.activate('lic','device','instance',1800000000,{provisional:true});
  other=new LicenseStore(file);assert.deepEqual(other.devices('lic'),[]);first.rollbackActivation('lic','device');
  assert.equal(other.db.prepare('SELECT COUNT(*) AS n FROM permanent_devices').get().n,0);
  other.activate('lic','successful-device','successful-instance',1800000000);assert.equal(other.devices('lic').length,1);
 }finally{other?.close();first.close();rmSync(directory,{recursive:true,force:true});}
});
