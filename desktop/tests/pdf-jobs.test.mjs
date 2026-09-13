import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync} from 'node:crypto';import {writeFile,readFile,readdir,rm} from 'node:fs/promises';import {localFixture} from './local-fixture.mjs';import {join} from 'node:path';import {PDFDocument} from 'pdf-lib';import {unzipSync} from 'fflate';import {createPdfJobQueue} from '../core/pdf-jobs.mjs';import {signEntitlement,entitlementClaims} from '../license-service/signing.mjs';
import sharp from 'sharp';
const pair=generateKeyPairSync('ed25519'),privateKey=pair.privateKey.export({format:'pem',type:'pkcs8'}),publicKey=pair.publicKey.export({format:'pem',type:'spki'}),now=1800000000;
function state(){const claims=entitlementClaims({license:{ref:'license',plan:'personal-monthly',status:'active',period_end:now+86400},deviceId:'device',now});return {token:signEntitlement(claims,{privateKey,kid:'test'}),verification:{keys:{test:publicKey},deviceId:'device',now:now*1000}};}
async function wait(queue){const end=Date.now()+5000;while(queue.list().some(j=>['queued','running'].includes(j.state))){if(Date.now()>end)throw Error('Job timeout');await new Promise(r=>setTimeout(r,10));}}
test('signed license gates real PDF processing through selected IDs, output validation and no-overwrite save',async()=>{const dir=await localFixture('sorafiles-pdf-job-');try{const doc=await PDFDocument.create();for(let i=0;i<3;i++)doc.addPage();const bytes=await doc.save(),source=join(dir,'source.pdf');await writeFile(source,bytes);let license=state();const queue=createPdfJobQueue({resolveSelection:async ids=>ids.map(id=>{if(id!=='selected')throw Error('Unknown selection');return source;}),readLicenseState:async()=>license});
 await queue.add('rotate-pdf',{selectionIds:['selected'],options:{rotations:[{pageIndex:0,angle:90}]}});await wait(queue);assert.equal(queue.list()[0].state,'completed');assert.equal((await PDFDocument.load(await readFile(queue.list()[0].result.path))).getPage(0).getRotation().angle,90);assert.deepEqual(await readFile(source),Buffer.from(bytes));
 await queue.add('split-pdf',{selectionIds:['selected'],options:{mode:'each'}});await wait(queue);const archive=unzipSync(await readFile(queue.list()[1].result.path));assert.equal(Object.keys(archive).length,3);assert.ok(Object.keys(archive).every(name=>/^source-page-\d{3}\.pdf$/.test(name)));
 license={...license,token:license.token.slice(0,-4)+'abcd'};const before=await readdir(dir);await assert.rejects(queue.add('remove-pages',{selectionIds:['selected'],options:{remove:[0]}}));assert.deepEqual(await readdir(dir),before);
 }finally{await rm(dir,{recursive:true,force:true});}});
test('new PDF operations save validated outputs without overwriting inputs or losing signature warnings',async()=>{
 const dir=await localFixture('sorafiles-overlay-job-');try{
  const doc=await PDFDocument.create();doc.addPage();const original=Buffer.from(await doc.save()),pdf=join(dir,'original.pdf'),image=join(dir,'signature.png');
  const png=await sharp({create:{width:80,height:30,channels:4,background:'#123456'}}).png().toBuffer();await writeFile(pdf,original);await writeFile(image,png);
  const selected={pdf,image},queue=createPdfJobQueue({resolveSelection:async ids=>ids.map(id=>{if(!selected[id])throw Error('Unknown selection');return selected[id];}),readLicenseState:async()=>state(),onChange:()=>{throw Error('View closed');}});
  for(const [tool,ids,options] of [
   ['page-numbers',['pdf'],{}],['watermark-pdf',['pdf'],{text:'COPY'}],
   ['sign-pdf',['pdf','image'],{placements:[{pageIndex:0,x:.1,y:.1,width:.3,height:.1}]}],['jpg-to-pdf',['image'],{}]
  ]){await queue.add(tool,{selectionIds:ids,options});await wait(queue);const job=queue.list().at(-1);assert.equal(job.state,'completed',tool);assert.equal((await PDFDocument.load(await readFile(job.result.path))).getPageCount(),1);if(tool==='sign-pdf')assert.match(job.result.warnings[0],/not a certificate/);}
  assert.deepEqual(await readFile(pdf),original);assert.deepEqual(await readFile(image),png);
  const before=await readdir(dir);await queue.add('sign-pdf',{selectionIds:['pdf'],options:{placements:[]}});await wait(queue);assert.equal(queue.list().at(-1).state,'failed');assert.deepEqual(await readdir(dir),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});
