import test from 'node:test';import assert from 'node:assert/strict';import {Worker} from 'node:worker_threads';import {once} from 'node:events';import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {LicenseStore} from '../license-service/store.mjs';
test('simultaneous independent SQLite connections enforce Personal and Team caps',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sorafiles-activation-race-'));
 try{for(const [plan,cap] of [['personal-lifetime',1],['team-lifetime',5]]){
  const file=join(dir,plan+'.db'),store=new LicenseStore(file);store.sync({ref:'license',plan,status:'active',observedAt:1800000000});store.close();
  const workers=Array.from({length:8},(_,i)=>new Worker(new URL('./activation-worker.mjs',import.meta.url),{workerData:{file,device:'device-'+i}}));
  try{await Promise.all(workers.map(w=>once(w,'message')));const results=workers.map(w=>once(w,'message'));for(const worker of workers)worker.postMessage('activate');const messages=(await Promise.all(results)).map(r=>r[0]);assert.equal(messages.filter(m=>m.activated).length,cap);assert.ok(messages.filter(m=>!m.activated).every(m=>/limit/.test(m.error)));}finally{await Promise.all(workers.map(w=>w.terminate()));}
 }}finally{await rm(dir,{recursive:true,force:true});}
});
