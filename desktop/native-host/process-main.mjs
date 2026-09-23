import {runProcessing} from './processing-host.mjs';
import {withOutputPublisher} from '../core/native-publication.mjs';
const controller=new AbortController();let buffer=Buffer.alloc(0),started=false,saveAck,publishAck;
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
process.stdin.on('data',chunk=>{
 buffer=Buffer.concat([buffer,chunk]);if(buffer.length>65536)process.exit(2);
 let at;while((at=buffer.indexOf(10))>=0){const line=buffer.subarray(0,at);buffer=buffer.subarray(at+1);let message;try{message=JSON.parse(line);}catch{process.exit(2);}
  if(message.type==='cancel'){controller.abort();continue;}
  if(message.type==='saved'&&saveAck){const ack=saveAck;saveAck=null;ack(message);continue;}
  if(message.type==='published'&&publishAck){const ack=publishAck;publishAck=null;ack(message);continue;}
  if(message.type!=='process'||started)process.exit(2);started=true;
  const publish=message.nativePublication===true?async request=>{
   if(publishAck)throw Error('Publication already pending');
   const response=new Promise(resolve=>{publishAck=resolve;});send({type:'publish',...request});
   const result=await response;if(result.ok!==true||typeof result.path!=='string')throw Error('Output could not be published');return result;
  }:undefined;
  void withOutputPublisher(publish,()=>runProcessing({...message,signal:controller.signal,onChange:progress=>send({type:'progress',...progress}),saveState:async state=>{
   const ack=new Promise(resolve=>{saveAck=resolve;});send({type:'save',state});if((await ack).ok!==true)throw Error('Private state could not be saved');
  }})).then(result=>{send({type:'result',result});process.stdout.end(()=>process.exit(0));}).catch(()=>{
   send({type:'error',message:'Processing could not finish. Check the selected files and options, then try again.'});process.stdout.end(()=>process.exit(1));
  });
 }
});
process.stdin.on('end',()=>{controller.abort();setTimeout(()=>process.exit(2),2000).unref();});
