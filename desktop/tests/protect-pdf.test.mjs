import test from 'node:test';import assert from 'node:assert/strict';
import {PDFDocument,PDFName,PDFNumber} from 'pdf-lib';import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {protectPdf} from '../core/protect-pdf.mjs';import {runProcessing} from '../native-host/processing-host.mjs';
import {generateKeyPairSync} from 'node:crypto';import {deviceIdentity} from '../shared/entitlement.mjs';import {signEntitlement,entitlementClaims} from '../license-service/signing.mjs';
import {writeFile,readFile,readdir,rm} from 'node:fs/promises';import {join} from 'node:path';import {localFixture} from './local-fixture.mjs';
async function fixture(){const doc=await PDFDocument.create(),page=doc.addPage([420,600]);page.drawText('Protected invoice 4827',{x:30,y:500});const field=doc.getForm().createTextField('Customer');field.setText('Synthetic customer');field.addToPage(page,{x:30,y:400,width:220,height:25});doc.addPage([500,700]);return doc.save();}
async function inspect(bytes,password){const task=getDocument({data:Uint8Array.from(bytes),password,verbosity:0,isEvalSupported:false});try{const doc=await task.promise;return {pages:doc.numPages,text:(await (await doc.getPage(1)).getTextContent()).items.map(item=>item.str).join(' '),fields:await doc.getFieldObjects()};}finally{await task.destroy();}}
test('Protect PDF requires the correct password, uses AES-256, and preserves page text and form fields',async()=>{
 const input=await fixture(),password='Synthetic-Protection-2026!',result=await protectPdf(input,{password});
 await assert.rejects(inspect(result.bytes),{name:'PasswordException'});await assert.rejects(inspect(result.bytes,'wrong-password'),{name:'PasswordException'});
 const verified=await inspect(result.bytes,password);assert.equal(verified.pages,2);assert.match(verified.text,/invoice 4827/);assert.equal(verified.fields.Customer.find(field=>field.type==='text').value,'Synthetic customer');
 const doc=await PDFDocument.load(result.bytes,{ignoreEncryption:true,updateMetadata:false}),encryption=doc.context.lookup(doc.context.trailerInfo.Encrypt);
 assert.equal(encryption.lookup(PDFName.of('R'),PDFNumber).asNumber(),6);assert.equal(encryption.lookup(PDFName.of('Length'),PDFNumber).asNumber(),256);
 assert.equal((await PDFDocument.load(input)).isEncrypted,false);
 await assert.rejects(protectPdf(result.bytes,{password:'another-password'}),/unencrypted/);
});
test('protection rejects invalid passwords, malformed files and cancellation',async()=>{
 const input=await fixture();for(const password of ['', '   ','control\npassword','x'.repeat(128),'😀'.repeat(40)])await assert.rejects(protectPdf(input,{password}),/password/);
 await assert.rejects(protectPdf(new Uint8Array([1,2,3]),{password:'valid-password'}));
 await assert.rejects(protectPdf(input,{password:'valid-password',signal:AbortSignal.abort()}),{name:'AbortError'});
 const result=await protectPdf(input,{password:'Sora-नेपाल-2026'});assert.equal((await inspect(result.bytes,'Sora-नेपाल-2026')).pages,2);
});
test('offline protection batches save separate encrypted outputs without exposing passwords or changing sources',async()=>{
 const directory=await localFixture('sf-protect-');try{
  const input=await fixture(),paths=[join(directory,'one.pdf'),join(directory,'two.pdf')];for(const path of paths)await writeFile(path,input);
  const pair=generateKeyPairSync('ed25519'),devicePair=generateKeyPairSync('ed25519'),device={publicKey:devicePair.publicKey.export({type:'spki',format:'pem'}),privateKey:devicePair.privateKey.export({type:'pkcs8',format:'pem'})};
  const token=signEntitlement(entitlementClaims({license:{ref:'synthetic',plan:'personal-lifetime',status:'active'},deviceId:deviceIdentity(device.publicKey),now:Math.floor(Date.now()/1000)}),{kid:'test',privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'})});
  const state={schema:1,device,license:{entitlement:token}},config={origin:'https://license.sorafiles.com',keys:{test:pair.publicKey.export({type:'spki',format:'pem'})}};
  const password='Synthetic-Batch-Secret',result=await runProcessing({tool:'protect-pdf',paths,options:{password},state,config,saveState:async()=>{}});
  assert.equal(result.state,'batch');assert.ok(result.results.every(row=>row.state==='completed'));assert.equal(JSON.stringify(result).includes(password),false);assert.equal((await readdir(directory)).length,4);
  for(const row of result.results){assert.equal((await inspect(await readFile(join(directory,row.name)),password)).pages,2);assert.deepEqual(await readFile(paths[row.index]),Buffer.from(input));}
 }finally{await rm(directory,{recursive:true,force:true});}
});
