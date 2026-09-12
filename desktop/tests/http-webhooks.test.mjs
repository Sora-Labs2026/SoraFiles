import test from 'node:test';import assert from 'node:assert/strict';import {randomBytes,createHmac} from 'node:crypto';import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {once} from 'node:events';
import {createLicenseHttpServer} from '../license-service/http.mjs';import {WebhookInbox} from '../license-service/webhooks.mjs';import {LicenseStore} from '../license-service/store.mjs';import {RateLimiter} from '../license-service/request-guard.mjs';
const now=1800000000,secret=randomBytes(32),raw=Buffer.from('{"type":"subscription.cancelled","data":{"customer":{"email":"not-persisted@example.invalid"}}}');
function headers(id='event-1'){return {'Content-Type':'application/json','webhook-id':id,'webhook-timestamp':String(now),'webhook-signature':'v1,'+createHmac('sha256',secret).update(`${id}.${now}.`).update(raw).digest('base64')};}
test('verified webhook receipt survives restart and failed reconciliation retries without retaining payload',async()=>{const dir=await mkdtemp(join(tmpdir(),'sorafiles-inbox-')),file=join(dir,'service.db');let store=new LicenseStore(file);try{
 store.sync({ref:'lic',plan:'personal-monthly',status:'active',periodEnd:now+86400,observedAt:now-1});store.bind('lic','customer');
 let inbox=new WebhookInbox({store,authority:{resolve:async()=>{throw Error('Dodo offline');}},secret:secret.toString('base64'),now:()=>now});
 assert.equal(inbox.accept(raw,headers()).duplicate,false);assert.equal(inbox.accept(raw,headers()).duplicate,true);await assert.rejects(inbox.reconcile(),/offline/);assert.ok(store.pendingWebhookBoundary());
 assert.deepEqual(Object.keys(store.db.prepare('SELECT * FROM webhook_inbox').get()).sort(),['completed','id','received','sequence']);
 store.close();store=new LicenseStore(file);inbox=new WebhookInbox({store,authority:{resolve:async()=>({ref:'lic',plan:'personal-monthly',status:'revoked',periodEnd:now+86400,observedAt:now})},secret:secret.toString('base64'),now:()=>now});
 assert.equal((await inbox.reconcile()).updated,1);assert.equal(store.pendingWebhookBoundary(),null);assert.throws(()=>store.activate('lic','device','instance',now),/inactive/);assert.equal(inbox.accept(raw,headers()).duplicate,true);
 assert.throws(()=>inbox.accept(Buffer.from('{}'),headers()),/signature/);
 }finally{store.close();await rm(dir,{recursive:true,force:true});}});
test('real HTTP boundary rejects origin, extra fields, oversized requests and invalid webhook; responses never echo secrets',async()=>{
 const store=new LicenseStore(':memory:'),inbox=new WebhookInbox({store,authority:{},secret:secret.toString('base64'),now:()=>now});let calls=0;
 const server=createLicenseHttpServer({service:{challenge:()=>{calls++;return {challenge:'synthetic'};},execute:async()=>{throw Error('private-key-that-must-not-leak');}},webhooks:inbox,rateSecret:randomBytes(32)});
 server.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+server.address().port;
 const post=(path,body,extra={})=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
 try{
  assert.equal((await fetch(url+'/health')).status,200);
  assert.equal((await post('/v1/challenge',{action:'activate',body:{licenseKey:'key'},publicKey:'key'},{Origin:'https://evil.invalid'})).status,403);
  assert.equal((await post('/v1/challenge',{action:'activate',body:{licenseKey:'key'},publicKey:'key',filename:'private.pdf'})).status,400);assert.equal(calls,0);
  assert.equal((await post('/v1/challenge',{action:'activate',body:{licenseKey:'key'},publicKey:'key'})).status,200);assert.equal(calls,1);
  assert.equal((await post('/v1/activate',{body:{},publicKey:'key',signature:'sig',token:'token'})).status,400);
  const failure=await post('/v1/activate',{body:{},publicKey:'key',signature:'sig',token:'token'});assert.ok(!(await failure.text()).includes('private-key'));
  assert.equal((await post('/v1/challenge',{a:'x'.repeat(17000)})).status,413);
  assert.equal((await post('/webhooks/dodo',{})).status,400);
  const response=await fetch(url+'/webhooks/dodo',{method:'POST',headers:headers(),body:raw});assert.equal(response.status,202);assert.ok(store.pendingWebhookBoundary());
  assert.equal((await post('/v1/activate?payment=success',{})).status,404);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));store.close();}
});
test('forged forwarded IPs cannot bypass HTTP request throttling',async()=>{
 const server=createLicenseHttpServer({service:{challenge:()=>({})},webhooks:{},rateSecret:randomBytes(32),limiter:new RateLimiter({limit:1})});server.listen(0,'127.0.0.1');await once(server,'listening');
 try{const url='http://127.0.0.1:'+server.address().port+'/v1/challenge',body=JSON.stringify({action:'activate',body:{licenseKey:'key'},publicKey:'key'});
  assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'1.1.1.1'},body})).status,200);
  assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'2.2.2.2'},body})).status,429);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
