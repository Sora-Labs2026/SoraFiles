import {open,lstat} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
const MAX_BYTES=256*1024*1024;

// The host supplies the already-open handle. Allocate only the declared length:
// a concurrently growing input must not turn readFile() into an unbounded read.
export async function readBoundedHandle(handle,size,signal){
 if(!Number.isSafeInteger(size)||size<1||size>MAX_BYTES)throw Error('Unsupported input size');
 signal?.throwIfAborted();const bytes=new Uint8Array(size);let offset=0;
 while(offset<size){
  signal?.throwIfAborted();const length=Math.min(64*1024,size-offset);
  const {bytesRead}=await handle.read(bytes,offset,length,offset);
  if(!Number.isInteger(bytesRead)||bytesRead<1||bytesRead>length)throw Error('Input changed');
  offset+=bytesRead;
 }
 signal?.throwIfAborted();
 const {bytesRead}=await handle.read(new Uint8Array(1),0,1,size);
 if(bytesRead!==0)throw Error('Input changed');
 signal?.throwIfAborted();return bytes;
}
export async function readLocalInput(path,{signal,maxBytes=MAX_BYTES}={}){
 signal?.throwIfAborted();
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>MAX_BYTES)throw Error('Input budget exhausted');
 if(typeof path!=='string'||!isAbsolute(path)||path.includes('\0')||path.startsWith('\\\\')||path.startsWith('//'))throw Error('Local selected file required');
 const before=await lstat(path);
 if(!before.isFile()||before.isSymbolicLink()||!before.size||before.size>maxBytes)throw Error('Unsupported input');
 const handle=await open(path,'r');
 try{
  const start=await handle.stat();
  if(start.ino!==before.ino||start.dev!==before.dev||start.size!==before.size||!start.isFile())throw Error('Input changed');
  const bytes=await readBoundedHandle(handle,start.size,signal),end=await handle.stat();
  if(start.size!==end.size||start.mtimeMs!==end.mtimeMs)throw Error('Input changed');
  signal?.throwIfAborted();return bytes;
 }finally{await handle.close();}
}
