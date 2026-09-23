import {fork} from 'node:child_process';import {fileURLToPath} from 'node:url';
export async function heicToJpg(bytes,{quality=90,signal}={}){
 signal?.throwIfAborted();
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>64*1024*1024||!Number.isInteger(quality)||quality<40||quality>100)throw Error('Choose a still HEIC photo up to 64 MB and quality from 40 to 100');
 return new Promise((resolve,reject)=>{
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['systemroot','windir','temp','tmp','tmpdir'].includes(key.toLowerCase())));
  const child=fork(fileURLToPath(new URL('./heic-worker.mjs',import.meta.url)),[],{serialization:'advanced',stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,execArgv:['--max-old-space-size=512'],env});
  let result,error,received=false;const stop=reason=>{error??=reason;child.kill();},abort=()=>stop(signal.reason||new DOMException('Cancelled','AbortError'));
  const timer=setTimeout(()=>stop(Error('HEIC conversion took too long')),120000);signal?.addEventListener('abort',abort,{once:true});
  child.on('error',()=>stop(Error('HEIC conversion could not start')));
  child.on('message',message=>{
   if(received)return stop(Error('Invalid HEIC response'));received=true;
   if(!message?.ok||!(message.bytes instanceof Uint8Array)||!message.bytes.length||message.bytes.length>64*1024*1024||!Number.isInteger(message.width)||!Number.isInteger(message.height)||message.width<1||message.height<1||message.width*message.height>25_000_000||!Number.isInteger(message.extra)||message.extra<0||message.extra>31)return stop(Error('Choose a supported still HEIC photo up to 25 megapixels. Sequences and other HEIF codecs are not supported yet.'));
   result={bytes:message.bytes,extension:'jpg',warnings:[`Primary photo converted to JPG. ${message.extra} additional image(s) were not exported. HDR/depth data, animations and metadata are not retained; review orientation and colour before sharing.`]};
  });
  child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error||code!==0||!result)reject(error||Error('HEIC conversion stopped'));else resolve(result);});
  child.send({bytes,quality},error=>{if(error)stop(Error('HEIC conversion could not start'));});if(signal?.aborted)abort();
 });
}
