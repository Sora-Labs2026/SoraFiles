import originals from '../data/prototypeGuides.json';
import {localizedPath, type LocalePath} from './config';

// Generated from the public prototype copy with Google Translate; structure,
// URLs and identifiers remain authoritative source data. Native review pending.
const catalogs=import.meta.glob('./guides/*.json',{eager:true,import:'default'}) as Record<string,Record<string,string>>;
export const guideRoutePaths=['/guides',...originals.map(g=>`/guides/${g.slug}`)];
export function guideText(locale:LocalePath,text:string):string {
 if(locale==='en'||!text.trim())return text;
 const translated=catalogs[`./guides/${locale}.json`]?.[text];
 if(!translated)throw new Error(`Missing guide translation: ${locale}: ${text}`);
 return translated;
}
export function guideLink(locale:LocalePath,href:string):string {
 if(!href.startsWith('/')||href.startsWith('//'))return href;
 const split=href.search(/[?#]/);const path=split<0?href:href.slice(0,split);const suffix=split<0?'':href.slice(split);
 return localizedPath(locale,path)+suffix;
}
export function localizedGuides(locale:LocalePath):typeof originals {
 const walk=(value:unknown,key=''):unknown=>{
  if(typeof value==='string')return key==='href'?guideLink(locale,value):['type','slug','id','published'].includes(key)?value:guideText(locale,value);
  if(Array.isArray(value))return value.map(v=>walk(v,key));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,walk(v,k)]));
  return value;
 };
 return walk(originals) as typeof originals;
}
export function guidePageMeta(locale:LocalePath,basePath:string):{title:string;description:string} {
 if(basePath==='/guides')return {title:`${guideText(locale,'Guides')} | SoraFiles`,description:guideText(locale,'Practical guides for working with PDFs and images using SoraFiles. Browse published guidance on file formats, privacy and troubleshooting.')};
 const guide=originals.find(g=>`/guides/${g.slug}`===basePath);
 if(!guide)throw new Error(`Unknown guide route: ${basePath}`);
 return {title:`${guideText(locale,guide.title)} | SoraFiles`,description:guideText(locale,guide.description)};
}
