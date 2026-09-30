import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { canonicalIndexableUrls } from '../src/lib/indexnow.ts';
const origin = process.argv[2] || 'http://localhost:4321';
const live = origin === 'https://sorafiles.com';
if (!live && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) throw new Error('Only production or local preview origins are allowed');
const output = `.artifacts/astra-crawl-${live ? 'live' : 'local'}.json`;
const decode = s => s.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m => [m[1],decode(m[2] ?? m[3])]));
const tags = (html,name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(m=>attrs(m[0]));
const plain = s => decode(s.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
const rows = [], resources = [], hosts = [], errors = [], queue = [], seen = new Set(), sitemapUrls = new Set();
const canonicalOrigin = 'https://sorafiles.com';
const enqueue = value => {
  try {
    const url = new URL(value,canonicalOrigin);
    if (url.origin !== canonicalOrigin || url.search || url.pathname.startsWith('/__') || /\.(?:png|jpg|webp|svg|ico|js|css|wasm|pdf|xml|txt|webmanifest)$/i.test(url.pathname)) return;
    url.hash=''; if(!seen.has(url.href)){ seen.add(url.href); queue.push(url.href); }
  } catch { /* Report malformed links on their source page. */ }
};
async function fetchChain(url) {
  const chain = [], started=performance.now(); let response;
  for(let i=0;i<6;i++) {
    response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(25000),headers:{'user-agent':'SoraFiles-Owner-QA/1.0'}});
    if (![301,302,303,307,308].includes(response.status)) return {response,chain,finalUrl:url,ttfbMs:Math.round(performance.now()-started)};
    const next=new URL(response.headers.get('location'),url).href; chain.push({url,status:response.status,to:next}); await response.body?.cancel();
    if(chain.some(item=>item.url===next)) throw new Error('Redirect loop'); url=next;
  }
  throw new Error('More than five redirects');
}
await mkdir('.artifacts',{recursive:true});
for(const hostname of ['sorafiles.com','www.sorafiles.com']) {
  if (!live) {hosts.push({hostname,evidence:'wrangler.jsonc custom domain',scope:'local preview does not test production hostname redirects'});continue;}
  try { const item=await fetchChain(`https://${hostname}/`); hosts.push({hostname,evidence:'wrangler.jsonc custom domain',status:item.response.status,canonicalHost:new URL(item.finalUrl).hostname,chain:item.chain}); await item.response.body?.cancel(); } catch(e){hosts.push({hostname,error:e.message});}
}
let robots='';
for(const path of ['/robots.txt','/sitemap.xml']) {
  try {const item=await fetchChain(origin+path),text=await item.response.text(); resources.push({path,status:item.response.status}); if(path==='/robots.txt') robots=text; else for(const m of text.matchAll(/<loc>([^<]+)<\/loc>/g)){const url=decode(m[1]);sitemapUrls.add(url);enqueue(url);}}
  catch(e){errors.push(`${path}: ${e.message}`);}
}
const disallowed = [...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map(m=>m[1]);
for(const url of canonicalIndexableUrls()) enqueue(url);
enqueue('/'); enqueue('/guides');
for(let i=0;i<queue.length;i++) {
  const url=queue[i],path=new URL(url).pathname;
  if(live && disallowed.some(prefix=>path.startsWith(prefix))){ rows.push({url,blockedByRobots:true});continue; }
  try {
    const item=await fetchChain(origin+path),html=await item.response.text(),links=tags(html,'link'),meta=tags(html,'meta'),anchor=tags(html,'a');
    const getMeta=key=>meta.find(m=>m.name===key||m.property===key)?.content ?? '';
    const schemas=[]; for(const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const parsed=JSON.parse(m[1]);schemas.push(...(Array.isArray(parsed)?parsed:parsed['@graph']||[parsed]));}catch{errors.push(`${url}: invalid JSON-LD`);}}
    const internal=[];
    for(const a of anchor){if(!a.href||a.href.startsWith('#'))continue;try{const target=new URL(a.href,url);if(target.origin===canonicalOrigin){internal.push(target.href);enqueue(target.href);}}catch{errors.push(`${url}: invalid href`);}}
    const canonical=links.find(l=>l.rel==='canonical')?.href;
    const hreflang=links.filter(l=>l.rel==='alternate'&&l.hreflang); for(const alternate of hreflang)enqueue(alternate.href);if(canonical)enqueue(canonical);
    rows.push({url,status:item.response.status,finalUrl:item.finalUrl,redirectChain:item.chain,contentType:item.response.headers.get('content-type'),ttfbMs:item.ttfbMs,canonical,robots:getMeta('robots'),xRobots:item.response.headers.get('x-robots-tag'),title:plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||''),description:getMeta('description'),h1:[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>plain(m[1])),hreflang,og:{url:getMeta('og:url'),title:getMeta('og:title'),description:getMeta('og:description')},schemaTypes:schemas.map(s=>s['@type']),internalLinks:internal,inSitemap:sitemapUrls.has(url),blockedByRobots:false});
  } catch(e){rows.push({url,error:e.message});}
  if((i+1)%50===0){console.log(`Crawled ${i+1}/${queue.length}`);await writeFile(output,JSON.stringify({origin,hosts,resources,rows,errors},null,2));}
  if(live) await new Promise(resolve=>setTimeout(resolve,250));
}
const byUrl=new Map(rows.map(r=>[r.url,r]));
for(const row of rows){if(!row.internalLinks)continue;row.brokenLinks=[];row.linksToRedirects=[];for(const href of row.internalLinks){const target=new URL(href);target.hash='';const match=byUrl.get(target.href);if(match?.status>=400)row.brokenLinks.push(href);if(match?.redirectChain?.length)row.linksToRedirects.push(href);}}
const canonicalRows=rows.filter(r=>r.status===200 && r.canonical===r.url && !/noindex/.test(r.robots));
for(const row of rows.filter(r=>r.inSitemap)) if(row.status!==200 || row.redirectChain?.length || row.canonical!==row.url || /noindex/.test(row.robots)||row.blockedByRobots)errors.push(`${row.url}: sitemap/indexability mismatch`);
const summary={hostsDiscovered:hosts.length,hostsTested:live?hosts.filter(h=>h.status).length:0,urlsDiscovered:queue.length,urlsFetched:rows.filter(r=>r.status).length,canonicalIndexableDiscovered:sitemapUrls.size,canonicalIndexableCrawled:canonicalRows.filter(r=>r.inSitemap).length,brokenLinks:rows.reduce((n,r)=>n+(r.brokenLinks?.length||0),0),linksToRedirects:rows.reduce((n,r)=>n+(r.linksToRedirects?.length||0),0),errors:errors.length};
await writeFile(output,JSON.stringify({date:new Date().toISOString(),origin,summary,hosts,resources,rows,errors},null,2));
console.log(JSON.stringify(summary));
if(errors.length||summary.urlsFetched<summary.urlsDiscovered)process.exitCode=1;
