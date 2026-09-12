import {open,lstat,readFile} from 'node:fs/promises';import {dirname,isAbsolute} from 'node:path';import {PDFDocument} from 'pdf-lib';import {zipSync,unzipSync} from 'fflate';
import {JobQueue} from './queue.mjs';import {verifyEntitlement} from '../shared/entitlement.mjs';import {mergePdf,splitPdf,rotatePdf,removePdfPages} from './pdf.mjs';import {saveOutput,outputName} from './output.mjs';

async function readSelected(path,signal){signal.throwIfAborted();if(typeof path!=='string'||!isAbsolute(path)||path.startsWith('\\\\')||path.startsWith('//'))throw Error('Local selected file required');const before=await lstat(path);if(!before.isFile()||before.isSymbolicLink()||!before.size||before.size>256*1024*1024)throw Error('Unsupported input');const handle=await open(path,'r');try{const start=await handle.stat();if(start.ino!==before.ino||start.dev!==before.dev||start.size!==before.size)throw Error('Input changed');const bytes=new Uint8Array(await handle.readFile());const end=await handle.stat();if(start.size!==end.size||start.mtimeMs!==end.mtimeMs)throw Error('Input changed');signal.throwIfAborted();return bytes;}finally{await handle.close();}}

// Trusted native-host integration surface. UI submits opaque selection IDs; only the host
// resolves paths, reads protected entitlement state, selects output folders and writes files.
// Node writer is a reference adapter; native Windows pinned-handle writer integration pending.
export function createPdfJobQueue({resolveSelection,readLicenseState,selectOutputFolder=async source=>dirname(source),writer=saveOutput,onChange=()=>{},onProgress=()=>{}}){
 const engines={};
 for(const tool of ['merge-pdf','split-pdf','rotate-pdf','remove-pages'])engines[tool]=async(request,{signal,commit})=>{
  if(!request||!Array.isArray(request.selectionIds)||request.selectionIds.length>256||!request.selectionIds.length||request.selectionIds.some(id=>typeof id!=='string'||id.length>128))throw Error('Choose files');
  const paths=await resolveSelection(request.selectionIds);if(!Array.isArray(paths)||paths.length!==request.selectionIds.length)throw Error('Selection expired');
  if(tool!=='merge-pdf'&&paths.length!==1)throw Error('This job needs one source PDF');
  const input=[];let bytesTotal=0;for(const path of paths){const bytes=await readSelected(path,signal);bytesTotal+=bytes.length;if(bytesTotal>256*1024*1024)throw Error('Selected PDFs exceed 256 MB');input.push(bytes);}
  const options={...(request.options||{}),signal,onProgress:progress=>onProgress({tool,...progress})};let result,extension='pdf',expected=[];
  if(tool==='merge-pdf')result=await mergePdf(input,options);
  else if(tool==='rotate-pdf')result=await rotatePdf(input[0],options);
  else if(tool==='remove-pages')result=await removePdfPages(input[0],options);
  else{const groups=await splitPdf(input[0],options);if(groups.length===1)result=groups[0];else{
   const base=outputName(paths[0],'','pdf').slice(0,-4),entries={};for(const group of groups)entries[base+group.suffix+'.pdf']=group.bytes;
   const bytes=zipSync(entries,{level:6});result={bytes,pages:groups.reduce((n,g)=>n+g.pages,0)};extension='zip';expected=groups.map(g=>g.pages);
  }}
  const folder=await selectOutputFolder(paths[0],paths);signal.throwIfAborted();
  const validate=async file=>{const bytes=await readFile(file);if(extension==='pdf')return (await PDFDocument.load(bytes,{updateMetadata:false})).getPageCount()===result.pages;
   const entries=Object.values(unzipSync(bytes));if(entries.length!==expected.length)return false;for(let i=0;i<entries.length;i++)if((await PDFDocument.load(entries[i],{updateMetadata:false})).getPageCount()!==expected[i])return false;return true;
  };
  return commit(()=>writer({source:paths[0],folder,tool,extension,bytes:result.bytes,validate,signal}));
 };
 return new JobQueue({engines,concurrency:1,onChange,authorize:async()=>{const state=await readLicenseState();verifyEntitlement(state.token,state.verification);}});
}
