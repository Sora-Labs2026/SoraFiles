import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,unlink,rmdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {readBoundedHandle,readLocalInput} from '../core/input.mjs';
test('growing or truncated input cannot escape its allocation or be accepted',async()=>{
 const reads=[];const growing={async read(buffer,offset,length,position){reads.push({allocated:buffer.length,length,position});buffer.fill(65,offset,offset+length);return {bytesRead:length};}};
 await assert.rejects(readBoundedHandle(growing,70000),/Input changed/);
 assert.deepEqual(reads.map(r=>r.length),[65536,4464,1]);assert.ok(reads.every(r=>r.allocated<=70000));
 await assert.rejects(readBoundedHandle({async read(){return {bytesRead:0};}},20),/Input changed/);
 let called=false;await assert.rejects(readBoundedHandle({async read(){called=true;}},256*1024*1024+1),/Unsupported input size/);assert.equal(called,false);
});
test('bounded reads support partial reads and cancel before consuming the next chunk',async()=>{
 const data=new Uint8Array([1,2,3,4,5]);
 const handle={async read(buffer,offset,length,position){const part=data.subarray(position,position+Math.min(length,2));buffer.set(part,offset);return {bytesRead:part.length};}};
 assert.deepEqual(await readBoundedHandle(handle,data.length),data);
 const controller=new AbortController();let calls=0;
 await assert.rejects(readBoundedHandle({async read(){calls++;controller.abort();return {bytesRead:1};}},4,controller.signal),{name:'AbortError'});assert.equal(calls,1);
});
test('local inputs obey the remaining job budget and preserve the source',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'sorafiles-input-')),path=join(directory,'source.pdf');
 try{await writeFile(path,new Uint8Array([1,2,3,4]));await assert.rejects(readLocalInput(path,{maxBytes:3}),/Unsupported input/);assert.deepEqual(await readLocalInput(path,{maxBytes:4}),new Uint8Array([1,2,3,4]));await assert.rejects(readLocalInput(directory),/Unsupported input/);await assert.rejects(readLocalInput('relative.pdf'),/Local selected/);}
 finally{await unlink(path);await rmdir(directory);}
});
