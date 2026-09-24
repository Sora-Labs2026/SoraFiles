import liveTools from './tool-metadata.json' with {type:'json'};
import {isDesktopTool} from './tool-policy.mjs';
import {resolveNativeActions} from './native-actions.mjs';
const interactive=new Set(['sign-pdf','edit-image','doc-scanner','watermark-pdf','page-numbers','remove-pages']);
const combine=new Set(['merge-pdf','jpg-to-pdf']);
export const capabilities=Object.freeze(liveTools.filter(t=>isDesktopTool(t.id)).map(t=>Object.freeze({id:t.id,name:t.name,route:'/'+t.slug,formats:t.inputFormats,outputs:t.outputFormats,mode:combine.has(t.id)?'combine':interactive.has(t.id)?'interactive':'per-file',aliases:[t.name.toLowerCase(),t.id.replaceAll('-',' ')]})));
export function searchTools(query){const q=query.trim().toLowerCase();if(!q)return capabilities;return capabilities.map(t=>({t,score:t.aliases.some(a=>a===q)?0:t.aliases.some(a=>a.startsWith(q))?1:t.aliases.some(a=>q.split(/\s+/).every(w=>a.includes(w)))?2:9})).filter(x=>x.score<9).sort((a,b)=>a.score-b.score).map(x=>x.t);}
// Accept only files classified by the native/content-validation layer, never a path extension alone.
export function relevantActions(files,authorized,context={}){
 const actions=resolveNativeActions({...context,files,authorized,platform:context.platform||'windows',capabilities:context.capabilities||capabilities});
 const seen=new Set();
 return actions.filter(action=>{const id=action.tool||action.id;if(seen.has(id))return false;seen.add(id);return true;})
  .map(action=>action.tool?{...capabilities.find(tool=>tool.id===action.tool),batch:action.batch,mode:action.combine?'combine':'interactive'}:action);
}

// Native menus and app drop suggestions use the same installed-engine resolver.
export function quickActionMenu(files,authorized,context={}){
 return resolveNativeActions({...context,files,authorized,platform:context.platform||'windows',capabilities:context.capabilities||capabilities});
}
