import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,randomBytes} from 'node:crypto';import {createServer} from 'node:http';import {rm,readFile} from 'node:fs/promises';import {join} from 'node:path';
import {deploymentSettings,startLicenseServer} from '../license-service/server.mjs';import {localFixture} from './local-fixture.mjs';
function settings(databasePath){const pair=generateKeyPairSync('ed25519');return {config:{mode:'test_mode',listenHost:'127.0.0.1',listenPort:18788,databasePath,publicOrigin:'https://license.sorafiles.com',catalogConfig:Array.from({length:6},()=>({}))},env:{DODO_API_KEY:'synthetic',DODO_WEBHOOK_SECRET:'whsec_'+randomBytes(32).toString('base64'),ENTITLEMENT_KEY_ID:'test',ENTITLEMENT_ED25519_PRIVATE_KEY:pair.privateKey.export({type:'pkcs8',format:'pem'}),CHALLENGE_HMAC_SECRET:randomBytes(32).toString('hex'),RATE_HMAC_SECRET:randomBytes(32).toString('hex')}};}
test('deployment fails closed for incorrect origin, ephemeral storage, invalid keys and shared secrets',()=>{
 const {config,env}=settings(join(process.cwd(),'synthetic.db'));assert.equal(deploymentSettings(config,env).runtime.mode,'test_mode');
 for(const bad of [{...config,publicOrigin:'https://elsewhere.example'},{...config,databasePath:':memory:'},{...config,mode:'live'},{...config,promotionConfig:{}}])assert.throws(()=>deploymentSettings(bad,env));
 assert.throws(()=>deploymentSettings(config,{...env,ENTITLEMENT_ED25519_PRIVATE_KEY:'not-a-key'}),/signing key/);
 assert.throws(()=>deploymentSettings(config,{...env,RATE_HMAC_SECRET:env.CHALLENGE_HMAC_SECRET}),/different/);
});
test('published configuration template contains only supported settings',async()=>{
 const config=JSON.parse(await readFile(new URL('../license-service/config.example.json',import.meta.url),'utf8'));
 const fixture=settings(join(process.cwd(),'synthetic.db'));config.databasePath=fixture.config.databasePath;
 assert.equal(deploymentSettings(config,fixture.env).runtime.mode,'test_mode');
});
test('failed listener binding closes the runtime without starting reconciliation',async()=>{
 const directory=await localFixture('sf-service-bind-'),blocker=createServer();let starts=0,closes=0;
 try{
  await new Promise(resolve=>blocker.listen(0,'127.0.0.1',resolve));const fixture=settings(join(directory,'license.sqlite'));fixture.config.listenPort=blocker.address().port;
  await assert.rejects(startLicenseServer({...fixture,createRuntime:async()=>({server:createServer(),startReconciliation(){starts++;},async close(){closes++;}})}),{code:'EADDRINUSE'});
  assert.equal(starts,0);assert.equal(closes,1);
 }finally{await new Promise(resolve=>blocker.close(resolve));await rm(directory,{recursive:true,force:true});}
});
test('service listener starts reconciliation only after binding and shuts down once',async()=>{
 const directory=await localFixture('sf-service-start-');let service;
 try{
  const fixture=settings(join(directory,'db/license.sqlite'));let starts=0,closes=0;
  service=await startLicenseServer({...fixture,createRuntime:async()=>({server:createServer((_,res)=>res.end('ready')),startReconciliation(){starts++;},close(){closes++;return new Promise(resolve=>this.server.close(resolve));}})});
  assert.equal(await (await fetch('http://127.0.0.1:'+service.address.port)).text(),'ready');assert.equal(starts,1);await Promise.all([service.close(),service.close()]);assert.equal(closes,1);
 }finally{await service?.close();await rm(directory,{recursive:true,force:true});}
});
