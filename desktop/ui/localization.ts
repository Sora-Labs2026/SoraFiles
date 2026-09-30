import {translate} from '../shared/localization.mjs';

export const languages = [
 ['en','English'],['ja','日本語'],['ko','한국어'],['es','Español'],['fr','Français'],
 ['de','Deutsch'],['pt','Português'],['zh-cn','简体中文'],['zh-tw','繁體中文'],
 ['hi','हिन्दी'],['ar','العربية'],['ru','Русский'],['id','Bahasa Indonesia'],
 ['it','Italiano'],['nl','Nederlands'],['tr','Türkçe'],['vi','Tiếng Việt'],['th','ไทย'],['pl','Polski'],
] as const;
export type Locale = typeof languages[number][0];
let active:Locale='en';
export function normalizeLocale(value:unknown):Locale {
 const tag=String(value||'').trim().toLowerCase().replaceAll('_','-').split(/[.@]/)[0];
 if(tag==='zh'||tag.startsWith('zh-'))return /(?:^|-)(tw|hk|mo|hant)(?:-|$)/.test(tag)?'zh-tw':'zh-cn';
 const base=tag.split('-')[0];return languages.some(([code])=>code===base)?base as Locale:'en';
}
export function setLocale(value:unknown){active=normalizeLocale(value);document.documentElement.lang=active;document.documentElement.dir=active==='ar'?'rtl':'ltr';}
export function locale(){return active;}
export function t(source:string):string {
 return translate(active,source);
}
// Translate only bundled interface messages, never user inputs, filenames,
// device identifiers or output names. These regions are marked data-user-text.
// Strings are assigned as text, so catalog content cannot introduce markup.
export function localizeUi(root:HTMLElement){
 if(active==='en')return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 let node:Node|null;
 while((node=walker.nextNode())){
  const parent=node.parentElement;
  if(!parent||parent.closest('[data-user-text],script,style,textarea,input,code,[translate="no"]'))continue;
  const text=node.textContent||'',trimmed=text.trim();
  if(trimmed)node.textContent=text.slice(0,text.indexOf(trimmed))+t(trimmed)+text.slice(text.indexOf(trimmed)+trimmed.length);
 }
 for(const element of [root,...root.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]')]){
  if(element.closest('[data-user-text],[translate="no"]'))continue;
  for(const attr of ['aria-label','title','placeholder']){const value=element.getAttribute(attr);if(value)element.setAttribute(attr,t(value));}
 }
}
