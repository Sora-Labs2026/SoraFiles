import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';import {writeFile,readFile,readdir,rm} from 'node:fs/promises';import {join} from 'node:path';
import {PDFDocument} from 'pdf-lib';import sharp from 'sharp';
import {runProcessing} from '../native-host/processing-host.mjs';import {deviceIdentity} from '../shared/entitlement.mjs';
import {signEntitlement,entitlementClaims} from '../license-service/signing.mjs';import {localFixture} from './local-fixture.mjs';
export function processingFixture(){
 const pair=generateKeyPairSync('ed25519'),devicePair=generateKeyPairSync('ed25519');
 const device={publicKey:devicePair.publicKey.export({type:'spki',format:'pem'}),privateKey:devicePair.privateKey.export({type:'pkcs8',format:'pem'})};
 const now=Math.floor(Date.now()/1000),claims=entitlementClaims({license:{ref:'synthetic',plan:'personal-lifetime',status:'active'},deviceId:deviceIdentity(device.publicKey),now});
 const token=signEntitlement(claims,{privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'}),kid:'test'});
 return {state:{schema:1,device,license:{licenseRef:'synthetic',licenseKey:'synthetic-key',entitlement:token,lastTrustedTime:Date.now()}},config:{origin:'https://license.sorafiles.com',keys:{test:pair.publicKey.export({type:'spki',format:'pem'})}}};
}
test('native processing adapter verifies offline access, writes real PDF results, and preserves originals and collisions',async()=>{
 const dir=await localFixture('sf-processing-');try{
  const doc=await PDFDocument.create();doc.addPage();doc.addPage();const bytes=Buffer.from(await doc.save()),path=join(dir,'source.pdf');await writeFile(path,bytes);
  let {state,config}=processingFixture(),writes=0;
  const run=()=>runProcessing({tool:'rotate-pdf',paths:[path],options:{rotations:[{pageIndex:0,angle:90}]},state,config,saveState:async value=>{state=value;writes++;},onChange:()=>{throw Error('View closed');}});
  const result=await run();assert.equal(result.state,'completed');assert.equal((await PDFDocument.load(await readFile(result.path))).getPage(0).getRotation().angle,90);
  const second=await run();assert.notEqual(second.path,result.path);assert.deepEqual(await readFile(path),bytes);assert.equal(writes,2);
  const before=await readdir(dir);state.license.entitlement+='bad';await assert.rejects(run(),/license/);assert.deepEqual(await readdir(dir),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('processing rejects cancelled work and unavailable actions without publishing files',async()=>{
 const fixture=processingFixture(),saveState=async()=>assert.fail('Should not save'),signal=AbortSignal.abort();
 await assert.rejects(runProcessing({...fixture,saveState,tool:'run-command',paths:['/tmp/file'],options:{}}),/Invalid/);
 await assert.rejects(runProcessing({...fixture,saveState,signal,tool:'merge-pdf',paths:['/tmp/file'],options:{}}),{name:'AbortError'});
});
test('image processing runs through the native adapter with decoded dimensions and no overwrite',async()=>{
 const dir=await localFixture('sf-processing-image-');try{
  const source=join(dir,'photo.png'),input=await sharp({create:{width:100,height:60,channels:3,background:'#315b9a'}}).png().toBuffer();await writeFile(source,input);
  const fixture=processingFixture();const result=await runProcessing({...fixture,tool:'resize-image',paths:[source],options:{width:50,format:'png'},saveState:async()=>{}});
  assert.equal(result.state,'completed');assert.equal((await sharp(await readFile(result.path)).metadata()).width,50);assert.deepEqual(await readFile(source),input);
 }finally{await rm(dir,{recursive:true,force:true});}
});
