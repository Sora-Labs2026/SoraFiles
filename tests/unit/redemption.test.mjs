import test from 'node:test';import assert from 'node:assert/strict';
import {mountRedemption} from '../../src/lib/desktop/redemption.js';
function fixture({enabled=true,rejectSession=false,badResult=false}={}){
 const controls=new Map(),calls=[],events={},copied=[];
 const control=()=>({value:'',hidden:true,disabled:false,textContent:'',events:{},addEventListener(name,fn){this.events[name]=fn;},setAttribute(name,value){this[name]=value;}});
 for(const name of ['form','status','result','key','reveal','copy','details'])controls.set(name,control());
 const code=control(),submit=control();code.value='SORA-SYNTHETIC-CODE';controls.get('form').querySelector=selector=>selector.includes('submit')?submit:code;
 const document={querySelector(selector){if(selector==='[data-redemption-enabled]')return {dataset:{redemptionEnabled:String(enabled)}};return controls.get(selector.slice(17,-1));}};
 const request=async(path,options)=>{calls.push({path,options,body:JSON.parse(options.body)});if(path.endsWith('session'))return new Response(JSON.stringify({identityToken:'verified-synthetic-token'}),{status:rejectSession?503:200,headers:{'Content-Type':'application/json'}});return Response.json({licenseKey:badResult?'<script>':'synthetic-license-key',edition:'Personal',maxDevices:1,expiresAt:null,emailSent:false});};
 mountRedemption(document,{request,clipboard:{writeText:async value=>copied.push(value)},listen:(name,fn)=>{events[name]=fn;}});
 return {controls,calls,events,copied,code,submit:()=>controls.get('form').events.submit({preventDefault(){}})};
}
test('redemption proves identity before submitting code, offers explicit key reveal and clears on departure',async()=>{
 const f=fixture();await f.submit();assert.equal(f.calls.length,2);assert.deepEqual(f.calls[0].body,{});assert.deepEqual(f.calls[1].body,{code:'SORA-SYNTHETIC-CODE',identityToken:'verified-synthetic-token'});
 for(const {options} of f.calls){assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');assert.equal(options.referrerPolicy,'no-referrer');}
 assert.equal(f.code.value,'');assert.equal(f.controls.get('key').value,'');assert.equal(f.controls.get('result').hidden,false);
 f.controls.get('reveal').events.click();assert.equal(f.controls.get('key').value,'synthetic-license-key');await f.controls.get('copy').events.click();assert.deepEqual(f.copied,['synthetic-license-key']);
 f.events.pagehide();assert.equal(f.controls.get('key').value,'');assert.equal(f.controls.get('result').hidden,true);await f.controls.get('copy').events.click();assert.equal(f.copied.length,1);
});
test('disabled redemption makes no request and missing identity cannot submit a code',async()=>{
 const disabled=fixture({enabled:false});assert.equal(disabled.controls.get('form').events.submit,undefined);assert.equal(disabled.calls.length,0);
 const f=fixture({rejectSession:true});await f.submit();assert.equal(f.calls.length,1);assert.equal(f.controls.get('result').hidden,true);assert.match(f.controls.get('status').textContent,/not ready/);
});
test('untrusted license responses never render as a successful redemption',async()=>{
 const f=fixture({badResult:true});await f.submit();assert.equal(f.controls.get('result').hidden,true);assert.equal(f.controls.get('key').value,'');assert.match(f.controls.get('status').textContent,/Invalid/);
});
