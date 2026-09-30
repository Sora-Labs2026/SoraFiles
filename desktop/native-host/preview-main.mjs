import {previewSelection} from '../core/preview.mjs';
// One request, one reply. Only the native parent supplies paths; nothing is
// written to disk and no licence state is needed to draw a preview.
const controller=new AbortController();let buffer=Buffer.alloc(0),started=false;
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
process.stdin.on('data',chunk=>{
 buffer=Buffer.concat([buffer,chunk]);if(buffer.length>262144)process.exit(2);
 const at=buffer.indexOf(10);if(at<0)return;
 let message;try{message=JSON.parse(buffer.subarray(0,at));}catch{process.exit(2);}
 if(message?.type!=='preview'||started)process.exit(2);started=true;
 void previewSelection(message.paths,{signal:controller.signal}).then(result=>{send({type:'result',result});process.stdout.end(()=>process.exit(0));})
  .catch(()=>{send({type:'error'});process.stdout.end(()=>process.exit(1));});
});
process.stdin.on('end',()=>{controller.abort();setTimeout(()=>process.exit(2),2000).unref();});
