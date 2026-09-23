import test from 'node:test';import assert from 'node:assert/strict';import {Worker} from 'node:worker_threads';import {once} from 'node:events';import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {LicenseStore} from '../license-service/store.mjs';
test('simultaneous independent SQLite connections enforce Personal and Team caps',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sorafiles-activation-race-'));
 try{for(const [plan,cap] of [['personal-lifetime',1],['team-lifetime',5]]){
  const file=join(dir,plan+'.db'),store=new LicenseStore(file);store.sync({ref:'license',plan,status:'active',observedAt:1800000000});store.close();
  const workers=Array.from({length:8},(_,i)=>new Worker(new URL('./activation-worker.mjs',import.meta.url),{workerData:{file,device:'device-'+i}}));
  try{await Promise.all(workers.map(w=>once(w,'message')));const results=workers.map(w=>once(w,'message'));for(const worker of workers)worker.postMessage('activate');const messages=(await Promise.all(results)).map(r=>r[0]);assert.equal(messages.filter(m=>m.activated).length,cap);assert.ok(messages.filter(m=>!m.activated).every(m=>/limit/.test(m.error)));}finally{await Promise.all(workers.map(w=>w.terminate()));}
 }}finally{await rm(dir,{recursive:true,force:true});}
});

test('a second database connection cannot revoke between the final device check and synchronous signing',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sf-signing-race-')),file=join(dir,'licenses.db'),shared=new SharedArrayBuffer(8),flags=new Int32Array(shared);
 const store=new LicenseStore(file);let worker;
 try{
  store.sync({ref:'license',plan:'personal-lifetime',status:'active',observedAt:1800000000});store.activate('license','device','instance',1800000000);
  worker=new Worker(new URL('./signing-race-worker.mjs',import.meta.url),{workerData:{file,shared}});await once(worker,'message');
  const completed=once(worker,'message');
  const result=store.issueForDevice('license','device','instance',1800000000,license=>{
   worker.postMessage('revoke');Atomics.wait(flags,0,0,2000);assert.equal(Atomics.load(flags,0),1);
   Atomics.wait(flags,1,0,80);assert.equal(Atomics.load(flags,1),0);
   assert.equal(license.status,'active');return 'synthetic-signed-result';
  });
  assert.equal(result,'synthetic-signed-result');assert.deepEqual(await completed,['revoked']);
  assert.throws(()=>store.issueForDevice('license','device','instance',1800000001,()=>assert.fail('Must not sign revoked device')),/not activated/);
 }finally{await worker?.terminate();store.close();await rm(dir,{recursive:true,force:true});}
});
