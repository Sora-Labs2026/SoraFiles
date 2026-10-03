import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {LicenseService} from '../license-service/service.mjs';import {LicenseStore} from '../license-service/store.mjs';import {RequestGuard} from '../license-service/request-guard.mjs';
const keys=()=>{const p=generateKeyPairSync('ed25519');return {privateKey:p.privateKey.export({format:'pem',type:'pkcs8'}),publicKey:p.publicKey.export({format:'pem',type:'spki'})};};
// Dodo's customer portal lets a buyer deactivate a license-key instance. That
// frees a seat in Dodo only; the SoraFiles ledger stays the device authority.
function setup(){
 const now=1800000000,signing=keys(),store=new LicenseStore(':memory:'),guard=new RequestGuard({secret:randomBytes(32),store,now:()=>now});
 const dodoInstances=new Map();let counter=0;
 const dodo={
  activate:async()=>{const active=[...dodoInstances.values()].filter(Boolean).length;if(active>=1)throw Object.assign(Error('limit'),{code:'providerRejected',status:422});const id='instance-'+(++counter);dodoInstances.set(id,true);return {id,license_key_id:'lic',customer:{customer_id:'customer'}};},
  deactivate:async(key,id)=>{dodoInstances.set(id,false);},
  validate:async(key,id)=>({valid:dodoInstances.get(id)===true}),
 };
 const state={ref:'lic',plan:'personal-monthly',status:'active',periodEnd:now+86400,observedAt:now};
 const service=new LicenseService({store,guard,dodo,authority:{resolve:async()=>state},signing:{privateKey:signing.privateKey,kid:'test'},now:()=>now});
 async function execute(action,body,device){const {challenge:c,token}=service.challenge({action,body,publicKey:device.publicKey});const signature=sign(null,Buffer.from(`sorafiles-device-v1\n${c.id}\n${c.context}\n${c.expires}`),device.privateKey).toString('base64url');return service.execute(action,{body,publicKey:device.publicKey,signature,token});}
 return {store,execute,portalDeactivate:id=>dodoInstances.set(id,false),dodoInstances};
}
test('deactivating the key in the Dodo portal does not free a SoraFiles seat for another device',async()=>{const s=setup(),first=keys(),second=keys();try{
 const a=await s.execute('activate',{licenseKey:'key'},first);
 s.portalDeactivate(a.instanceId);
 await assert.rejects(s.execute('activate',{licenseKey:'key'},second));
 // The second device's Dodo instance was compensated, so nothing stays activated there.
 assert.deepEqual([...s.dodoInstances.entries()].filter(([,on])=>on),[]);
}finally{s.store.close();}});
test('a device stays licensed after its Dodo instance is deactivated in the portal',async()=>{const s=setup(),first=keys();try{
 const a=await s.execute('activate',{licenseKey:'key'},first),body={licenseKey:'key',licenseRef:a.licenseRef,instanceId:a.instanceId};
 s.portalDeactivate(a.instanceId);
 const {validation}=await s.execute('validate',{...body,nonce:'n'.repeat(43)},first);
 assert.equal(JSON.parse(Buffer.from(validation.split('.')[1],'base64url')).status,'active');
 assert.ok((await s.execute('refresh',body,first)).entitlement);
 assert.ok((await s.execute('activate',{licenseKey:'key'},first)).entitlement);
 await assert.rejects(s.execute('refresh',{...body,licenseKey:'other'},first),/Activation history required/);
}finally{s.store.close();}});
