import createQpdf from '@neslinesli93/qpdf-wasm';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
import {PDFDocument} from 'pdf-lib';
import {rejectPdfSignatures} from './pdf-safety.mjs';
const require=createRequire(import.meta.url);
process.once('message',async({bytes})=>{
 try{
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>64*1024*1024)throw Error();
  const source=await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false,throwOnInvalidObject:true});
  if(source.getPageCount()<1||source.getPageCount()>1000)throw Error();
  rejectPdfSignatures(source);
  const module=await createQpdf({wasmBinary:await readFile(require.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm')),noInitialRun:true,print:()=>{},printErr:()=>{}});
  module.FS.writeFile('/input.pdf',bytes);
  const code=module.callMain(['--object-streams=generate','--stream-data=compress','--decode-level=generalized','--recompress-flate','--compression-level=9','/input.pdf','/output.pdf']);
  // QPDF warning status is not evidence of a sound input/output; fail closed.
  if(code!==0)throw Error();
  const optimized=module.FS.readFile('/output.pdf');if(!optimized.length||optimized.length>64*1024*1024)throw Error();
  const check=await PDFDocument.load(optimized,{ignoreEncryption:false,updateMetadata:false,throwOnInvalidObject:true});
  if(check.getPageCount()!==source.getPageCount())throw Error();
  for(let i=0;i<source.getPageCount();i++){
   const before=source.getPage(i),after=check.getPage(i);
   if(JSON.stringify(before.getMediaBox())!==JSON.stringify(after.getMediaBox())||JSON.stringify(before.getCropBox())!==JSON.stringify(after.getCropBox())||before.getRotation().angle!==after.getRotation().angle)throw Error();
  }
  const unchanged=optimized.length>=bytes.length;process.send({ok:true,bytes:unchanged?bytes:optimized,unchanged},()=>process.exit(0));
 }catch{process.send({ok:false},()=>process.exit(1));}
});
process.once('disconnect',()=>process.exit(1));
