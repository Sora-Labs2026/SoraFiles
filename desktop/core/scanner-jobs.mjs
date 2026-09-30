import {dirname} from 'node:path';import {readFile} from 'node:fs/promises';import {zipSync} from 'fflate';
import {JobQueue} from './queue.mjs';import {readLocalInput} from './input.mjs';import {saveOutput} from './output.mjs';import {scanDocuments} from './scanner.mjs';import {verifyEntitlement} from '../shared/entitlement.mjs';
import {rasterPdf} from './pdf-raster.mjs';import {recognizeDocument} from './ocr.mjs';import {ocrLanguages} from '../shared/ocr-options.mjs';
const SCAN_KEYS=['filter','rotation','paper','format','searchable','language'];
// Export like the website: the scanned PDF, the same pages as JPG/PNG images
// (a ZIP when there are several), or a searchable PDF made by the OCR engine.
export function scanExport({format='pdf',searchable=false,language='eng'}={}){
 if(!['pdf','jpg','png'].includes(format)||typeof searchable!=='boolean'||searchable&&format!=='pdf'||!Object.hasOwn(ocrLanguages,language))throw Error('Choose valid scan options');
 return {format,searchable,language};
}
export function createScannerJobQueue({resolveSelection,readLicenseState,selectOutputFolder=async source=>dirname(source),writer=saveOutput,onChange=()=>{}}){
 return new JobQueue({concurrency:1,onChange,authorize:async()=>{const state=await readLicenseState();verifyEntitlement(state.token,state.verification);},engines:{'doc-scanner':async(request,{signal,commit})=>{
  if(!Array.isArray(request.selectionIds)||!request.selectionIds.length||request.selectionIds.length>20||!request.options||Object.keys(request.options).some(key=>!SCAN_KEYS.includes(key)))throw Error('Choose up to 20 images and valid scan options');
  const {filter,rotation,paper,...exportOptions}=request.options,output=scanExport(exportOptions);
  const paths=await resolveSelection(request.selectionIds);if(paths.length!==request.selectionIds.length)throw Error('Selection expired');
  const inputs=[];let bytes=0;for(const path of paths){const input=await readLocalInput(path,{signal,maxBytes:Math.min(64*1024*1024,256*1024*1024-bytes)});inputs.push(input);bytes+=input.length;}
  const scan=await scanDocuments(inputs,{filter,rotation,paper,signal});
  let result={bytes:scan.bytes,extension:'pdf',warnings:scan.warnings};
  if(output.searchable){
   const ocr=await recognizeDocument(scan.bytes,{language:output.language,format:'pdf',signal});
   result={bytes:ocr.bytes,extension:'pdf',warnings:['Saved a searchable PDF: page images with recognized text. Review the recognized text, fine print and faint markings.',...ocr.warnings.filter(warning=>/No text was recognized/.test(warning))]};
  }else if(output.format!=='pdf'){
   const pages=await rasterPdf(scan.bytes,{dpi:200,format:output.format==='jpg'?'jpeg':'png',quality:92,maxPages:20,signal});
   const images=pages.length===1?pages[0].bytes:zipSync(Object.fromEntries(pages.map(page=>['scan-'+String(page.page).padStart(2,'0')+'.'+page.extension,page.bytes])),{level:0});
   result={bytes:images,extension:pages.length===1?pages[0].extension:'zip',warnings:[`Saved ${pages.length===1?'the scanned page as an image':`${pages.length} scanned pages as images in a ZIP file`} (200 dpi). Review fine text and faint markings.`]};
  }
  const folder=await selectOutputFolder(paths[0]);signal.throwIfAborted();
  return commit(async()=>({...await writer({source:paths[0],folder,tool:'doc-scanner',extension:result.extension,bytes:result.bytes,signal,validate:async path=>(await readFile(path)).equals(Buffer.from(result.bytes))}),warnings:result.warnings}));
 }}});
}
