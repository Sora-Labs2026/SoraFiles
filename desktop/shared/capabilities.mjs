import liveTools from './tool-metadata.json' with {type:'json'};
import {isDesktopTool} from './tool-policy.mjs';
const interactive=new Set(['sign-pdf','edit-image','doc-scanner','watermark-pdf','page-numbers','remove-pages']);
const combine=new Set(['merge-pdf','jpg-to-pdf']);
export const capabilities=Object.freeze(liveTools.filter(t=>isDesktopTool(t.id)).map(t=>Object.freeze({id:t.id,name:t.name,route:'/'+t.slug,formats:t.inputFormats,outputs:t.outputFormats,mode:combine.has(t.id)?'combine':interactive.has(t.id)?'interactive':'per-file',aliases:[t.name.toLowerCase(),t.id.replaceAll('-',' ')]})));
export function searchTools(query){const q=query.trim().toLowerCase();if(!q)return capabilities;return capabilities.map(t=>({t,score:t.aliases.some(a=>a===q)?0:t.aliases.some(a=>a.startsWith(q))?1:t.aliases.some(a=>q.split(/\s+/).every(w=>a.includes(w)))?2:9})).filter(x=>x.score<9).sort((a,b)=>a.score-b.score).map(x=>x.t);}
// Accept only files classified by the native/content-validation layer, never a path extension alone.
export function relevantActions(files,authorized){
 if(!files.length)return [];
 if(!authorized)return [{id:'activate',name:'Open SoraFiles to Activate',mode:'interactive'}];
 if(files.length>256||files.some(f=>f.validated!==true||!f.format))return [{id:'open',name:'Open in SoraFiles',mode:'interactive'}];
 return capabilities.filter(t=>files.every(f=>t.formats.includes(f.format))).filter(t=>t.id!=='merge-pdf'||files.length>=2).map(t=>({...t,batch:files.length>1&&t.mode==='per-file'}));
}

// Compact shell menu, derived from the same registry as the app and drop suggestions.
// Less-common/interactive actions remain discoverable by opening the full workspace.
export function quickActionMenu(files,authorized){
 const available=relevantActions(files,authorized);if(!files.length)return [];
 if(!authorized)return available;
 const pdf=files.every(f=>f.validated&&f.format==='PDF'),images=files.every(f=>f.validated&&['JPG','PNG','WebP','HEIC','HEIF','TIFF','PSD','GIF','BMP','AVIF','ICO','JP2'].includes(f.format));
 const order=pdf?(files.length>1?['merge-pdf','compress-pdf','split-pdf','pdf-to-jpg','pdf-ocr','metadata-remover']:['compress-pdf','split-pdf','rotate-pdf','pdf-to-jpg','pdf-to-word','pdf-ocr']):images?['image-converter','compress-image','resize-image','remove-background','metadata-remover',...(files.length>1?['jpg-to-pdf']:[])]:[];
 const batchNames={'compress-pdf':'Compress all PDFs','split-pdf':'Split each PDF','pdf-to-jpg':'Convert PDFs to images','pdf-ocr':'Read text from all files','metadata-remover':'Remove metadata from all files','image-converter':'Convert all images','compress-image':'Compress all images','resize-image':'Resize all images','remove-background':'Remove backgrounds'};
 const menu=order.map(id=>available.find(t=>t.id===id)).filter(Boolean).map(tool=>({id:tool.id,name:files.length>1&&batchNames[tool.id]||tool.name,mode:tool.mode,batch:tool.batch}));
 return [...menu,{id:'open',name:'Open in SoraFiles',mode:'interactive'}];
}
