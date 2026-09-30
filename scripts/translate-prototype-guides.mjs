// Explicit build-time translation of public website copy; never runs in the app.
import fs from 'node:fs';
const source=JSON.parse(fs.readFileSync('src/data/prototypeGuides.json','utf8'));
const shared=['Home','Guides','Working with files','On this page','Related tools','Related guides','By Sora Labs','Published','File Guides | SoraFiles','Practical guides for working with PDFs and images using SoraFiles. Browse published guidance on file formats, privacy and troubleshooting.','Open','Rename','Edit with SoraFiles','Compress PDF','Merge PDF','PDF to JPG','Report.pdf'];
const skip=new Set(['type','slug','id','href','published']);
const strings=new Set(shared);
function visit(value,key){if(typeof value==='string'&&!skip.has(key)&&value.trim())strings.add(value);else if(Array.isArray(value))value.forEach(v=>visit(v,key));else if(value&&typeof value==='object')Object.entries(value).forEach(([k,v])=>visit(v,k));}
visit(source);
const locales=['ja','ko','es','fr','de','pt','zh-cn','zh-tw','hi','ar','ru','id','it','nl','tr','vi','th','pl'];
fs.mkdirSync('src/i18n/guides',{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function translate(q,locale){for(let i=0;i<5;i++){try{const url=new URL('https://translate.googleapis.com/translate_a/single');url.search=new URLSearchParams({client:'gtx',sl:'en',tl:locale,dt:'t',q});const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`HTTP ${r.status}`);const data=await r.json();return data[0].map(x=>x[0]||'').join('');}catch(e){if(i===4)throw e;await sleep(1500*(i+1));}}}
async function run(locale){const path=`src/i18n/guides/${locale}.json`;const dict=fs.existsSync(path)?JSON.parse(fs.readFileSync(path,'utf8')):{};const remaining=[...strings].filter(s=>!dict[s]);const batches=[];let batch=[],size=0;for(const s of remaining){if(size+s.length>2500&&batch.length){batches.push(batch);batch=[];size=0;}batch.push(s);size+=s.length+20;}if(batch.length)batches.push(batch);
 for(const [i,items] of batches.entries()){
  const q=items.map((s,j)=>`ZXQ${String(j).padStart(4,'0')}ZXQ\n${s.trim()}`).join('\n');
  const translated=await translate(q,locale);
  const parts=[...translated.matchAll(/ZXQ\s*(\d{4})\s*ZXQ\s*([\s\S]*?)(?=ZXQ\s*\d{4}\s*ZXQ|$)/g)];
  for(let j=0;j<items.length;j++){let t=parts.find(p=>Number(p[1])===j)?.[2]?.trim();if(!t)t=(await translate(items[j].trim(),locale)).trim();dict[items[j]]=(items[j].match(/^\s*/)?.[0]||'')+t+(items[j].match(/\s*$/)?.[0]||'');}
  fs.writeFileSync(path,JSON.stringify(dict,null,2)+'\n');console.log(`${locale}: ${i+1}/${batches.length}`);await sleep(150);
 }
}
let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<locales.length){const locale=locales[cursor++];await run(locale);}}));
