import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {LicenseClient} from '../core/license-client.mjs';import {LicenseService} from '../license-service/service.mjs';import {LicenseStore} from '../license-service/store.mjs';import {RequestGuard} from '../license-service/request-guard.mjs';import {createLicenseHttpServer} from '../license-service/http.mjs';
function pair(){const keys=generateKeyPairSync('ed25519');return {publicKey:keys.publicKey.export({type:'spki',format:'pem'}),privateKey:keys.privateKey.export({type:'pkcs8',format:'pem'})};}
async function fixture(){
 const signer=pair(),device=pair(),store=new LicenseStore(':memory:');let now=1800000000000,saved=null,online=true,calls=0;
 const guard=new RequestGuard({store,secret:randomBytes(32),now:()=>Math.floor(now/1000)}),service=new LicenseService({store,guard,signing:{privateKey:signer.privateKey,kid:'test'},now:()=>Math.floor(now/1000),dodo:{activate:async()=>({id:'instance',license_key_id:'license',customer:{customer_id:'customer'}}),validate:async()=>({valid:true}),deactivate:async()=>{}},authority:{resolve:async()=>({ref:'license',plan:'personal-monthly',status:'active',periodEnd:Math.floor(now/1000)+86400,maxDevices:1,observedAt:Math.floor(now/1000)})}});
 const server=createLicenseHttpServer({service,webhooks:{},rateSecret:randomBytes(32)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const options={origin:'http://127.0.0.1:'+server.address().port,allowLocalTesting:true,keys:{test:signer.publicKey},readDevice:async()=>device,readLicense:async()=>saved,saveLicense:async value=>{saved=value;},now:()=>now,fetchImpl:async(...args)=>{calls++;if(!online)throw Error('offline');return fetch(...args);}};
 return {options,client:new LicenseClient(options),read:()=>saved,set:value=>saved=value,advance:seconds=>now+=seconds*1000,offline:()=>online=false,calls:()=>calls,async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));store.close();}};
}
test('real HTTP device trial verifies before storage and then authorizes offline',async()=>{
 const f=await fixture();try{
  const result=await f.client.trial();assert.deepEqual(Object.keys(result),['plan','expiresAt']);assert.equal(result.plan,'trial');assert.ok(f.read().entitlement);assert.equal(f.calls(),2);
  f.offline();f.advance(3600);assert.equal((await f.client.authorize()).plan,'trial');assert.equal(f.calls(),2);
  f.advance(-1000);await assert.rejects(f.client.authorize(),/Clock/);f.advance(7*86400);await assert.rejects(f.client.authorize(),/expired/);
 }finally{await f.close();}
});
test('tampered stored token and a token copied to another device never authorize',async()=>{
 const f=await fixture();try{await f.client.trial();const original=f.read();
  f.set({...original,entitlement:original.entitlement.slice(0,-10)+'altered'});await assert.rejects(f.client.authorize());
  f.set(original);const other=new LicenseClient({...f.options,readDevice:async()=>pair()});await assert.rejects(other.authorize(),/claims/);
 }finally{await f.close();}
});
test('untrusted service locations and oversized response bodies fail closed',async()=>{
 const f=await fixture();try{
  for(const origin of ['http://license.sorafiles.com','https://elsewhere.example','https://license.sorafiles.com/extra','https://user:pass@license.sorafiles.com'])assert.throws(()=>new LicenseClient({...f.options,origin}),/Untrusted/);
  let stored=false;const huge=new LicenseClient({...f.options,saveLicense:async()=>{stored=true;},fetchImpl:async()=>new Response('x'.repeat(20000),{headers:{'Content-Type':'application/json'}})});
  await assert.rejects(huge.trial(),/too large/);assert.equal(stored,false);
  const wrong=new LicenseClient({...f.options,fetchImpl:async()=>new Response(JSON.stringify({challenge:{},token:'fake'}),{headers:{'Content-Type':'application/json'}})});await assert.rejects(wrong.trial(),/challenge/);
 }finally{await f.close();}
});
test('protected-storage failure does not report trial success and retry retains its deadline',async()=>{
 const f=await fixture();try{
  const failing=new LicenseClient({...f.options,saveLicense:async()=>{throw Error('Protected storage unavailable');}});
  await assert.rejects(failing.trial(),/Protected storage/);assert.equal(f.read(),null);f.advance(3600);
  const result=await f.client.trial();assert.equal(result.expiresAt,1800000000+7*86400);
 }finally{await f.close();}
});
test('paid activation goes through HTTP proof and stores authority only after signature verification',async()=>{
 const f=await fixture();try{const result=await f.client.activate('synthetic-dodo-key');assert.equal(result.plan,'personal-monthly');assert.equal(result.maxDevices,1);assert.equal(JSON.stringify(result).includes('synthetic-dodo-key'),false);assert.equal(f.read().licenseRef,'license');assert.equal(f.read().instanceId,'instance');await assert.rejects(f.client.trial(),/paid license/);f.offline();assert.equal((await f.client.authorize()).plan,'personal-monthly');}finally{await f.close();}
});
test('first activation and trial require an online response and cannot unlock from a pasted key alone',async()=>{
 const f=await fixture();try{
  f.offline();await assert.rejects(f.client.activate('synthetic-dodo-key'),/offline/);assert.equal(f.read(),null);
  await assert.rejects(f.client.trial(),/offline/);assert.equal(f.read(),null);
  await assert.rejects(f.client.authorize(),/Start a trial or activate/);
 }finally{await f.close();}
});
test('subscription refresh requires internet and renews only a verified existing license',async()=>{
 const f=await fixture();try{
  const initial=await f.client.activate('synthetic-dodo-key');f.advance(3600);
  const refreshed=await f.client.refresh();assert.ok(refreshed.expiresAt>initial.expiresAt);
  const devices=await f.client.devices();assert.equal(devices.length,1);assert.equal(devices[0].current,true);assert.equal(devices[0].active,true);
  const saved=f.read();f.offline();await assert.rejects(f.client.refresh(),/offline/);assert.deepEqual(f.read(),saved);assert.equal((await f.client.authorize()).plan,'personal-monthly');
  f.advance(86401);await assert.rejects(f.client.authorize(),/expired/);
 }finally{await f.close();}
});
test('deactivation persists intent and recovers a lost response without restoring offline access',async()=>{
 const f=await fixture();try{
  await f.client.activate('synthetic-dodo-key');let drop=true;
  const client=new LicenseClient({...f.options,fetchImpl:async(url,options)=>{const response=await fetch(url,options);if(drop&&url.endsWith('/deactivate')){drop=false;await response.body.cancel();throw Error('response lost');}return response;}});
  await assert.rejects(client.deactivate(),/response lost/);assert.equal(f.read().deactivationPending,true);
  await assert.rejects(client.authorize(),/deactivating/);await assert.rejects(client.refresh(),/deactivating/);await assert.rejects(client.activate('another-key'),/deactivating/);
  const restarted=new LicenseClient(f.options);assert.deepEqual(await restarted.deactivate(),{deactivated:true});assert.equal(f.read(),null);await assert.rejects(restarted.authorize(),/Start a trial/);
 }finally{await f.close();}
});
test('an offline deactivation remains pending until confirmed and never clears the stored recovery fields',async()=>{
 const f=await fixture();try{await f.client.activate('synthetic-dodo-key');f.offline();await assert.rejects(f.client.deactivate(),/offline/);assert.equal(f.read().licenseRef,'license');assert.equal(f.read().deactivationPending,true);await assert.rejects(f.client.authorize(),/deactivating/);}finally{await f.close();}
});
