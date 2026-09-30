import test from 'node:test';import assert from 'node:assert/strict';
import {writeFile,readFile,readdir,rm} from 'node:fs/promises';import {join} from 'node:path';
import {PDFDocument} from 'pdf-lib';import sharp from 'sharp';
import {runProcessing} from '../native-host/processing-host.mjs';
import {localFixture} from './local-fixture.mjs';
import {processingFixture} from './processing-fixture.mjs';
import {officeMetadataFixture} from './fixtures/office-metadata.mjs';
import {unzipSync,strFromU8} from 'fflate';

test('offline repair batches reconstruct readable structure, isolate failure and enforce authorization',async()=>{
 const dir=await localFixture('sf-repair-batch-');try{
  const doc=await PDFDocument.create();doc.addPage().drawText('Repair invoice 00123');
  const input=Buffer.from(Buffer.from(await doc.save({useObjectStreams:false})).toString('latin1').replace(/startxref\s+\d+/,'startxref\n1'),'latin1');
  const paths=[join(dir,'one.pdf'),join(dir,'broken.pdf'),join(dir,'two.pdf')],originals=[input,Buffer.from('%PDF-missing objects'),input];
  for(const [index,path] of paths.entries())await writeFile(path,originals[index]);
  const fixture=processingFixture(),run=()=>runProcessing({...fixture,tool:'repair-pdf',paths,options:{},saveState:async()=>{}});
  const result=await run();assert.deepEqual(result.results.map(row=>row.state),['completed','failed','completed']);
  for(const index of [0,2]){const row=result.results[index];assert.equal((await PDFDocument.load(await readFile(join(dir,row.name)))).getPageCount(),1);assert.match(row.warnings[0],/missing or truncated data/);}
  for(const [index,path] of paths.entries())assert.deepEqual(await readFile(path),originals[index]);
  assert.notEqual((await run()).results[0].name,result.results[0].name);fixture.state.license.entitlement+='bad';const before=await readdir(dir);await assert.rejects(run());assert.deepEqual(await readdir(dir),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('offline compression batches retain sources and report unchanged copies honestly',async()=>{
 const dir=await localFixture('sf-compress-batch-');try{
  const doc=await PDFDocument.create();doc.addPage().drawText('Compression invoice 00123');const input=Buffer.from(await doc.save({useObjectStreams:false}));
  const paths=[join(dir,'one.pdf'),join(dir,'two.pdf')];for(const path of paths)await writeFile(path,input);
  const fixture=processingFixture(),run=()=>runProcessing({...fixture,tool:'compress-pdf',paths,options:{},saveState:async()=>{}});
  const result=await run();assert.ok(result.results.every(row=>row.state==='completed'&&row.bytes<input.length));
  for(const row of result.results){assert.equal((await PDFDocument.load(await readFile(join(dir,row.name)))).getPageCount(),1);assert.deepEqual(await readFile(paths[row.index]),input);}
  assert.notEqual((await run()).results[0].name,result.results[0].name);fixture.state.license.entitlement+='bad';const before=await readdir(dir);await assert.rejects(run());assert.deepEqual(await readdir(dir),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('offline Word batches preserve sources, collision names and authorization',async()=>{
 const dir=await localFixture('sf-word-batch-');try{
  const {unzipSync,strFromU8}=await import('fflate'),doc=await PDFDocument.create();doc.addPage().drawText('Invoice code 00123',{x:40,y:700,size:12});
  const input=Buffer.from(await doc.save()),paths=[join(dir,'one.pdf'),join(dir,'two.pdf')];for(const path of paths)await writeFile(path,input);
  const fixture=processingFixture(),run=()=>runProcessing({...fixture,tool:'pdf-to-word',paths,options:{direction:'ltr'},saveState:async()=>{}});
  const result=await run();assert.ok(result.results.every(row=>row.state==='completed'&&row.name.endsWith('.docx')));
  for(const row of result.results){const archive=unzipSync(await readFile(join(dir,row.name)));assert.match(strFromU8(archive['word/document.xml']),/Invoice code 00123/);assert.deepEqual(await readFile(paths[row.index]),input);}
  const repeated=await run();assert.notEqual(repeated.results[0].name,result.results[0].name);
  fixture.state.license.entitlement+='bad';const before=await readdir(dir);await assert.rejects(run());assert.deepEqual(await readdir(dir),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});
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

test('a batch saves beside each source, preserves collisions, and continues after a malformed file',async()=>{
 const dir=await localFixture('sf-batch-');try{
  const {mkdir}=await import('node:fs/promises');await mkdir(join(dir,'second'));
  const input=await sharp({create:{width:80,height:40,channels:3,background:'#315b9a'}}).png().toBuffer();
  const paths=[join(dir,'photo.png'),join(dir,'bad.png'),join(dir,'second','photo.png')];
  await writeFile(paths[0],input);await writeFile(paths[1],Buffer.from('broken image'));await writeFile(paths[2],input);
  const fixture=processingFixture(),run=()=>runProcessing({...fixture,tool:'resize-image',paths,options:{width:40,format:'png'},saveState:async()=>{}});
  const result=await run();assert.equal(result.state,'batch');assert.deepEqual(result.results.map(row=>row.state),['completed','failed','completed']);
  for(const index of [0,2]){
   const {dirname}=await import('node:path');const output=join(dirname(paths[index]),result.results[index].name);
   assert.equal((await sharp(await readFile(output)).metadata()).width,40);assert.deepEqual(await readFile(paths[index]),input);
  }
  const repeated=await run();assert.notEqual(repeated.results[0].name,result.results[0].name);
  assert.equal(JSON.stringify(result).includes('synthetic-key'),false);assert.equal('path' in result.results[0],false);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('cancelling a batch keeps published output and does not start the remaining files',async()=>{
 const dir=await localFixture('sf-batch-cancel-');try{
  const doc=await PDFDocument.create();doc.addPage();const input=Buffer.from(await doc.save());
  const paths=[join(dir,'one.pdf'),join(dir,'two.pdf'),join(dir,'three.pdf')];for(const path of paths)await writeFile(path,input);
  const controller=new AbortController();
  const result=await runProcessing({...processingFixture(),tool:'rotate-pdf',paths,options:{rotations:[{pageIndex:0,angle:90}]},signal:controller.signal,saveState:async()=>{},onChange:job=>{if(job.state==='completed')controller.abort();}});
  assert.equal(result.state,'batch');assert.deepEqual(result.results.map(row=>row.state),['completed','cancelled','cancelled']);
  assert.equal((await PDFDocument.load(await readFile(join(dir,result.results[0].name)))).getPage(0).getRotation().angle,90);
  assert.equal((await readdir(dir)).length,4);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('offline metadata batches clean PDF and image properties, preserve sources and isolate unsupported files',async()=>{
 const dir=await localFixture('sf-metadata-batch-');try{
  const doc=await PDFDocument.create();doc.addPage();doc.setAuthor('Private fixture author');const pdf=Buffer.from(await doc.save());
  const image=await sharp({create:{width:30,height:20,channels:3,background:'#315b9a'}}).withMetadata().withExifMerge({IFD0:{Artist:'Private fixture artist'}}).png().toBuffer();
  const paths=[join(dir,'document.pdf'),join(dir,'photo.png'),join(dir,'unsupported.docx')],originals=[pdf,image,Buffer.from('unsupported document')];
  for(const [index,path] of paths.entries())await writeFile(path,originals[index]);
  const fixture=processingFixture(),run=()=>runProcessing({...fixture,tool:'metadata-remover',paths,options:{},saveState:async()=>{}});
  const result=await run();assert.deepEqual(result.results.map(row=>row.state),['completed','completed','failed']);
  assert.equal((await PDFDocument.load(await readFile(join(dir,result.results[0].name)),{updateMetadata:false})).getAuthor(),undefined);
  assert.equal((await sharp(await readFile(join(dir,result.results[1].name))).metadata()).exif,undefined);
  const second=await run();assert.notEqual(second.results[0].name,result.results[0].name);
  for(const [index,path] of paths.entries())assert.deepEqual(await readFile(path),originals[index]);
  const before=await readdir(dir);fixture.state.license.entitlement+='bad';await assert.rejects(run());assert.deepEqual(await readdir(dir),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('offline Office metadata batches preserve content, detect output types and keep source/collision boundaries',async()=>{
 const dir=await localFixture('sf-office-metadata-batch-');try{
  const extensions=['docx','xlsx','pptx'],fixtures=extensions.map(officeMetadataFixture);
  // A mislabeled input must produce the format detected from its container.
  const paths=extensions.map((ext,index)=>join(dir,index===2?'Presentation renamed.docx':`Private document.${ext}`));
  for(const [index,path] of paths.entries())await writeFile(path,fixtures[index].bytes);
  const fixture=processingFixture(),run=()=>runProcessing({...fixture,tool:'metadata-remover',paths,options:{},saveState:async()=>{}});
  const first=await run();assert.deepEqual(first.results.map(row=>row.state),['completed','completed','completed']);
  for(const [index,row] of first.results.entries()){
   assert.ok(row.name.endsWith('.'+extensions[index]));const archive=unzipSync(await readFile(join(dir,row.name)));
   assert.deepEqual(archive[fixtures[index].part],fixtures[index].entries[fixtures[index].part]);
   for(const name of ['core','app','custom'])assert.doesNotMatch(strFromU8(archive[`docProps/${name}.xml`]),/Private/);
   assert.deepEqual(await readFile(paths[index]),Buffer.from(fixtures[index].bytes));
  }
  const second=await run();for(let i=0;i<3;i++)assert.notEqual(second.results[i].name,first.results[i].name);
  fixture.state.license.entitlement+='bad';const before=await readdir(dir);await assert.rejects(run());assert.deepEqual(await readdir(dir),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('offline PDF table batches save separate XLSX workbooks and keep sources unchanged',async()=>{
 const dir=await localFixture('sf-excel-batch-');try{
  const XLSX=await import('xlsx'),doc=await PDFDocument.create(),page=doc.addPage();
  [['Item','Value'],['Code','00123']].forEach((row,index)=>row.forEach((text,column)=>page.drawText(text,{x:40+column*180,y:700-index*24,size:12})));
  const input=Buffer.from(await doc.save()),paths=[join(dir,'one.pdf'),join(dir,'two.pdf')];for(const path of paths)await writeFile(path,input);
  const fixture=processingFixture(),run=()=>runProcessing({...fixture,tool:'pdf-to-excel',paths,options:{},saveState:async()=>{}});
  const result=await run();assert.ok(result.results.every(row=>row.state==='completed'&&row.name.endsWith('.xlsx')));
  for(const row of result.results){const workbook=XLSX.read(await readFile(join(dir,row.name)),{type:'buffer'});assert.equal(workbook.Sheets[workbook.SheetNames[0]].B2.v,'00123');assert.deepEqual(await readFile(paths[row.index]),input);}
  const repeat=await run();assert.notEqual(repeat.results[0].name,result.results[0].name);
  fixture.state.license.entitlement+='invalid';const before=await readdir(dir);await assert.rejects(run());assert.deepEqual(await readdir(dir),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});
