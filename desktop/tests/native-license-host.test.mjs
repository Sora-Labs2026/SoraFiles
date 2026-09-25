import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {runLicenseAction} from '../native-host/license-host.mjs';import {LicenseStore} from '../license-service/store.mjs';import {RequestGuard} from '../license-service/request-guard.mjs';
import {LicenseService} from '../license-service/service.mjs';import {createLicenseHttpServer} from '../license-service/http.mjs';
test('support identity is stable without activation or network and never exposes a private key',async()=>{
 let state=null,writes=0;const run=()=>runLicenseAction({action:'support',state,config:{keys:{}},saveState:async value=>{state=value;writes++;},fetchImpl:()=>assert.fail('Support identity is local')});
 const first=await run(),second=await run();assert.deepEqual(first,second);assert.match(first.supportDeviceId,/^[A-Za-z0-9_-]{43}$/);assert.deepEqual(Object.keys(first),['supportDeviceId']);assert.equal(writes,1);assert.equal(state.license,null);
});
test('native license adapter persists the device before online trial and exposes only public status',async()=>{
 const signing=generateKeyPairSync('ed25519'),publicKey=signing.publicKey.export({type:'spki',format:'pem'}),privateKey=signing.privateKey.export({type:'pkcs8',format:'pem'});
 const store=new LicenseStore(':memory:'),guard=new RequestGuard({store,secret:randomBytes(32)}),service=new LicenseService({store,guard,signing:{privateKey,kid:'native-test'},dodo:{},authority:{}});
 const server=createLicenseHttpServer({service,webhooks:{},rateSecret:randomBytes(32)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let saved=null,writes=0,online=true;const config={origin:'http://127.0.0.1:'+server.address().port,allowLocalTesting:true,keys:{'native-test':publicKey}};
 const run=action=>runLicenseAction({action,state:saved,config,saveState:async state=>{writes++;saved=structuredClone(state);},fetchImpl:(...args)=>{assert.ok(saved.device.privateKey);if(!online)throw Error('offline');return fetch(...args);}});
 try{assert.deepEqual(await run('status'),{license:'not-activated'});assert.equal(writes,0);const trial=await run('trial');assert.equal(trial.license,'trial');assert.equal(writes,2);assert.ok(saved.license.entitlement);assert.equal(JSON.stringify(trial).includes('PRIVATE KEY'),false);assert.equal(JSON.stringify(trial).includes('entitlement'),false);online=false;assert.equal((await run('status')).license,'trial');
  let contacted=false;await assert.rejects(runLicenseAction({action:'trial',state:null,config,saveState:async()=>{throw Error('vault unavailable');},fetchImpl:()=>{contacted=true;}}),/vault/);assert.equal(contacted,false);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));store.close();}
});
test('native license adapter rejects renderer-configurable actions and unavailable signing config',async()=>{
 await assert.rejects(runLicenseAction({action:'deactivate',state:null}),/Invalid/);
 await assert.rejects(runLicenseAction({action:'execute',params:{command:'unsafe'}}),/Invalid/);
 await assert.rejects(runLicenseAction({action:'trial',params:{origin:'https://example.com'}}),/Invalid/);
 await assert.rejects(runLicenseAction({action:'trial',state:null,config:{keys:{}},saveState:async()=>{}}),/configuration/);
});
test('an unverifiable trial offers paid activation without granting access or replacing a paid binding',async()=>{
 const pair=generateKeyPairSync('ed25519'),device={publicKey:pair.publicKey.export({type:'spki',format:'pem'}),privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'})};
 const config={origin:'https://license.sorafiles.com',keys:{test:device.publicKey}};
 for(const paid of [false,true]){
  const state={schema:1,device,license:{entitlement:'expired-or-damaged',...(paid?{licenseRef:'bound',licenseKey:'saved-paid-key'}:{})}};
  const status=await runLicenseAction({action:'status',state,config,saveState:async()=>assert.fail('Unverified status must not write a new grant'),fetchImpl:()=>assert.fail('Status remains local')});
  assert.deepEqual(status,{license:'needs-verification',activationAvailable:!paid});
  assert.equal(JSON.stringify(status).includes('saved-paid-key'),false);
 }
});

test('automatic trial saves its installation deadline offline and retries without resetting it',async()=>{
 const signing=generateKeyPairSync('ed25519'),publicKey=signing.publicKey.export({type:'spki',format:'pem'}),privateKey=signing.privateKey.export({type:'pkcs8',format:'pem'});
 let now=1800000000000,saved=null,online=false,writes=0,requests=0;
 const store=new LicenseStore(':memory:'),guard=new RequestGuard({store,secret:randomBytes(32),now:()=>Math.floor(now/1000)});
 const service=new LicenseService({store,guard,signing:{privateKey,kid:'test'},dodo:{},authority:{},now:()=>Math.floor(now/1000)});
 const server=createLicenseHttpServer({service,webhooks:{},rateSecret:randomBytes(32)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const config={origin:'http://127.0.0.1:'+server.address().port,allowLocalTesting:true,keys:{test:publicKey}};
 const run=action=>runLicenseAction({action,state:saved,config,now:()=>now,saveState:async value=>{saved=structuredClone(value);writes++;},fetchImpl:(...args)=>{requests++;assert.equal(saved.installedAt,1800000000);if(!online)throw Error('offline');return fetch(...args);}});
 try{
  await run('prepareTrial');assert.equal(requests,0);assert.equal(writes,1);const device=structuredClone(saved.device);
  assert.equal((await run('initializeTrial')).trialPending,true);assert.equal(saved.license,null);
  now+=2*86400000;online=true;const trial=await run('initializeTrial');assert.equal(trial.license,'trial');assert.equal(trial.expiresAt,1800000000+7*86400);assert.deepEqual(saved.device,device);
  const snapshot=structuredClone(saved),before=requests,beforeWrites=writes;
  assert.equal((await run('initializeTrial')).license,'trial');assert.deepEqual(saved,snapshot);assert.equal(requests,before);assert.equal(writes,beforeWrites);
  now+=6*86400000;assert.equal((await run('initializeTrial')).license,'needs-verification');assert.deepEqual(saved,snapshot);assert.equal(requests,before);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));store.close();}
});

test('automatic initialization preserves paid state and never networks before protected storage succeeds',async()=>{
 const pair=generateKeyPairSync('ed25519'),device={publicKey:pair.publicKey.export({type:'spki',format:'pem'}),privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'})};
 const state={schema:1,device,license:{licenseKey:'paid',licenseRef:'binding',entitlement:'unverifiable'}};
 const options={config:{keys:{test:device.publicKey}},saveState:async()=>assert.fail('Existing paid state must not change'),fetchImpl:()=>assert.fail('No network for paid state')};
 assert.deepEqual(await runLicenseAction({...options,action:'initializeTrial',state}),{license:'needs-verification',activationAvailable:false});
 await assert.rejects(runLicenseAction({...options,action:'initializeTrial',state:null,saveState:async()=>{throw Error('vault unavailable');}}),/vault/);
 const expired={schema:1,device,license:null,installedAt:1800000000};
 assert.deepEqual(await runLicenseAction({...options,action:'initializeTrial',state:expired,now:()=>1800000000000+8*86400000}),{license:'needs-verification',activationAvailable:true,trialPending:false,expiresAt:1800000000+7*86400});
});
