import {runLicenseAction} from './license-host.mjs';
import {readFile,stat} from 'node:fs/promises';
// Framed, bounded private pipe. No secrets in arguments, environment or log files.
let buffer=Buffer.alloc(0),waiting=null,queued=[];
process.stdin.on('data',chunk=>{
 buffer=Buffer.concat([buffer,chunk]);if(buffer.length>65536)process.exit(2);
 let at;while((at=buffer.indexOf(10))>=0){const line=buffer.subarray(0,at);buffer=buffer.subarray(at+1);let value;try{value=JSON.parse(line);}catch{process.exit(2);}
  if(waiting){const resolve=waiting;waiting=null;resolve(value);}else{queued.push(value);if(queued.length>1)process.exit(2);}
 }
});
process.stdin.on('end',()=>process.exit(2));
const next=()=>queued.length?Promise.resolve(queued.shift()):new Promise(resolve=>{waiting=resolve;});
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
try {
 const initial=await next();if(initial?.type!=='request')throw Error('Invalid host request');
 if(initial.action==='nativeActions'){
  let tools=[];
  try{
   const path=new URL('../../processing-pack.json',import.meta.url);
   if((await stat(path)).size>65536)throw Error('Invalid pack');
   const pack=JSON.parse(await readFile(path,'utf8'));
   if(pack.platform!==process.platform||pack.arch!==process.arch||!Array.isArray(pack.tools)||pack.tools.length>64||pack.tools.some(id=>typeof id!=='string'||!/^[a-z0-9-]{1,64}$/.test(id)))throw Error('Invalid pack');
   tools=pack.tools;
  }catch{}
  initial.config={...initial.config,installedTools:tools};
 }
 const result=await runLicenseAction({...initial,saveState:async state=>{send({type:'save',state});const ack=await next();if(ack?.type!=='saved'||ack.ok!==true)throw Error('Private state could not be saved');}});
 send({type:'result',result});process.stdout.end(()=>process.exit(0));
}catch(error){send({type:'error',message:error.message});process.stdout.end(()=>process.exit(1));}
