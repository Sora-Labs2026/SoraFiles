import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,realpath,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inventoryResources,compareResources,findResourceTree,readRuntimeManifest} from '../scripts/unix-payload-core.mjs';

async function fixture(work){
 const directory=await mkdtemp(join(await realpath(tmpdir()),'sf-unix-payload-test-'));
 const owned=await realpath(directory);
 try{await work(directory);}finally{
  if(await realpath(directory)!==owned)throw Error('Fixture cleanup location changed');
  await rm(owned,{recursive:true,force:true});
 }
}

test('packaged inventory detects altered bytes, extra files and missing execute permission',async()=>fixture(async directory=>{
 const source=join(directory,'source'),pack=join(directory,'pack');
 for(const path of [source,pack]){await mkdir(path);await writeFile(join(path,'node'),'synthetic runtime');await writeFile(join(path,'config.json'),'{}');}
 const expected=await inventoryResources(source),actual=await inventoryResources(pack);
 const executable=inventory=>({...inventory,entries:inventory.entries.map(entry=>({...entry,executable:entry.path==='node'}))});
 assert.doesNotThrow(()=>compareResources(expected,executable(actual)));
 assert.throws(()=>compareResources(expected,{...actual,entries:actual.entries.map(entry=>({...entry,executable:false}))}),/not executable/);
 await writeFile(join(pack,'node'),'synthetic runtimE');
 const changed=await inventoryResources(pack);
 assert.throws(()=>compareResources(expected,executable(changed)),/resource differs: node/);
 await writeFile(join(pack,'extra'),'unexpected');
 const extra=await inventoryResources(pack);
 assert.throws(()=>compareResources(expected,executable(extra)),/count differs/);
}));

test('package discovery refuses duplicate resource trees and resource links',async()=>fixture(async directory=>{
 await assert.rejects(findResourceTree(directory),/exactly one/);
 const first=join(directory,'usr/lib/app/license-host');await mkdir(first,{recursive:true});
 await writeFile(join(first,'node'),'synthetic');
 assert.equal(await findResourceTree(directory),first);
 const other=join(directory,'opt/license-host');await mkdir(other,{recursive:true});
 await assert.rejects(findResourceTree(directory),/exactly one/);
 const alias=join(first,'linked');await symlink(other,alias,process.platform==='win32'?'junction':'dir');
 await assert.rejects(inventoryResources(first),/links/);
}));

test('packaged runtime manifest must match the native target',async()=>fixture(async directory=>{
 const identity={platform:'linux',arch:'x64'},path=join(directory,'runtime.json');
 await writeFile(path,JSON.stringify({...identity,node:'v24.19.0'}));
 assert.equal((await readRuntimeManifest(directory,identity)).node,'v24.19.0');
 await assert.rejects(readRuntimeManifest(directory,{platform:'darwin',arch:'arm64'}),/target/);
 await writeFile(path,JSON.stringify({...identity,node:'not-a-version'}));
 await assert.rejects(readRuntimeManifest(directory,identity),/target/);
}));
