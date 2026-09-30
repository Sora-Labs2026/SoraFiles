import test from 'node:test';import assert from 'node:assert/strict';
import {randomBytes,generateKeyPairSync} from 'node:crypto';
import {LicenseStore} from '../license-service/store.mjs';
import {RequestGuard} from '../license-service/request-guard.mjs';
import {replaceDevice,prepareReplacement} from '../license-service/replacements.mjs';
import {entitlementClaims,signEntitlement} from '../license-service/signing.mjs';
import {verifyEntitlement} from '../shared/entitlement.mjs';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Worker} from 'node:worker_threads';
import {LicenseService} from '../license-service/service.mjs';
const id=n=>Buffer.alloc(32,n).toString('base64url');
function fixture(plan='personal-lifetime',file=':memory:'){
 const now=1800000000,store=new LicenseStore(file),guard=new RequestGuard({store,secret:randomBytes(32)}),key='synthetic-key';
 const state={ref:'license',plan,status:'active',periodEnd:now+86400,observedAt:now};store.sync(state);store.bind('license','customer');
 const old=id(1),next=id(2),keyHash=guard.activationFingerprint(key);store.reserveActivation(keyHash,old,now);store.recordActivation(keyHash,old,{id:'old-instance',license_key_id:'license',customer:{customer_id:'customer'}});store.activate('license',old,'old-instance',now);store.finishActivation(keyHash,old,'complete');
 let active=true,calls=0;const dodo={validate:async()=>({valid:active}),deactivate:async()=>{calls++;active=false;}};
 const request={ticket:'CASE-1',operator:'support-1',licenseRef:'license',oldDeviceId:old,newDeviceId:next,reason:'lost'};
 return {store,guard,dodo,authority:{resolve:async()=>state},request,licenseKey:key,now,keyHash,old,next,calls:()=>calls};
}
test('approved replacement revokes old server access, reserves exactly one new seat, and is idempotent',async()=>{
 const f=fixture();try{
  const result=await replaceDevice(f);assert.equal(result.oldOfflineEntitlementRevoked,false);assert.equal(f.store.active('license',f.old),undefined);
  assert.throws(()=>f.store.reserveActivation(f.keyHash,f.old,f.now),/replaced/);
  assert.throws(()=>f.store.activate('license',f.old,'old-instance',f.now,{existingOnly:true}),/replaced/);
  assert.throws(()=>f.store.activate('license',id(3),'third-instance',f.now),/limit/);
  f.store.activate('license',f.next,'new-instance',f.now);assert.throws(()=>f.store.activate('license',id(4),'fourth-instance',f.now),/limit/);
  await replaceDevice(f);assert.equal(f.calls(),1);assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM support_replacements').get().n,1);
  await assert.rejects(replaceDevice({...f,request:{...f.request,newDeviceId:id(5)}}),/ticket already used/);
  assert.equal(JSON.stringify(f.store.db.prepare('SELECT * FROM support_replacements').all()).includes(f.licenseKey),false);
 }finally{f.store.close();}
});
test('provider failure retains reservation, retry recovers a lost release response without a second release',async()=>{
 const f=fixture();try{
  const release=f.dodo.deactivate;f.dodo.deactivate=async(...args)=>{await release(...args);throw Error('response lost');};
  await assert.rejects(replaceDevice(f),/response lost/);assert.equal(f.store.active('license',f.old),undefined);
  assert.throws(()=>f.store.activate('license',f.next,'new',f.now),/pending/);
  assert.throws(()=>f.store.activate('license',id(3),'third',f.now),/limit/);
  await replaceDevice(f);assert.equal(f.calls(),1);f.store.activate('license',f.next,'new',f.now);
 }finally{f.store.close();}
});
test('Team replacement retains the five-device cap',async()=>{
 const f=fixture('team-lifetime');try{
  for(let n=3;n<=6;n++)f.store.activate('license',id(n),'instance-'+n,f.now);
  await replaceDevice(f);assert.throws(()=>f.store.activate('license',id(7),'extra',f.now),/limit/);
  f.store.activate('license',f.next,'replacement',f.now);assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM devices WHERE active=1').get().n,5);
 }finally{f.store.close();}
});
test('replacement limits trigger support review; explicit exception is recorded, not a new purchase',async()=>{
 const f=fixture();try{
  await replaceDevice(f);f.store.activate('license',f.next,'new',f.now);
  const request={...f.request,ticket:'CASE-2',oldDeviceId:f.next,newDeviceId:id(3),keyHash:f.keyHash};
  assert.throws(()=>prepareReplacement(f.store,request,f.now+60),/recent replacement/);
  const row=prepareReplacement(f.store,{...request,overrideTicket:'REVIEW-2'},f.now+60);assert.equal(row.override_ticket,'REVIEW-2');
 }finally{f.store.close();}
});
test('an old permanent offline Lifetime entitlement still verifies after replacement',async()=>{
 const f=fixture(),pair=generateKeyPairSync('ed25519');try{
  const claims=entitlementClaims({license:{ref:'license',plan:'personal-lifetime',status:'active'},deviceId:f.old,now:f.now});
  const token=signEntitlement(claims,{kid:'test',privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'})});
  await replaceDevice(f);
  assert.equal(verifyEntitlement(token,{keys:{test:pair.publicKey.export({type:'spki',format:'pem'})},deviceId:f.old,now:(f.now+86400)*1000}).exp,null);
 }finally{f.store.close();}
});
test('replacement reservations and revocations survive restart and reject concurrent attempts to take the seat',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'sf-replace-')),file=join(directory,'license.sqlite');let f=fixture('personal-lifetime',file);
 try{
  await replaceDevice(f);f.store.close();f.store=new LicenseStore(file);
  const workerUrl=new URL('./replacement-worker.mjs',import.meta.url);
  const outcomes=await Promise.all(Array.from({length:8},(_,i)=>new Promise((resolve,reject)=>{
   const worker=new Worker(workerUrl,{workerData:{file,deviceId:i===0?f.next:id(i+10),now:f.now}});
   worker.once('message',resolve);worker.once('error',reject);worker.once('exit',code=>{if(code)reject(Error('worker failed'));});
  })));
  assert.equal(outcomes.filter(row=>row.won).length,1);assert.equal(outcomes[0].won,true);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM devices WHERE active=1').get().n,1);
  assert.throws(()=>f.store.activate('license',f.old,'old-instance',f.now),/replaced/);
  assert.equal(f.store.db.prepare('SELECT status FROM support_replacements').get().status,'complete');
 }finally{f.store.close();await rm(directory,{recursive:true,force:true});}
});
test('annual replacement thresholds reject extra requests until support records an exception',async()=>{
 const f=fixture();try{
  await replaceDevice(f);f.store.activate('license',f.next,'new',f.now);
  const next={...f.request,ticket:'CASE-2',oldDeviceId:f.next,newDeviceId:id(3),keyHash:f.keyHash};
  prepareReplacement(f.store,next,f.now+8*86400);
  // Complete only the synthetic provider-confirmed transaction for this policy test.
  const {completeReplacement}=await import('../license-service/replacements.mjs');completeReplacement(f.store,'CASE-2',f.now+8*86400);
  f.store.activate('license',id(3),'third',f.now+8*86400);
  const third={...next,ticket:'CASE-3',oldDeviceId:id(3),newDeviceId:id(4)};
  assert.throws(()=>prepareReplacement(f.store,third,f.now+16*86400),/replacement limit/);
  assert.equal(prepareReplacement(f.store,{...third,overrideTicket:'SECOND-REVIEW-3'},f.now+16*86400).override_ticket,'SECOND-REVIEW-3');
 }finally{f.store.close();}
});
test('ordinary activation and refresh honor the approved replacement, even with a stale provider response',async()=>{
 const f=fixture(),pair=generateKeyPairSync('ed25519');try{
  const guard={verify:request=>request.publicKey,activationFingerprint:key=>f.guard.activationFingerprint(key)};
  const dodo={...f.dodo,activate:async()=>({id:'new-provider-instance',license_key_id:'license',customer:{customer_id:'customer'}})};
  const service=new LicenseService({store:f.store,guard,dodo,authority:f.authority,signing:{kid:'test',privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'})},now:()=>f.now});
  const execute=(action,body,id)=>service.execute(action,{body,publicKey:id});
  await replaceDevice(f);
  await assert.rejects(execute('activate',{licenseKey:f.licenseKey},f.old),/replaced/);
  await assert.rejects(execute('refresh',{licenseKey:f.licenseKey,licenseRef:'license',instanceId:'old-instance'},f.old),/not activated/);
  const grant=await execute('activate',{licenseKey:f.licenseKey},f.next);
  assert.equal(verifyEntitlement(grant.entitlement,{keys:{test:pair.publicKey.export({type:'spki',format:'pem'})},deviceId:f.next,now:f.now*1000}).maxDevices,1);
  assert.equal(f.store.db.prepare('SELECT activated FROM support_replacements').get().activated,f.now);
 }finally{f.store.close();}
});

test('a refresh already waiting on the provider cannot issue after support revokes the device',async()=>{
 const f=fixture(),pair=generateKeyPairSync('ed25519');try{
  let release,started;const waiting=new Promise(resolve=>{started=resolve;});
  const guard={verify:request=>request.publicKey,activationFingerprint:key=>f.guard.activationFingerprint(key)};
  const dodo={validate:async()=>{started();return new Promise(resolve=>{release=resolve;});}};
  const service=new LicenseService({store:f.store,guard,dodo,authority:f.authority,signing:{kid:'test',privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'})},now:()=>f.now});
  const refresh=service.execute('refresh',{publicKey:f.old,body:{licenseKey:f.licenseKey,licenseRef:'license',instanceId:'old-instance'}});
  const rejected=assert.rejects(refresh,/replaced/);
  await waiting;await replaceDevice(f);release({valid:true});await rejected;
  assert.equal(f.store.active('license',f.old),undefined);
 }finally{f.store.close();}
});

test('unverified provider responses keep the old seat reserved and permit an exact-ticket retry',async()=>{
 const f=fixture();try{
  const validate=f.dodo.validate;f.dodo.validate=async()=>({});
  await assert.rejects(replaceDevice(f),/verification/);
  assert.equal(f.calls(),0);
  assert.equal(f.store.db.prepare('SELECT status FROM support_replacements').get().status,'pending');
  assert.throws(()=>f.store.activate('license',f.next,'new',f.now),/pending/);
  assert.throws(()=>f.store.activate('license',id(3),'third',f.now),/limit/);
  f.dodo.validate=validate;await replaceDevice(f);
  assert.equal(f.calls(),1);
 }finally{f.store.close();}
});

test('provider revocation, expired subscriptions and mismatched keys cannot authorize replacement',async()=>{
 for(const kind of ['revoked','expired','wrong-key']){
  const f=fixture(kind==='expired'?'personal-monthly':'personal-lifetime');try{
   if(kind==='wrong-key')f.licenseKey='another-synthetic-key';
   else {const state=await f.authority.resolve();f.authority.resolve=async()=>({...state,status:kind==='revoked'?'revoked':'active',periodEnd:f.now-1,observedAt:f.now+1});}
   await assert.rejects(replaceDevice(f),/active|match/i);
   assert.equal(f.calls(),0);assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM support_replacements').get().n,0);
  }finally{f.store.close();}
 }
});

test('a refund received while support contacts the provider prevents replacement activation',async()=>{
 const f=fixture();try{
  const release=f.dodo.deactivate;f.dodo.deactivate=async(...args)=>{
   f.store.sync({ref:'license',plan:'personal-lifetime',status:'revoked',observedAt:f.now+1});await release(...args);
  };
  await replaceDevice(f);
  assert.throws(()=>f.store.activate('license',f.next,'new',f.now+2),/inactive/);
  assert.equal(f.store.active('license',f.old),undefined);
 }finally{f.store.close();}
});
