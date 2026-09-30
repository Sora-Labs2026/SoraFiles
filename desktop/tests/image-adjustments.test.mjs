import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';import {readFile,writeFile,rm,readdir} from 'node:fs/promises';import {join} from 'node:path';
import {processImage} from '../core/images.mjs';import {processingFixture} from './processing-fixture.mjs';import {runProcessing} from '../native-host/processing-host.mjs';import {localFixture} from './local-fixture.mjs';
test('adjustments reject unknown, nonnumeric, out-of-range and wrong-tool controls',async()=>{
 const input=await sharp({create:{width:8,height:6,channels:4,background:'#456789'}}).png().toBuffer();
 for(const adjustments of [{brightness:101},{sharpness:-1},{brightness:'10'},{exposure:Infinity},{unknown:10},[],null])await assert.rejects(processImage(input,{action:'edit',adjustments}));
 await assert.rejects(processImage(input,{action:'convert',adjustments:{brightness:10}}));
});
test('licensed image edits preserve source/alpha and make a separate brighter PNG',async()=>{
 const input=await sharp({create:{width:30,height:20,channels:4,background:{r:50,g:80,b:120,alpha:.5}}}).png().toBuffer(),directory=await localFixture('sf-adjustments-');
 try{
  const source=join(directory,'Colour नेपाली.png');await writeFile(source,input);const license=processingFixture();
  const run=()=>runProcessing({...license,tool:'edit-image',paths:[source],options:{format:'png',adjustments:{brightness:50}},saveState:async()=>{}});
  const result=await run(),decoded=await sharp(await readFile(result.path)).ensureAlpha().raw().toBuffer();
  assert.deepEqual([...decoded.subarray(0,4)],[82,112,152,128]);assert.deepEqual(await readFile(source),input);assert.notEqual((await run()).path,result.path);
  license.state.license.entitlement+='bad';const before=await readdir(directory);await assert.rejects(run());assert.deepEqual(await readdir(directory),before);
 }finally{await rm(directory,{recursive:true,force:true});}
});
