import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source=await readFile('public/sw.js','utf8');
function harness(){
 const handlers={},stores=new Map();let offline=false;
 const key=r=>typeof r==='string'?new URL(r,'https://sorafiles.com').href:r.url;
 const caches={open:async(name)=>{if(!stores.has(name))stores.set(name,new Map());const s=stores.get(name);return {put:async(r,v)=>s.set(key(r),v),match:async(r)=>s.get(key(r)),keys:async()=>[...s.keys()].map(url=>({url})),delete:async(r)=>s.delete(key(r)),add:async(r)=>s.set(key(r),new Response('cached'))};},keys:async()=>[...stores.keys()],delete:async n=>stores.delete(n),match:async(r)=>{for(const s of stores.values())if(s.has(key(r)))return s.get(key(r));}};
 vm.runInNewContext(source,{URL,Response,caches,fetch:async()=>{if(offline)throw new Error('offline');return new Response('network');},self:{location:{origin:'https://sorafiles.com'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}}});
 return {stores,setOffline:()=>offline=true,async request(path,mode='navigate',method='GET'){let response;const waits=[];handlers.fetch({request:{url:new URL(path,'https://sorafiles.com').href,mode,method,headers:new Headers()},respondWith:p=>response=p,waitUntil:p=>waits.push(p)});const result=await response;await Promise.all(waits);return result;}};
}
test('static assets cannot evict cached pages and navigation cannot trim assets',async()=>{
 const h=harness();await h.request('/rotate-pdf');for(let i=0;i<90;i++)await h.request(`/_astro/${i}.js`,'cors');
 assert.equal(h.stores.get('sorafiles-local-v5-pages').size,1);assert.equal(h.stores.get('sorafiles-local-v5-static').size,80);
 await h.request('/merge-pdf');assert.equal(h.stores.get('sorafiles-local-v5-static').size,80);
 h.setOffline();assert.equal((await h.request('/rotate-pdf')).status,200);assert.equal((await h.request('/never-visited')).type,'error');
});
test('file uploads and arbitrary document GETs are never cached',async()=>{
 const h=harness();assert.equal(await h.request('/process','cors','POST'),undefined);assert.equal(await h.request('/private.pdf','cors'),undefined);assert.equal(h.stores.size,0);
});

test('checkout returns and license-bearing URLs never enter navigation cache, including offline',async()=>{
 const h=harness();for(const path of ['/desktop/purchase','/desktop/purchase/','/desktop/purchase/index.html','/desktop/purchase?license_key=synthetic-key&email=test@example.invalid','/desktop/redeem','/desktop/redeem/','/desktop/redeem/index.html','/desktop/redeem?code=synthetic-code','/elsewhere?license_key=synthetic-key']){
  assert.equal(await h.request(path),undefined);
 }assert.equal(h.stores.size,0);h.setOffline();assert.equal(await h.request('/desktop/purchase'),undefined);
});
