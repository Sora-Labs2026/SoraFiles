import liveTools from './tool-metadata.json' with {type:'json'};
import {isDesktopTool} from './tool-policy.mjs';
const desktopCapabilities=liveTools.filter(tool=>isDesktopTool(tool.id)).map(tool=>({id:tool.id,formats:tool.inputFormats}));

// This module contains routing metadata only. Never import processing libraries,
// read files, or contact the license service while resolving a native menu.
// Formats here describe the connected Desktop engines, not the broader Web catalog.
const stillImages=['JPG','PNG','WebP'];
const pdf=['PDF'];
const definitions=[
 {id:'merge-pdf',tool:'merge-pdf',label:'Merge PDFs',formats:pdf,min:2,combine:true},
 {id:'convert-to-png',tool:'image-converter',label:'Convert to PNG',many:'Convert all to PNG',formats:[...stillImages,'GIF','TIFF'],target:'PNG',direct:true,options:{format:'png',quality:85}},
 {id:'convert-to-webp',tool:'image-converter',label:'Convert to WebP',many:'Convert all to WebP',formats:[...stillImages,'GIF','TIFF'],target:'WebP',options:{format:'webp',quality:85}},
 {id:'convert-to-jpg',tool:'image-converter',label:'Convert to JPG',many:'Convert all to JPG',formats:[...stillImages,'GIF','TIFF'],target:'JPG',options:{format:'jpeg',quality:85}},
 {id:'heic-to-jpg',tool:'heic-to-jpg',label:'Convert to JPG',many:'Convert all to JPG',formats:['HEIC','HEIF'],options:{quality:90}},
 {id:'jpg-to-pdf',tool:'jpg-to-pdf',label:'Convert to PDF',many:'Create PDF from images',formats:['JPG','PNG'],combine:true,options:{paper:'a4',orientation:'auto'}},
 {id:'compress-image',tool:'compress-image',label:'Compress image',many:'Compress all images',formats:stillImages,direct:true,options:{quality:85}},
 {id:'resize-image',tool:'resize-image',label:'Resize image',many:'Resize all images',formats:stillImages,options:{format:'png',width:1600}},
 {id:'edit-image',tool:'edit-image',label:'Rotate, flip and adjust image',many:'Rotate, flip and adjust images',formats:stillImages},
 {id:'remove-background',tool:'remove-background',label:'Remove background',many:'Remove backgrounds',formats:stillImages,direct:true},
 {id:'compress-pdf',tool:'compress-pdf',label:'Compress PDF',many:'Compress all PDFs',formats:pdf,direct:true},
 {id:'pdf-to-jpg',tool:'pdf-to-jpg',label:'PDF to images',many:'Convert PDFs to images',formats:pdf},
 {id:'split-pdf',tool:'split-pdf',label:'Split or extract PDF pages',many:'Split or extract pages from PDFs',formats:pdf},
 {id:'rotate-pdf',tool:'rotate-pdf',label:'Rotate PDF pages',many:'Rotate pages in PDFs',formats:pdf},
 {id:'remove-pages',tool:'remove-pages',label:'Remove PDF pages',many:'Remove pages from PDFs',formats:pdf},
 {id:'page-numbers',tool:'page-numbers',label:'Add page numbers',formats:pdf},
 {id:'watermark-pdf',tool:'watermark-pdf',label:'Add watermark',formats:pdf},
 {id:'protect-pdf',tool:'protect-pdf',label:'Protect PDF',many:'Protect PDFs',formats:pdf},
 {id:'pdf-to-word',tool:'pdf-to-word',label:'PDF to Word',many:'Convert PDFs to Word',formats:pdf},
 {id:'pdf-to-excel',tool:'pdf-to-excel',label:'PDF tables to Excel',many:'Convert PDF tables to Excel',formats:pdf},
 {id:'repair-pdf',tool:'repair-pdf',label:'Repair PDF',many:'Repair PDFs',formats:pdf},
 {id:'metadata-remover',tool:'metadata-remover',label:'Remove metadata',many:'Remove metadata from all files',formats:[...pdf,...stillImages,'DOCX','XLSX','PPTX'],direct:true},
 {id:'pdf-ocr',tool:'pdf-ocr',label:'Read text with OCR',formats:[...pdf,...stillImages]},
 {id:'doc-scanner',tool:'doc-scanner',label:'Create scanned document',formats:stillImages,combine:true,max:20},
];
export const implementedNativeToolIds=Object.freeze([...new Set(definitions.map(action=>action.tool))]);
const platforms=new Set(['windows','macos','linux']);
const openAction=()=>({id:'open',operationId:'open',name:'More options',label:'More options',tool:null,mode:'interactive',direct:false,requiresUI:true,batch:false,options:{},validation:[]});
const checks=Object.freeze(['revalidate-selection','verify-current-entitlement','decode-with-engine-limits','publish-without-overwrite']);
const limited64MiB=new Set(['image-converter','compress-image','resize-image','edit-image','remove-background','compress-pdf','repair-pdf','pdf-to-word','pdf-to-excel','metadata-remover','heic-to-jpg']);
const pdfPageLimits={'pdf-to-word':60,'pdf-to-excel':100,'pdf-ocr':100,'repair-pdf':100};

function compatibleFile(file,action,capability){
 if(!file||file.validated!==true||!action.formats.includes(file.format)||!capability.formats.includes(file.format))return false;
 // A cheap classifier may not know these properties; the engine always checks
 // them again. Known incompatibilities must never be presented as runnable.
 if(file.animated===true||Number.isFinite(file.pages)&&file.format!=='PDF'&&file.pages>1)return false;
 if(file.encrypted===true)return false;
 if(file.signed===true&&['metadata-remover','compress-pdf','repair-pdf'].includes(action.tool))return false;
 if(file.macros===true&&action.tool==='metadata-remover')return false;
 if(file.bytes!==undefined&&(!Number.isSafeInteger(file.bytes)||file.bytes<1||file.bytes>256*1024*1024))return false;
 if(file.pages!==undefined&&(!Number.isSafeInteger(file.pages)||file.pages<1))return false;
 if(file.pixels!==undefined&&(!Number.isSafeInteger(file.pixels)||file.pixels<1))return false;
 if(file.format==='PDF'&&file.pages>(pdfPageLimits[action.tool]||1000))return false;
 if(limited64MiB.has(action.tool)&&file.bytes>64*1024*1024)return false;
 if(['jpg-to-pdf','doc-scanner'].includes(action.tool)&&file.bytes>64*1024*1024)return false;
 if(action.tool==='pdf-ocr'&&file.bytes>(file.format==='PDF'?256:64)*1024*1024)return false;
 if(file.pixels> (['remove-background','doc-scanner'].includes(action.tool)?12:25)*1_000_000&&file.format!=='PDF')return false;
 return true;
}

/** Resolve from trusted, content-classified selections and native host state.
 * authorized is a display hint obtained from local signed-license verification;
 * it is NOT an authorization grant. The ordinary processing host must reauthorize.
 * installedTools is the host's verified installed-engine inventory (an empty list
 * means no engines). Callers can further restrict the existing capability registry.
 */
export function resolveNativeActions({files,authorized=false,platform,installedTools=implementedNativeToolIds,capabilities=desktopCapabilities,outputMode='source'}={}){
 if(!Array.isArray(files)||!files.length)return [];
 if(authorized!==true)return [{...openAction(),id:'activate',operationId:'activate',name:'Set up SoraFiles',label:'Set up SoraFiles'}];
 if(!platforms.has(platform)||files.length>256||!Array.isArray(capabilities)||!Array.isArray(installedTools))return [openAction()];
 const installed=new Set(installedTools),registry=new Map(capabilities.filter(item=>item&&Array.isArray(item.formats)).map(item=>[item.id,item]));
 const actions=definitions.filter(action=>{
  const capability=registry.get(action.tool);
  if(!isDesktopTool(action.tool)||!installed.has(action.tool)||!capability||capability.available===false||Array.isArray(capability.platforms)&&!capability.platforms.includes(platform))return false;
  if(files.length<(action.min||1)||files.length>(action.max||256)||!files.every(file=>compatibleFile(file,action,capability)))return false;
  if(files.length>1&&!action.combine&&capability.batch===false)return false;
  if(action.target&&files.every(file=>file.format===action.target))return false;
  if(action.combine&&files.reduce((sum,file)=>sum+(file.bytes||0),0)>256*1024*1024)return false;
  if(action.tool==='merge-pdf'&&files.reduce((sum,file)=>sum+(file.pages||0),0)>1000)return false;
  if(['jpg-to-pdf','doc-scanner'].includes(action.tool)&&files.reduce((sum,file)=>sum+(file.pixels||0),0)>(action.tool==='doc-scanner'?60:100)*1_000_000)return false;
  return true;
 }).map(action=>{
  const name=files.length>1&&action.many||action.label;
  const direct=action.direct===true&&outputMode!=='ask';
  return {id:action.id,operationId:action.id,name,label:name,tool:action.tool,mode:direct?'direct':'interactive',direct,requiresUI:!direct,batch:files.length>1&&!action.combine,combine:!!action.combine,options:{...action.options},validation:[...checks]};
 });
 return [...actions,openAction()];
}

// Turn an opaque native action ID into the SAME tool/options request consumed by
// processFiles. No paths, encoder implementations, or caller-supplied options can
// be smuggled through this boundary. Interactive callers preload these files and
// defaults, then submit the normal app form after the user's choices.
export function resolveNativeActionRequest(actionId,context){
 const action=resolveNativeActions(context).find(item=>item.id===actionId);
 if(!action)throw Error('This action is not available for the selected files');
 return {actionId:action.id,tool:action.tool,options:{...action.options},direct:action.direct,requiresUI:action.requiresUI,selection:context.files.map(file=>({...file})),validation:[...action.validation]};
}
