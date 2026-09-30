import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,symlink,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {localFixture} from './local-fixture.mjs';
import {saveOutput} from '../core/output.mjs';

test('output writer refuses a linked ancestor without publishing or modifying the original',async()=>{
 const root=await localFixture('sorafiles-output-links-'),original=join(root,'original'),alias=join(root,'alias');
 try{
  await mkdir(original);await writeFile(join(original,'a.png'),'original');
  await symlink(original,alias,process.platform==='win32'?'junction':'dir');
  await assert.rejects(saveOutput({source:join(alias,'a.png'),tool:'image-converter',extension:'jpg',bytes:new Uint8Array([1,2,3]),validate:async()=>true}),/symbolic links/);
  assert.deepEqual(await readdir(original),['a.png']);assert.equal(await readFile(join(original,'a.png'),'utf8'),'original');
 }finally{await rm(root,{recursive:true,force:true});}
});
