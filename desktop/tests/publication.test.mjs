import test from 'node:test';import assert from 'node:assert/strict';
import {writeFile,readFile,unlink,rmdir} from 'node:fs/promises';import {join} from 'node:path';
import {localFixture} from './local-fixture.mjs';import {publishStagedOutput} from '../core/publication.mjs';
import {JobQueue} from '../core/queue.mjs';

test('cleanup failure after a real publication preserves the saved result',async()=>{
 const directory=await localFixture('sorafiles-publish-'),stage=join(directory,'stage.tmp'),target=join(directory,'result.pdf');
 try{
  await writeFile(stage,'validated output');
  const result=await publishStagedOutput(stage,target,{removeStage:async()=>{throw Object.assign(Error('busy'),{code:'EPERM'});}});
  assert.equal(result.cleanupPending,true);assert.equal(await readFile(target,'utf8'),'validated output');
  await assert.rejects(publishStagedOutput(stage,target),{code:'EEXIST'});
  assert.equal(await readFile(target,'utf8'),'validated output');
 }finally{await unlink(stage);await unlink(target);await rmdir(directory);}
});
test('failed publication never removes the staging file or existing destination',async()=>{
 let removed=false;
 await assert.rejects(publishStagedOutput('stage','target',{linkFile:async()=>{throw Object.assign(Error('collision'),{code:'EEXIST'});},removeStage:async()=>{removed=true;}}),{code:'EEXIST'});
 assert.equal(removed,false);
});
test('an already removed staging name is successful cleanup',async()=>{
 assert.deepEqual(await publishStagedOutput('stage','target',{linkFile:async()=>{},removeStage:async()=>{throw Object.assign(Error('missing'),{code:'ENOENT'});}}),{cleanupPending:false});
});

test('post-save failures cannot replace a committed queue result with failure',async()=>{
 let complete;const finished=new Promise(resolve=>complete=resolve),saved={path:'saved.pdf',bytes:20};
 const queue=new JobQueue({authorize:async()=>{},onChange:jobs=>{if(jobs[0]?.state==='completed'||jobs[0]?.state==='failed')complete();},engines:{pdf:async(_,{commit})=>{await commit(async()=>saved);throw Error('post-save housekeeping failed');}}});
 const id=await queue.add('pdf',{});await finished;
 assert.deepEqual(queue.list()[0],{id,tool:'pdf',state:'completed',result:saved,error:undefined});assert.equal(queue.cancel(id),false);
});

test('failure before publication still fails the job and publishes no result',async()=>{
 let complete;const finished=new Promise(resolve=>complete=resolve);
 const queue=new JobQueue({authorize:async()=>{},onChange:jobs=>{if(jobs[0]?.state==='failed')complete();},engines:{pdf:async(_,{commit})=>commit(async()=>{throw Error('save rejected');})}});
 await queue.add('pdf',{});await finished;assert.equal(queue.list()[0].state,'failed');assert.equal(queue.list()[0].result,undefined);
});
