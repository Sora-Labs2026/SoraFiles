import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const MAX_BYTES=256*1024*1024;

// Untrusted PDF parsing and native canvas decoding receive bytes and rendering
// options only. Device keys, selected paths and licensing state stay in the parent.
// Process isolation is not an OS sandbox or a hard native-memory limit.
export function rasterPdf(input,{dpi=150,format='jpeg',quality=95,selected,maxPages=1000,maxTotalPixels=1_000_000_000,signal}={}){
 if(!(input instanceof Uint8Array)||!input.length||input.length>MAX_BYTES||!Number.isInteger(dpi)||dpi<72||dpi>300
  ||!['jpeg','png'].includes(format)||!Number.isInteger(quality)||quality<40||quality>100
  ||!Number.isInteger(maxPages)||maxPages<1||maxPages>1000||!Number.isSafeInteger(maxTotalPixels)||maxTotalPixels<1||maxTotalPixels>1_000_000_000
  ||selected!==undefined&&(!Array.isArray(selected)||!selected.length||selected.length>maxPages||selected.some(page=>!Number.isInteger(page)||page<0||page>=1000)||new Set(selected).size!==selected.length))return Promise.reject(Error('Choose valid PDF image settings'));
 const chosen=selected?.slice().sort((a,b)=>a-b);
 if(signal?.aborted)return Promise.reject(signal.reason);
 return new Promise((resolve,reject)=>{
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['systemroot','windir','temp','tmp','tmpdir'].includes(key.toLowerCase())));
  const child=fork(fileURLToPath(new URL('./pdf-raster-worker.mjs',import.meta.url)),[],{serialization:'advanced',stdio:['ignore','ignore','ignore','ipc'],windowsHide:true,execArgv:['--max-old-space-size=512'],env});
  let result,error,received=false;
  const stop=reason=>{error??=reason;child.kill();};
  const abort=()=>stop(signal.reason||new DOMException('Cancelled','AbortError'));
  const timer=setTimeout(()=>stop(Error('PDF conversion took too long. Split the PDF and try again.')),120000);
  signal?.addEventListener('abort',abort,{once:true});
  child.on('error',()=>stop(Error('PDF image converter unavailable')));
  child.on('message',message=>{
   if(received)return stop(Error('Invalid PDF image response'));received=true;
   if(!message?.ok){const messages={selection:'Page selection is outside the PDF',budget:'Split this document into smaller parts before processing',resolution:'Reduce the resolution for this page',image:'An embedded image exceeded the maximum allowed size',content:'The PDF could not be rendered completely',invalid:'The PDF could not be opened'};return stop(Error(messages[message?.code]||messages.invalid));}
   let total=0,pixels=0;
   if(!Array.isArray(message.pages)||!message.pages.length||message.pages.length>maxPages||message.pages.some((page,index)=>{
    if(!(page?.bytes instanceof Uint8Array))return true;total+=page.bytes.length;
    pixels+=page.width*page.height;
    return !page.bytes.length||total>MAX_BYTES||pixels>maxTotalPixels||page.page!==(chosen?chosen[index]+1:index+1)||!Number.isSafeInteger(page.width)||!Number.isSafeInteger(page.height)||page.width<1||page.height<1||page.width*page.height>25_000_000||page.extension!==(format==='jpeg'?'jpg':'png');
   })||chosen&&message.pages.length!==chosen.length)return stop(Error('Invalid PDF image response'));
   result=message.pages.map(({bytes,width,height,page,extension})=>({bytes,width,height,page,extension}));
  });
  child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error||code!==0||!result)reject(error||Error('The PDF could not be rendered completely'));else resolve(result);});
  child.send({bytes:input,options:{dpi,format,quality,selected:chosen,maxPages,maxTotalPixels}},error=>{if(error)stop(Error('PDF image converter unavailable'));});
  if(signal?.aborted)abort();
 });
}
