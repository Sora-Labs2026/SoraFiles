import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,rm} from 'node:fs/promises';import {join} from 'node:path';import {createHash} from 'node:crypto';
import sharp from 'sharp';import {heicToJpg} from '../core/heic.mjs';import {localFixture} from './local-fixture.mjs';
import {processingFixture} from './processing-fixture.mjs';import {runProcessing} from '../native-host/processing-host.mjs';
import decoderFactory from '../shared/heif-decoder.cjs';
const fixture=process.env.SORA_HEIC_TEST_FIXTURE;
test('HEIC conversion rejects wrong formats, malformed boxes, sequences and cancellation',async()=>{
 await assert.rejects(heicToJpg(Buffer.from('not a heic')));await assert.rejects(heicToJpg(Buffer.alloc(20)));
 const box=Buffer.alloc(20);box.writeUInt32BE(20);box.write('ftyp',4);box.write('msf1',8);box.write('heic',16);await assert.rejects(heicToJpg(box));
 const malformed=Buffer.from(box);malformed.write('heic',8);malformed.writeUInt32BE(4096);await assert.rejects(heicToJpg(malformed));
 await assert.rejects(heicToJpg(box,{quality:0}));await assert.rejects(heicToJpg(box,{signal:AbortSignal.abort()}),{name:'AbortError'});
 const controller=new AbortController(),pending=heicToJpg(box,{signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});
});
test('upstream HEIC primary photo preserves dimensions and decoded colour in offline batches',{skip:!fixture},async()=>{
 const input=await readFile(fixture);assert.equal(createHash('sha256').update(input).digest('hex'),'7f8b363e4936c0666a25f64f3a92fda10bd8e5453be4592530b65a55dd98f3f2');
 const result=await heicToJpg(input),{data,info}=await sharp(result.bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,1280);assert.equal(info.height,854);assert.match(result.warnings[0],/1 additional/);
 const metadata=await sharp(result.bytes).metadata();assert.equal(metadata.format,'jpeg');assert.equal(metadata.exif,undefined);assert.equal(metadata.icc,undefined);
 // Decode the original separately, then independently decode JPEG through sharp.
 const lib=decoderFactory({print:()=>{},printErr:()=>{}}),decoder=new lib.HeifDecoder(),images=decoder.decode(input),primary=images.find(image=>image.is_primary());
 try{
  const raw={width:1280,height:854,data:new Uint8ClampedArray(1280*854*4)};await new Promise((resolve,reject)=>primary.display(raw,pixels=>pixels?resolve():reject(Error('Original decode failed'))));
  let absolute=0,squared=0;for(let pixel=0;pixel<info.width*info.height;pixel++)for(let channel=0;channel<3;channel++){const delta=data[pixel*3+channel]-raw.data[pixel*4+channel];absolute+=Math.abs(delta);squared+=delta*delta;}
  const samples=info.width*info.height*3;assert.ok(absolute/samples<8);assert.ok(10*Math.log10(255*255/(squared/samples))>28);
 }finally{for(const image of images)image.free();lib.heif_context_free(decoder.decoder);}
 const dir=await localFixture('sf-heic-batch-');try{
  const paths=[join(dir,'one.heic'),join(dir,'two.heic')];for(const path of paths)await writeFile(path,input);
  const fixture=processingFixture(),run=()=>runProcessing({...fixture,tool:'heic-to-jpg',paths,options:{quality:90},saveState:async()=>{}});
  const result=await run();assert.ok(result.results.every(row=>row.state==='completed'&&row.name.endsWith('.jpg')));
  for(const row of result.results){assert.equal((await sharp(await readFile(join(dir,row.name))).metadata()).width,1280);assert.deepEqual(await readFile(paths[row.index]),input);}
  assert.notEqual((await run()).results[0].name,result.results[0].name);fixture.state.license.entitlement+='bad';const before=await readdir(dir);await assert.rejects(run());assert.deepEqual(await readdir(dir),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});
