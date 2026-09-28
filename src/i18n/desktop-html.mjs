import {parse} from 'parse5';
const attributes=new Set(['aria-label','title','placeholder','alt']);
export function desktopTextEntries(html){
 const entries=[];
 function walk(node,skip=false){
  skip=skip||['script','style','svg','code','textarea'].includes(node.tagName)||(node.attrs||[]).some(a=>a.name==='translate'&&a.value==='no'||a.name==='data-user-text'||a.name==='class'&&a.value.split(/\s+/).includes('prototype-language'));
  const location=node.sourceCodeLocation;
  if(!skip&&node.nodeName==='#text'&&location){const text=node.value.trim();if(text&&/[a-zA-Z]/.test(text)&&!['SoraFiles','SoraFiles Desktop','Sora Labs'].includes(text)&&!/^\S+\.(pdf|png|jpg|docx)$/i.test(text)&&!/^\w{40,}$/.test(text))entries.push({text,start:location.startOffset,end:location.endOffset,kind:'text',raw:node.value});}
  if(!skip)for(const attr of node.attrs||[]){const loc=location?.attrs?.[attr.name];if(loc&&(attributes.has(attr.name)||(node.tagName==='meta'&&attr.name==='content'&&(node.attrs||[]).some(a=>['description','og:title','og:description','twitter:title','twitter:description'].includes(a.value)))))entries.push({text:attr.value,start:loc.startOffset,end:loc.endOffset,kind:'attribute',name:attr.name});}
  for(const child of node.childNodes||[])walk(child,skip);
 }
 walk(parse(html,{sourceCodeLocationInfo:true}));return entries;
}
export const escapeHtml=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function translateDesktopHtml(html,locale,catalog,routes){
 const changes=[];
 for(const entry of desktopTextEntries(html)){
  const value=catalog[entry.text];if(!value||value===entry.text)continue;
  changes.push({...entry,value:entry.kind==='attribute'?`${entry.name}="${escapeHtml(value)}"`:escapeHtml(entry.raw.replace(entry.text,value))});
 }
 // Only links to published page paths change. API routes, assets, downloads,
 // checkout URLs, fragments and query parameters keep their original meaning.
 // The language menu already points at each language's page; rewriting it would
 // send "English" back to the current language.
 const languageMenus=[...html.matchAll(/<details class="prototype-language"[\s\S]*?<\/details>/g)].map(m=>[m.index,m.index+m[0].length]);
 for(const match of html.matchAll(/\bhref="(\/[^"\s]*)"/g)){
  if(languageMenus.some(([start,end])=>match.index>=start&&match.index<end))continue;
  const href=match[1],base=href.split(/[?#]/)[0].replace(/\/$/,'')||'/';
  if(routes.includes(base))changes.push({start:match.index,end:match.index+match[0].length,value:`href="/${locale}${base==='/'?'':base}${href.slice(base==='/'?1:base.length)}"`});
 }
 for(const change of changes.sort((a,b)=>b.start-a.start))html=html.slice(0,change.start)+change.value+html.slice(change.end);
 return html;
}
