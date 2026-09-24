import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,generateKeyPairSync} from 'node:crypto';
import {LicenseStore} from '../license-service/store.mjs';
import {RequestGuard} from '../license-service/request-guard.mjs';
import {ReplacementEmailService,maskPurchaserEmail} from '../license-service/replacement-email.mjs';
import {createReplacementMailer} from '../license-service/replacement-mailer.mjs';
import {LicenseService} from '../license-service/service.mjs';
import {LicenseClient} from '../core/license-client.mjs';
import {createLicenseHttpServer} from '../license-service/http.mjs';
const id=n=>Buffer.alloc(32,n).toString('base64url');
function fixture(){
 const store=new LicenseStore(':memory:');let now=1800000000;const guard=new RequestGuard({store,secret:randomBytes(32),now:()=>now});
 const state={ref:'license',plan:'personal-lifetime',status:'active',periodEnd:null,observedAt:now};store.sync(state);store.bind('license','customer');store.activate('license',id(1),'old',now);
 const keyHash=guard.activationFingerprint('synthetic-key');store.db.prepare("INSERT INTO activation_attempts VALUES(?,?,'complete','license','old','customer',?)").run(keyHash,id(1),now);
 const mail=[],dodo={validate:async()=>({valid:true}),customer:async customerId=>({customer_id:customerId,email:'purchaser@example.com'})};
 const authority={resolve:async()=>({...state,observedAt:now})};
 const args={store,guard,dodo,authority,now:()=>now,sendCode:async value=>{mail.push(value);}};
 return {store,guard,state,args,mail,dodo,email:new ReplacementEmailService(args),advance:n=>now+=n,now:()=>now,keyHash};
}
test('purchaser email comes from verified authority; code is one-use and only hashes enter the ledger',async()=>{
 const f=fixture();try{
  const first=await f.email.start({licenseKey:'synthetic-key'},id(2));assert.equal(first.maskedEmail,'p***@example.com');assert.equal(f.mail[0].to,'purchaser@example.com');
  assert.equal(first.expiresAt,f.now()+600);assert.match(f.mail[0].code,/^\d{8}$/);
  const initial=JSON.stringify(f.store.db.prepare('SELECT * FROM replacement_email').all());
  for(const text of ['purchaser@example.com',f.mail[0].code,'synthetic-key'])assert.ok(!initial.includes(text));
  assert.throws(()=>f.email.verify({verificationId:first.verificationId,code:f.mail[0].code},id(3)));
  const verified=f.email.verify({verificationId:first.verificationId,code:f.mail[0].code},id(2));
  assert.equal(verified.licenseRef,'license');assert.equal(verified.devices[0].id,id(1));
  assert.throws(()=>f.email.verify({verificationId:first.verificationId,code:f.mail[0].code},id(2)));
  assert.ok(!JSON.stringify(f.store.db.prepare('SELECT * FROM replacement_email').all()).includes(verified.identityToken));
  const scope={licenseRef:'license',deviceId:id(2),oldDeviceId:id(1),keyHash:f.keyHash};
  assert.deepEqual(f.email.identity(verified.identityToken,scope),{verified:true,customerId:'customer'});
  assert.deepEqual(f.email.identity(verified.identityToken,scope),{verified:true,customerId:'customer'});
  for(const change of [{deviceId:id(3)},{oldDeviceId:id(4)},{licenseRef:'other'},{keyHash:'wrong'}])assert.throws(()=>f.email.identity(verified.identityToken,{...scope,...change}));
  f.advance(1800);assert.throws(()=>f.email.identity(verified.identityToken,scope));
 }finally{f.store.close();}
});
test('resends invalidate prior code and have durable per-license limits across devices and service restart',async()=>{
 const f=fixture();try{
  const first=await f.email.start({licenseKey:'synthetic-key'},id(2));await assert.rejects(f.email.start({licenseKey:'synthetic-key'},id(3)),{httpStatus:429});
  f.advance(60);const second=await f.email.start({licenseKey:'synthetic-key'},id(2));
  assert.throws(()=>f.email.verify({verificationId:first.verificationId,code:f.mail[0].code},id(2)));
  const resumed=new ReplacementEmailService(f.args);f.advance(60);await resumed.start({licenseKey:'synthetic-key'},id(4));f.advance(60);
  await assert.rejects(resumed.start({licenseKey:'synthetic-key'},id(5)),{httpStatus:429});
  assert.equal(f.mail.length,3);assert.ok(second.verificationId!==first.verificationId);
 }finally{f.store.close();}
});
test('five bad attempts persist, expired codes fail, and provider failure never sends or grants',async()=>{
 for(const mode of ['attempts','expired','customer','inactive','invalid','delivery']){
  const f=fixture();try{
   if(mode==='customer')f.dodo.customer=async()=>({customer_id:'different',email:'attacker@example.com'});
   if(mode==='inactive')f.state.status='revoked';
   if(mode==='invalid')f.dodo.validate=async()=>({valid:false});
   if(mode==='delivery')f.email.sendCode=async()=>{throw Error('unavailable');};
   if(['customer','inactive','invalid','delivery'].includes(mode)){await assert.rejects(f.email.start({licenseKey:'synthetic-key'},id(2)));assert.equal(f.mail.length,0);continue;}
   const start=await f.email.start({licenseKey:'synthetic-key'},id(2));
   if(mode==='expired')f.advance(600);
   else for(let i=0;i<5;i++)assert.throws(()=>f.email.verify({verificationId:start.verificationId,code:'incorrect'},id(2)));
   assert.throws(()=>new ReplacementEmailService(f.args).verify({verificationId:start.verificationId,code:f.mail[0].code},id(2)));
  }finally{f.store.close();}
 }
});
test('overlapping email requests send once and verification routes use real HTTP device proof',async()=>{
 const f=fixture();let server;try{
  const results=await Promise.allSettled([f.email.start({licenseKey:'synthetic-key'},id(2)),f.email.start({licenseKey:'synthetic-key'},id(2))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.mail.length,1);
  f.advance(3600);const pair=generateKeyPairSync('ed25519'),device={publicKey:pair.publicKey.export({format:'pem',type:'spki'}),privateKey:pair.privateKey.export({format:'pem',type:'pkcs8'})};
  const service=new LicenseService({...f.args,replacementEmail:f.email,signing:{privateKey:device.privateKey,kid:'test'}});
  server=createLicenseHttpServer({service,webhooks:{},rateSecret:randomBytes(32)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const client=new LicenseClient({origin:`http://127.0.0.1:${server.address().port}`,allowLocalTesting:true,keys:{test:device.publicKey},readDevice:async()=>device,readLicense:async()=>null,saveLicense:async()=>{throw Error('Email cannot activate a license');},now:()=>f.now()*1000});
  const start=await client.request('replacementEmailStart',{licenseKey:'synthetic-key'},device);
  const proof=await client.request('replacementEmailVerify',{verificationId:start.verificationId,code:f.mail.at(-1).code},device);assert.equal(proof.licenseRef,'license');
  await assert.rejects(client.request('replacementEmailStart',{licenseKey:'synthetic-key',email:'attacker@example.com'},device));
 }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}f.store.close();}
});
test('email adapter limits destination/body, fixed origin and suppresses provider responses',async()=>{
 const calls=[],send=createReplacementMailer({apiKey:'synthetic-secret',from:'SoraFiles <verify@example.com>',request:async(url,options)=>{calls.push({url,options});return new Response('{"id":"private"}');}});
 const packet={to:'purchaser@example.com',code:'12345678',expiresAt:1800000600,requestId:id(9)};
 assert.equal(await send(packet),undefined);assert.equal(calls[0].url,'https://api.resend.com/emails');assert.equal(calls[0].options.redirect,'manual');assert.deepEqual(JSON.parse(calls[0].options.body).to,[packet.to]);
 await assert.rejects(send({...packet,to:'bad\r\nBcc: attacker@example.com'}));assert.equal(calls.length,1);
 assert.throws(()=>maskPurchaserEmail('bad\r\n@example.com'));
});
