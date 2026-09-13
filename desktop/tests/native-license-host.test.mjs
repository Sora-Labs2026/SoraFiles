import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {runLicenseAction} from '../native-host/license-host.mjs';import {LicenseStore} from '../license-service/store.mjs';import {RequestGuard} from '../license-service/request-guard.mjs';
import {LicenseService} from '../license-service/service.mjs';import {createLicenseHttpServer} from '../license-service/http.mjs';
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
 await assert.rejects(runLicenseAction({action:'execute',params:{command:'unsafe'}}),/Invalid/);
 await assert.rejects(runLicenseAction({action:'trial',params:{origin:'https://example.com'}}),/Invalid/);
 await assert.rejects(runLicenseAction({action:'trial',state:null,config:{keys:{}},saveState:async()=>{}}),/configuration/);
});
