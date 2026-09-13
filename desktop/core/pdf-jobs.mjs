import {readFile} from 'node:fs/promises';import {dirname} from 'node:path';import {PDFDocument} from 'pdf-lib';import {zipSync,unzipSync} from 'fflate';
import {readLocalInput} from './input.mjs';
import {JobQueue} from './queue.mjs';import {verifyEntitlement} from '../shared/entitlement.mjs';import {mergePdf,splitPdf,rotatePdf,removePdfPages,numberPdfPages} from './pdf.mjs';import {saveOutput,outputName} from './output.mjs';
import {watermarkPdf,signPdf} from './pdf-overlays.mjs';
import {imagesToPdf} from './images-pdf.mjs';

// Trusted native-host integration surface. UI submits opaque selection IDs; only the host
// resolves paths, reads protected entitlement state, selects output folders and writes files.
// Node writer is a reference adapter; native Windows pinned-handle writer integration pending.
export function createPdfJobQueue({resolveSelection,readLicenseState,selectOutputFolder=async source=>dirname(source),writer=saveOutput,onChange=()=>{},onProgress=()=>{}}){
 const engines={};
 for(const tool of ['merge-pdf','split-pdf','rotate-pdf','remove-pages','page-numbers','watermark-pdf','sign-pdf','jpg-to-pdf'])engines[tool]=async(request,{signal,commit})=>{
  if(!request||!Array.isArray(request.selectionIds)||request.selectionIds.length>256||!request.selectionIds.length||request.selectionIds.some(id=>typeof id!=='string'||id.length>128))throw Error('Choose files');
  const paths=await resolveSelection(request.selectionIds);if(!Array.isArray(paths)||paths.length!==request.selectionIds.length)throw Error('Selection expired');
  if(tool==='sign-pdf'?paths.length!==2:!['merge-pdf','jpg-to-pdf'].includes(tool)&&paths.length!==1)throw Error(tool==='sign-pdf'?'Choose a PDF and signature image':'This job needs one source PDF');
  const input=[];let bytesTotal=0;for(const path of paths){const bytes=await readLocalInput(path,{signal,maxBytes:256*1024*1024-bytesTotal});bytesTotal+=bytes.length;input.push(bytes);}
  const options={...(request.options||{}),signal,onProgress:progress=>onProgress({tool,...progress})};let result,extension='pdf',expected=[];
  if(tool==='merge-pdf')result=await mergePdf(input,options);
  else if(tool==='rotate-pdf')result=await rotatePdf(input[0],options);
  else if(tool==='remove-pages')result=await removePdfPages(input[0],options);
  else if(tool==='page-numbers')result=await numberPdfPages(input[0],options);
  else if(tool==='watermark-pdf')result=await watermarkPdf(input[0],options);
  else if(tool==='sign-pdf')result=await signPdf(input[0],input[1],options);
  else if(tool==='jpg-to-pdf')result=await imagesToPdf(input,options);
  else{const groups=await splitPdf(input[0],options);if(groups.length===1)result=groups[0];else{
   const base=outputName(paths[0],'','pdf').slice(0,-4),entries={};for(const group of groups)entries[base+group.suffix+'.pdf']=group.bytes;
   const bytes=zipSync(entries,{level:6});result={bytes,pages:groups.reduce((n,g)=>n+g.pages,0)};extension='zip';expected=groups.map(g=>g.pages);
  }}
  const folder=await selectOutputFolder(paths[0],paths);signal.throwIfAborted();
  const validate=async file=>{const bytes=await readFile(file);if(extension==='pdf')return (await PDFDocument.load(bytes,{updateMetadata:false})).getPageCount()===result.pages;
   const entries=Object.values(unzipSync(bytes));if(entries.length!==expected.length)return false;for(let i=0;i<entries.length;i++)if((await PDFDocument.load(entries[i],{updateMetadata:false})).getPageCount()!==expected[i])return false;return true;
  };
  return commit(async()=>{const saved=await writer({source:paths[0],folder,tool,extension,bytes:result.bytes,validate,signal});return {...saved,...(result.warnings?.length?{warnings:result.warnings}:{} )};});
 };
 return new JobQueue({engines,concurrency:1,onChange,authorize:async()=>{const state=await readLicenseState();verifyEntitlement(state.token,state.verification);}});
}
