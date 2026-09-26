import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import worker from '../../worker.js';

const source=await readFile('src/lib/desktop/purchase-return.js','utf8');
function page(search,{clipboardFailure=false,historyFailure=false}={}){
 const events={},controls=new Map(),copied=[];let cleaned=false;
 for(const id of ['checkout-key','checkout-empty','license-value','license-reveal','license-copy','checkout-status'])controls.set(id,{hidden:id==='checkout-key'||id==='license-value',value:'',textContent:'',events:{},addEventListener(name,fn){this.events[name]=fn;},setAttribute(name,value){this[name]=value;}});
 runInNewContext(source,{URLSearchParams,location:{search,pathname:'/desktop/purchase'},history:{replaceState(_state,_title,path){assert.equal(path,'/desktop/purchase');if(historyFailure)throw Error('disabled');cleaned=true;}},document:{addEventListener(name,fn){events[name]=fn;},querySelector(selector){return controls.get(selector.slice(6,-1));}},addEventListener(name,fn){events[name]=fn;},navigator:{clipboard:{async writeText(value){if(clipboardFailure)throw Error('blocked');copied.push(value);}}}});
 assert.equal(cleaned,!historyFailure);events.DOMContentLoaded();
 return {get:id=>controls.get(id),copied,leave:()=>events.pagehide()};
}
test('return page removes query before initialization, reveals only on request, copies and clears on leave',async()=>{
 const p=page('?status=succeeded&email=private@example.invalid&license_key=synthetic-key');
 assert.equal(p.get('checkout-key').hidden,false);assert.equal(p.get('license-value').value,'');
 p.get('license-reveal').events.click();assert.equal(p.get('license-value').value,'synthetic-key');
 await p.get('license-copy').events.click();assert.deepEqual(p.copied,['synthetic-key']);
 p.leave();assert.equal(p.get('license-value').value,'');assert.equal(p.get('checkout-key').hidden,true);
 await p.get('license-copy').events.click();assert.equal(p.copied.length,1);
});
test('status alone, duplicate keys, HTML, oversized keys and failed URL scrubbing expose no key',()=>{
 for(const query of ['?status=succeeded','?license_key=abc123&license_key=def456','?license_key=%3Cscript%3Ealert(1)%3C/script%3E','?license_key='+ 'x'.repeat(513)])assert.equal(page(query).get('checkout-key').hidden,true);
 assert.equal(page('?license_key=synthetic-key',{historyFailure:true}).get('checkout-key').hidden,true);
});
test('clipboard denial offers manual copy without losing the key',async()=>{
 const p=page('?license_key=synthetic-key',{clipboardFailure:true});await p.get('license-copy').events.click();
 assert.match(p.get('checkout-status').textContent,/Show key/);p.get('license-reveal').events.click();assert.equal(p.get('license-value').value,'synthetic-key');
});
test('checkout HTML bypasses caching, suppresses referrers and strips queries before the asset service',async()=>{
 for(const path of ['/desktop/purchase','/desktop/purchase/','/desktop/purchase/index.html','/desktop/redeem','/desktop/redeem/','/desktop/redeem/index.html']){
  let assetRequest;
  const response=await worker.fetch(new Request('https://sorafiles.com'+path+'?license_key=synthetic-key&email=test@example.invalid'),{ASSETS:{fetch:async request=>{assetRequest=request;return new Response('<html></html>',{headers:{'Content-Type':'text/html','Cache-Control':'public, max-age=300'}});}}});
  assert.equal(new URL(assetRequest.url).search,'');assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');assert.equal(response.headers.get('X-Robots-Tag'),'noindex, nofollow, noarchive');
 }
});
