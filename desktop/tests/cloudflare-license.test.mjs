import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,sign,createHmac} from 'node:crypto';
import {mkdtemp} from 'node:fs/promises';import {resolve,join} from 'node:path';
import {build} from 'esbuild';import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {plans} from '../shared/plans.mjs';import {deviceIdentity,verifyEntitlement} from '../shared/entitlement.mjs';
import {supportReplacementMessage} from '../license-service/cloudflare/support-auth.mjs';
const keys=()=>{const p=generateKeyPairSync('ed25519');return {privateKey:p.privateKey.export({type:'pkcs8',format:'pem'}),publicKey:p.publicKey.export({type:'spki',format:'pem'})};};
async function bundle(entry){const result=await build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*'],logLevel:'silent'});return result.outputFiles[0].text;}
const options={modules:true,compatibilityDate:'2026-08-09',compatibilityFlags:['nodejs_compat']};
const localRuntime=options=>new Miniflare({...convertV4MiniflareOptions({...options,stripCfConnectingIp:false}),resourcePersistencePath:options.durableObjectsPersist});

test('real workerd SQLite rolls back, preserves replacement seats/history, encrypts promotions and resumes reconciliation',async()=>{
 const script=await bundle('desktop/tests/fixtures/cloudflare-ledger.mjs');
 const mf=localRuntime({...options,script,durableObjects:{PROBE:{className:'Probe',useSQLite:true},ALARM:{className:'AlarmProbe',useSQLite:true}},outboundService:()=>{throw Error('Network forbidden');}});
 try {
  const call=async path=>{const r=await mf.dispatchFetch('https://local.invalid/'+path);const b=await r.json();assert.equal(r.status,200,JSON.stringify(b));return b;};
  assert.deepEqual(await call('rollback'),{rolledBack:true,foreignKey:true});
  assert.deepEqual(await call('replacement'),{reserved:true,revoked:true,history:1});
  assert.deepEqual(await call('caps'),{limits:Array(6).fill(true)});
  assert.deepEqual(await call('promotion'),{codes:2,roundTrip:true});
  assert.deepEqual(await call('rate'),{allowed:true});assert.deepEqual(await call('rate'),{allowed:false});
  assert.deepEqual(await call('reconcile'),{cursor:'r0',olderComplete:true,laterPending:true});
  await mf.dispatchFetch('https://local.invalid/alarm',{method:'POST'});
  let alarm;const deadline=Date.now()+10000;
  do{await new Promise(r=>setTimeout(r,100));alarm=await call('alarm');}while((alarm.pending||alarm.alarm!==null)&&Date.now()<deadline);
  assert.deepEqual(alarm,{pending:false,status:'revoked',failedOnce:true,alarm:null});
 }finally{await mf.dispose();}
});

test('Worker fetch transport issues verified offline grants, persists replay/seat limits across restart and refuses public admin paths',async()=>{
 const script=await bundle('desktop/license-service/cloudflare/worker.mjs'),signing=keys(),device=keys(),operator=keys(),webhookKey=randomBytes(32);
 const dir=await mkdtemp(resolve('.artifacts/cloudflare-license-'));
 let activations=0,now=Math.floor(Date.now()/1000),redirect=false,pauseValidation=null;const released=new Set();
 const bindings={DODO_MODE:'test_mode',DODO_API_KEY:'synthetic',DODO_WEBHOOK_SECRET:'whsec_'+webhookKey.toString('base64'),DODO_CATALOG_JSON:JSON.stringify(Object.values(plans).map(p=>({plan:p.id,productId:p.id,entitlementId:'ent-'+p.id}))),CHALLENGE_HMAC_SECRET:randomBytes(32).toString('hex'),RATE_HMAC_SECRET:randomBytes(32).toString('hex'),ENTITLEMENT_ED25519_PRIVATE_KEY:signing.privateKey,ENTITLEMENT_KEY_ID:'test',SUPPORT_OPERATORS_JSON:JSON.stringify({support:{operator:'support-1',publicKey:operator.publicKey,canOverride:false}})};
 const outboundService=async request=>{
  const url=new URL(request.url);assert.equal(url.origin,'https://test.dodopayments.com');
  if(redirect)return new Response(null,{status:302,headers:{Location:'https://untrusted.invalid/steal'}});
  if(url.pathname.startsWith('/products/')){const p=plans[url.pathname.split('/').pop()];return Response.json({product_id:p.id,is_recurring:p.recurring,price:{currency:'USD',price:Math.round(Number(p.amount)*100),tax_inclusive:true,type:p.recurring?'recurring_price':'one_time_price',payment_frequency_count:1,payment_frequency_interval:p.interval==='monthly'?'Month':'Year'},entitlements:[{id:'ent-'+p.id,integration_type:'license_key',integration_config:{activations_limit:p.maxDevices,fulfillment_mode:'auto'}}]});}
  if(url.pathname==='/licenses/activate'){activations++;return Response.json({id:'instance-'+activations,license_key_id:'license',customer:{customer_id:'customer'}});}
  if(url.pathname==='/licenses/validate'){
   const valid=!released.has((await request.json()).license_key_instance_id),paused=pauseValidation;
   if(paused){pauseValidation=null;paused.enter();await paused.gate;}
   return Response.json({valid});
  }
  if(url.pathname==='/licenses/deactivate'){released.add((await request.json()).license_key_instance_id);return new Response(null,{status:204});}
  if(url.pathname==='/customers/customer/entitlement-grants')return Response.json({items:[{customer_id:'customer',integration_type:'license_key',entitlement_id:'ent-personal-lifetime',status:'Delivered',license_key:{id:'license',activations_limit:1,status:'active'}}]});
  throw Error('Unexpected network request');
 };
 const start=()=>{
  const opts=convertV4MiniflareOptions({workers:[
   {...options,name:'license',script,bindings,stripCfConnectingIp:false,durableObjects:{LICENSE_LEDGER:{className:'LicenseLedgerObject',useSQLite:true}},outboundService},
   {...options,name:'support-caller',script:'export default { async fetch(request,env){return Response.json(await env.SUPPORT.replace(await request.json()));} };',serviceBindings:{SUPPORT:{name:'license',entrypoint:'SupportOperations'}},outboundService:()=>{throw Error('Network forbidden');}}
  ]});
  return new Miniflare({...opts,resourcePersistencePath:join(dir,'state')});
 };
 let mf=start(),sequence=1;
 const post=(path,body,headers={})=>mf.dispatchFetch('https://license.invalid'+path,{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.'+(sequence++),...headers},body:JSON.stringify(body)});
 const proof=async(action,body,key=device)=>{const r=await post('/v1/challenge',{action,body,publicKey:key.publicKey});const c=await r.json();assert.equal(r.status,200,JSON.stringify(c));return {body,publicKey:key.publicKey,token:c.token,signature:sign(null,Buffer.from(`sorafiles-device-v1\n${c.challenge.id}\n${c.challenge.context}\n${c.challenge.expires}`),key.privateKey).toString('base64url')};};
 const verify=token=>verifyEntitlement(token,{keys:{test:signing.publicKey},deviceId:deviceIdentity(device.publicKey)});
 try {
  const trialProof=await proof('trial',{}),trial=await post('/v1/trial',trialProof);assert.equal(trial.status,200);const original=verify((await trial.json()).entitlement);assert.equal(original.exp-original.iat,604800);
  assert.equal((await post('/v1/trial',trialProof)).status,400);
  const activation=await post('/v1/activate',await proof('activate',{licenseKey:'synthetic-key'}));const paid=await activation.json();assert.equal(activation.status,200,JSON.stringify(paid));assert.equal(verify(paid.entitlement).exp,null);
  await mf.dispose();mf=start();
  assert.equal((await post('/v1/trial',trialProof)).status,400);
  const retry=await post('/v1/activate',await proof('activate',{licenseKey:'synthetic-key'}));assert.equal(retry.status,200);assert.equal((await retry.json()).instanceId,paid.instanceId);assert.equal(activations,1);
  const trialRetry=await post('/v1/trial',await proof('trial',{}));assert.equal(verify((await trialRetry.json()).entitlement).exp,original.exp);
  assert.equal((await post('/v1/activate',await proof('activate',{licenseKey:'synthetic-key'},keys()))).status,400);
  const replacement=keys(),replacementRequest={ticket:'CASE-1',licenseRef:'license',oldDeviceId:deviceIdentity(device.publicKey),newDeviceId:deviceIdentity(replacement.publicKey),reason:'lost'};
  const packet=(request=replacementRequest)=>{const p={kid:'support',nonce:randomBytes(32).toString('base64url'),issuedAt:now,expiresAt:now+120,request,licenseKey:'synthetic-key'};return {...p,signature:sign(null,supportReplacementMessage(p),operator.privateKey).toString('base64url')};};
  const support=async p=>{const caller=await mf.getWorker('support-caller');return (await caller.fetch('https://internal.invalid/',{method:'POST',body:JSON.stringify(p)})).json();};
  const tampered=packet();tampered.request={...tampered.request,newDeviceId:deviceIdentity(keys().publicKey)};assert.equal((await support(tampered)).ok,false);
  assert.equal((await support(packet({...replacementRequest,overrideTicket:'REVIEW-1'}))).ok,false);
  const expired=packet();expired.issuedAt=now-240;expired.expiresAt=now-120;expired.signature=sign(null,supportReplacementMessage(expired),operator.privateKey).toString('base64url');assert.equal((await support(expired)).ok,false);
  let enter,release;const started=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
  const refreshProof=await proof('refresh',{licenseKey:'synthetic-key',licenseRef:'license',instanceId:paid.instanceId});
  pauseValidation={enter,gate};const inFlightRefresh=post('/v1/refresh',refreshProof);await started;
  const approved=packet();let result;
  try{result=await support(approved);}finally{release();}
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.oldOfflineEntitlementRevoked,false);assert.equal(result.oldActivationRevoked,true);
  // The provider response was already valid before support revoked the device.
  // The final atomic ledger check still prevents a new entitlement being issued.
  assert.equal((await inFlightRefresh).status,400);
  assert.equal((await support(approved)).ok,false);assert.equal((await support(packet())).ok,true);assert.equal(released.has(paid.instanceId),true);
  assert.equal(verify(paid.entitlement).exp,null);
  assert.equal((await post('/v1/refresh',await proof('refresh',{licenseKey:'synthetic-key',licenseRef:'license',instanceId:paid.instanceId}))).status,400);
  assert.equal((await post('/v1/activate',await proof('activate',{licenseKey:'synthetic-key'}))).status,400);
  assert.equal((await post('/v1/activate',await proof('activate',{licenseKey:'synthetic-key'},keys()))).status,400);
  const replacementResponse=await post('/v1/activate',await proof('activate',{licenseKey:'synthetic-key'},replacement));assert.equal(replacementResponse.status,200);
  const replacementToken=(await replacementResponse.json()).entitlement;assert.equal(verifyEntitlement(replacementToken,{keys:{test:signing.publicKey},deviceId:deviceIdentity(replacement.publicKey)}).maxDevices,1);
  for(const path of ['/v1/deactivate','/admin/replace','/v1/activate?payment=success'])assert.equal((await post(path,{})).status,404);
  assert.equal((await post('/v1/trial',{}, {Origin:'https://evil.invalid'})).status,403);
  assert.equal((await post('/v1/challenge',{data:'x'.repeat(17000)})).status,413);
  assert.equal((await post('/v1/challenge',{action:'trial',body:{plan:'personal-lifetime'},publicKey:device.publicKey})).status,400);
  const raw=JSON.stringify({type:'entitlement_grant.revoked'}),id='synthetic-webhook',headers={'webhook-id':id,'webhook-timestamp':String(now),'webhook-signature':'v1,'+createHmac('sha256',webhookKey).update(`${id}.${now}.`).update(raw).digest('base64')};
  const receipt=await post('/webhooks/dodo',JSON.parse(raw),headers);assert.equal(receipt.status,202);assert.equal((await receipt.json()).duplicate,false);
  assert.equal((await (await post('/webhooks/dodo',JSON.parse(raw),headers)).json()).duplicate,true);
  assert.equal((await post('/webhooks/dodo',{},headers)).status,400);
  for(let n=0;n<30;n++)assert.equal((await post('/v1/challenge',{}, {'CF-Connecting-IP':'192.0.2.200','X-Forwarded-For':'198.51.100.'+n,'X-Sora-Rate-Bucket':randomBytes(32).toString('hex')})).status,400);
  assert.equal((await post('/v1/challenge',{}, {'CF-Connecting-IP':'192.0.2.200'})).status,429);
  await mf.dispose();mf=start();assert.equal((await post('/v1/challenge',{}, {'CF-Connecting-IP':'192.0.2.200'})).status,429);
  redirect=true;assert.equal((await post('/v1/challenge',{action:'trial',body:{},publicKey:device.publicKey})).status,503);
  // Valid receipts do not depend on Dodo catalog/network availability.
  assert.equal((await post('/webhooks/dodo',JSON.parse(raw),headers)).status,202);
 }finally{await mf.dispose();}
});
