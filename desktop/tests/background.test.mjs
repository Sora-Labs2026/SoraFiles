import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';
import {readFile,writeFile,readdir,rm} from 'node:fs/promises';import {existsSync} from 'node:fs';import {join} from 'node:path';
import {removeBackground} from '../core/background.mjs';import {processingFixture} from './processing-fixture.mjs';
import {runProcessing} from '../native-host/processing-host.mjs';import {localFixture} from './local-fixture.mjs';
const modelAvailable=existsSync(new URL('../../.artifacts/desktop-background-assets/isnet-quint8.onnx',import.meta.url));
async function fixture(){return sharp(Buffer.from('<svg width="640" height="400"><rect width="640" height="400" fill="#f4e7d1"/><rect x="200" y="76" width="240" height="276" rx="24" fill="#4338ca"/></svg>')).png().toBuffer();}
test('background worker rejects malformed, unsupported, oversized and cancelled input',async()=>{
 await assert.rejects(removeBackground(Buffer.from('bad')));await assert.rejects(removeBackground(await sharp(await fixture()).tiff().toBuffer()));
 await assert.rejects(removeBackground(await sharp({create:{width:4000,height:3001,channels:3,background:'#fff'}}).png().toBuffer()));
 await assert.rejects(removeBackground(await fixture(),{signal:AbortSignal.abort()}),{name:'AbortError'});
 const controller=new AbortController(),pending=removeBackground(await fixture(),{signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});
});
test('real local model preserves subject RGB and source alpha in separately licensed batch outputs',{skip:!modelAvailable},async()=>{
 const original=await fixture(),pixels=await sharp(original).ensureAlpha().raw().toBuffer();
 for(let y=0;y<400;y++)for(let x=0;x<640;x++){if(x<30)pixels[(y*640+x)*4+3]=0;else if(x>270&&x<330&&y>180&&y<240)pixels[(y*640+x)*4+3]=128;}
 const translucent=await sharp(pixels,{raw:{width:640,height:400,channels:4}}).png().toBuffer();
 const directory=await localFixture('sf-background-');try{
  const webp=await sharp(translucent).webp({lossless:true}).toBuffer();
  const paths=[join(directory,'opaque.png'),join(directory,'alpha.webp')];for(const [index,path] of paths.entries())await writeFile(path,[original,webp][index]);
  const license=processingFixture(),run=()=>runProcessing({...license,tool:'remove-background',paths,options:{},saveState:async()=>{}});
  const collision=join(directory,'opaque-no-bg.png');await writeFile(collision,'existing file');
  const result=await run();assert.deepEqual(result.results.map(row=>row.state),['completed','completed']);
  for(const [index,row] of result.results.entries()){
   const output=await readFile(join(directory,row.name)),metadata=await sharp(output).metadata();assert.equal(metadata.format,'png');assert.equal(metadata.width,640);assert.equal(metadata.height,400);assert.equal(metadata.exif,undefined);
   const actual=await sharp(output).ensureAlpha().raw().toBuffer(),before=await sharp([original,webp][index]).ensureAlpha().raw().toBuffer();
   for(let i=0;i<actual.length;i+=4){assert.equal(actual[i],before[i]);assert.equal(actual[i+1],before[i+1]);assert.equal(actual[i+2],before[i+2]);assert.ok(actual[i+3]<=before[i+3]);}
   const alpha=(x,y)=>actual[(y*640+x)*4+3];assert.ok(alpha(80,200)<20);assert.ok(alpha(250,200)>235);if(index===1){assert.equal(alpha(10,200),0);assert.ok(alpha(300,200)>100&&alpha(300,200)<=128);}
   assert.deepEqual(await readFile(paths[index]),[original,webp][index]);assert.match(row.warnings[0],/fine edges/);
  }
  assert.equal(await readFile(collision,'utf8'),'existing file');license.state.license.entitlement+='bad';const before=await readdir(directory);await assert.rejects(run());assert.deepEqual(await readdir(directory),before);
 }finally{await rm(directory,{recursive:true,force:true});}
});
