import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';
import {writeFile,readFile,readdir,rm} from 'node:fs/promises';import {join} from 'node:path';import {generateKeyPairSync} from 'node:crypto';
import {localFixture} from './local-fixture.mjs';import {createImageJobQueue} from '../core/image-jobs.mjs';import {signEntitlement,entitlementClaims} from '../license-service/signing.mjs';
test('image jobs enforce licensing and selection IDs and save collision-safe output for all four tools',async()=>{
 const dir=await localFixture('sorafiles-image-jobs-');try{
  const input=await sharp({create:{width:120,height:80,channels:4,background:'#5588ff'}}).png().toBuffer(),path=join(dir,'photo.png');await writeFile(path,input);
  const pair=generateKeyPairSync('ed25519'),publicKey=pair.publicKey.export({format:'pem',type:'spki'}),privateKey=pair.privateKey.export({format:'pem',type:'pkcs8'}),now=Math.floor(Date.now()/1000);
  let valid=true;const state={token:signEntitlement(entitlementClaims({license:{ref:'test',plan:'personal-monthly',status:'active',period_end:now+86400},deviceId:'device',now}),{privateKey,kid:'test'}),verification:{keys:{test:publicKey},deviceId:'device'}};
  const queue=createImageJobQueue({resolveSelection:async ids=>ids.map(id=>{assert.equal(id,'selected');return path;}),readLicenseState:async()=>{if(!valid)throw Error('License inactive');return state;}});
  const wait=async()=>{const end=Date.now()+10000;while(queue.list().some(j=>['running','queued'].includes(j.state))){if(Date.now()>end)throw Error('Job timeout');await new Promise(r=>setTimeout(r,10));}};
  for(const [tool,options] of [['image-converter',{format:'webp'}],['compress-image',{}],['resize-image',{width:60}],['edit-image',{rotation:90}]]){
   await queue.add(tool,{selectionIds:['selected'],options});await wait();const result=queue.list().at(-1);assert.equal(result.state,'completed');assert.notEqual(result.result.path,path);const metadata=await sharp(await readFile(result.result.path)).metadata();assert.equal(metadata.width,tool==='resize-image'?60:tool==='edit-image'?80:120);
  }
  assert.deepEqual(await readFile(path),input);valid=false;const before=await readdir(dir);await assert.rejects(queue.add('image-converter',{selectionIds:['selected']}));assert.deepEqual(await readdir(dir),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});
