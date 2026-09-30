import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyValidationProof} from '../shared/validation-proof.mjs';
import {LicenseClient} from '../core/license-client.mjs';
const pair=generateKeyPairSync('ed25519'),keys={test:pair.publicKey.export({type:'spki',format:'pem'})};
const now=1800000000000,context={keys,deviceId:'device',licenseRef:'license',instanceId:'instance',nonce:'nonce',now};
const claim={schema:1,iss:'sorafiles-license-service',aud:'sorafiles-desktop',deviceId:'device',licenseRef:'license',instanceId:'instance',nonce:'nonce',iat:now/1000,exp:now/1000+300,status:'inactive',reason:'device-replaced'};
function token(value=claim,header={alg:'EdDSA',typ:'sf-validation+jwt',kid:'test'}){const data=[header,value].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');return data+'.'+sign(null,Buffer.from(data),pair.privateKey).toString('base64url');}
test('online denial proof binds signature, device, license, instance and fresh request',()=>{
 assert.equal(verifyValidationProof(token(),context).status,'inactive');
 for(const patch of [{deviceId:'other'},{licenseRef:'other'},{instanceId:'other'},{nonce:'replay'},{exp:now/1000},{exp:now/1000+301},{reason:'offline'},{status:'unknown'}])assert.throws(()=>verifyValidationProof(token({...claim,...patch}),context));
 assert.throws(()=>verifyValidationProof(token(claim,{alg:'EdDSA',typ:'sf-entitlement+jwt',kid:'test'}),context));
 const raw=token().split('.');raw[1]=Buffer.from(JSON.stringify({...claim,reason:'license-inactive'})).toString('base64url');assert.throws(()=>verifyValidationProof(raw.join('.'),context));
});
test('failed online reconciliation never overwrites saved offline authorization',async()=>{
 const device=generateKeyPairSync('ed25519');let writes=0;
 const saved={licenseRef:'license',instanceId:'instance',licenseKey:'synthetic',entitlement:'existing-offline-token'};
 const client=new LicenseClient({keys,readDevice:async()=>({publicKey:device.publicKey.export({type:'spki',format:'pem'}),privateKey:device.privateKey.export({type:'pkcs8',format:'pem'})}),readLicense:async()=>saved,saveLicense:async()=>writes++,fetchImpl:async()=>{throw Error('offline');}});
 await assert.rejects(client.validateOnline());assert.equal(writes,0);assert.equal(saved.entitlement,'existing-offline-token');
});
