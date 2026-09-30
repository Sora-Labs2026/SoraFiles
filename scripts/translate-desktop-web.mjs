// Build-time translation of public website copy only, never checkout/user data.
import fs from 'node:fs';
import {desktopTextEntries} from '../src/i18n/desktop-html.mjs';
const paths=['desktop','desktop/pricing','desktop/download','desktop/releases','desktop/help','desktop/purchase','desktop/redeem'];
const keys=new Set();
for(const path of paths)for(const entry of desktopTextEntries(fs.readFileSync(`dist/${path}/index.html`,'utf8')))keys.add(entry.text);
const pricing=JSON.parse(fs.readFileSync('src/data/prototypePricing.json','utf8'));
for(const value of Object.values(pricing))for(const entry of desktopTextEntries(value.html||value.plans))keys.add(entry.text);
for(const text of ['5 items','1 of 5 selected','2 of 5 selected','Compressing 2 files…','2 files saved beside the originals','Pause','Play','Hide key','Show key','License key copied. Paste it in SoraFiles Desktop.','Copy is unavailable. Choose Show key, then select and copy it.'])keys.add(text);
const file='src/i18n/desktop-web.json',catalog=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
catalog.en=Object.fromEntries([...keys].map(text=>[text,text]));
const locales=['ja','ko','es','fr','de','pt','zh-cn','zh-tw','hi','ar','ru','id','it','nl','tr','vi','th','pl'];
const save=()=>fs.writeFileSync(file,JSON.stringify(catalog,null,2)+'\n');save();
if(process.argv.includes('--collect')){console.log(`Collected ${keys.size} public messages`);process.exit(0);}
async function translate(text,locale){for(let attempt=0;attempt<4;attempt++){try{const url=new URL('https://translate.googleapis.com/translate_a/single');url.search=new URLSearchParams({client:'gtx',sl:'en',tl:locale,dt:'t',q:text.replaceAll('SoraFiles','SORA_KEEP_BRAND').replaceAll('Sora Labs','SORA_KEEP_COMPANY')});const response=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error(String(response.status));return (await response.json())[0].map(x=>x[0]||'').join('').replaceAll('SORA_KEEP_BRAND','SoraFiles').replaceAll('SORA_KEEP_COMPANY','Sora Labs');}catch(error){if(attempt===3)throw error;await new Promise(r=>setTimeout(r,1000*(attempt+1)));}}}
async function run(locale){const dict=catalog[locale]||={};const pending=[...keys].filter(key=>!dict[key]);const batches=[];let batch=[],size=0;for(const key of pending){if(size+key.length>1800&&batch.length){batches.push(batch);batch=[];size=0;}batch.push(key);size+=key.length+20;}if(batch.length)batches.push(batch);
 for(const [index,items]of batches.entries()){const result=await translate(items.map((text,j)=>`ZXQ${String(j).padStart(4,'0')}ZXQ\n${text}`).join('\n'),locale);const parts=[...result.matchAll(/ZXQ\s*(\d{4})\s*ZXQ\s*([\s\S]*?)(?=ZXQ\s*\d{4}\s*ZXQ|$)/g)];for(let j=0;j<items.length;j++){const value=parts.find(p=>Number(p[1])===j)?.[2]?.trim()||(await translate(items[j],locale)).trim();dict[items[j]]=value;}save();console.log(`${locale} ${index+1}/${batches.length}`);}
}
let next=0;await Promise.all(Array.from({length:3},async()=>{while(next<locales.length)await run(locales[next++]);}));
console.log(`Completed ${keys.size} public messages in 19 languages. Editorial review remains separate.`);
