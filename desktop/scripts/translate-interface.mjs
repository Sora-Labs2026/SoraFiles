// Build-time maintenance only. The packaged app reads these offline catalogs;
// it never sends customer files, identifiers, keys or interface text to a service.
import fs from 'node:fs';
import ts from 'typescript';
const sources=['desktop/ui/main.ts','desktop/ui/processing.ts','desktop/ui/startup-confirmation.ts','desktop/ui/host.ts','desktop/ui/tool-categories.ts','desktop/shared/native-actions.mjs'];
const strings=new Set(['Language','App language','Use Windows language (default)','Use macOS language (default)','Use system language (default)','Default','Light','Dark','Follow system','Cancel processing','Settings','Edit with SoraFiles','Open SoraFiles','Quit SoraFiles']);
for(const message of ['Save SoraFiles results','Choose files for SoraFiles','Choose output folder','Language saved. File-manager actions could not be refreshed. Turn them off and on in Settings, then restart your file manager.'])strings.add(message);
function add(text){text=text.trim();if(text&&/[A-Za-z]/.test(text)&&!/[{}<>]|\$\{|\b(?:const|function|return)\b|^(?:https?:|[./#])/.test(text)&&text.length<2000&&(text.includes(' ')||/^[A-Z][a-z]+$/.test(text)))strings.add(text);}
function extract(text){
 if(text.includes('<')){
  // These are trusted static HTML fragments from our TypeScript templates,
  // never arbitrary documents. Preserve boundaries around inline elements.
  for(const segment of text.replace(/<[^>]*>/g,'\n').split('\n'))add(segment.replaceAll('&amp;','&').replaceAll('&nbsp;',' '));
  for(const match of text.matchAll(/(?:aria-label|placeholder|title)="([^"]+)"/g))add(match[1]);
 }else add(text);
}
for(const path of sources){
 const source=ts.createSourceFile(path,fs.readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true);
 const visit=node=>{if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node))extract(node.text);ts.forEachChild(node,visit);};visit(source);
}
for(const tool of JSON.parse(fs.readFileSync('desktop/shared/tool-metadata.json','utf8')))add(tool.name);
const dir='desktop/shared/locales',path=dir+'/catalogs.json';fs.mkdirSync(dir,{recursive:true});
const catalog=JSON.parse(fs.readFileSync(path,'utf8'));catalog.en=Object.fromEntries([...strings].sort().map(s=>[s,s]));
const locales=['ja','ko','es','fr','de','pt','zh-cn','zh-tw','hi','ar','ru','id','it','nl','tr','vi','th','pl'];
fs.writeFileSync(path,JSON.stringify(catalog,null,2)+'\n');
if(!process.argv.includes('--translate')){console.log(`Collected ${strings.size} public interface messages.`);process.exit(0);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function translate(q,locale){for(let i=0;i<4;i++){try{const url=new URL('https://translate.googleapis.com/translate_a/single');url.search=new URLSearchParams({client:'gtx',sl:'en',tl:locale,dt:'t',q});const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return (await r.json())[0].map(x=>x[0]||'').join('');}catch(e){if(i===3)throw e;await sleep(1000*(i+1));}}}
async function run(locale){
 const dict=catalog[locale]||={};const pending=[...strings].filter(s=>!dict[s]);let batch=[],size=0;const batches=[];
 for(const s of pending){if(size+s.length>2000&&batch.length){batches.push(batch);batch=[];size=0;}batch.push(s);size+=s.length+20;}if(batch.length)batches.push(batch);
 for(const [i,items]of batches.entries()){
  const translated=await translate(items.map((s,j)=>`ZXQ${String(j).padStart(4,'0')}ZXQ\n${s}`).join('\n'),locale);
  const parts=[...translated.matchAll(/ZXQ\s*(\d{4})\s*ZXQ\s*([\s\S]*?)(?=ZXQ\s*\d{4}\s*ZXQ|$)/g)];
  for(let j=0;j<items.length;j++){let value=parts.find(p=>Number(p[1])===j)?.[2]?.trim();if(!value)value=(await translate(items[j],locale)).trim();if(!value)throw Error('Empty translation');dict[items[j]]=value;}
  fs.writeFileSync(path,JSON.stringify(catalog,null,2)+'\n');console.log(`${locale}: ${i+1}/${batches.length}`);
 }
}
let next=0;await Promise.all(Array.from({length:3},async()=>{while(next<locales.length)await run(locales[next++]);}));
console.log(`Saved ${strings.size} messages in 19 language catalogs; editorial review is separate.`);
