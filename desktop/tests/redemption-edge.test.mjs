import test from 'node:test';import assert from 'node:assert/strict';
import {desktopRedemptionRequest} from '../../src/lib/desktop/redemption-edge.js';
const request=(path='redeem',options={})=>new Request('https://sorafiles.com/api/desktop/'+path,{method:'POST',headers:{Origin:'https://sorafiles.com','Content-Type':'application/json'},body:'{}',...options});
const result={licenseKey:'synthetic-key',edition:'Personal',maxDevices:1,expiresAt:null,emailSent:false};
const env=reply=>({DESKTOP_REDEMPTION:{fetch:async()=>reply}});
test('redemption website boundary returns only approved public fields and safe headers',async()=>{
 const response=await desktopRedemptionRequest(request(),env(Response.json({...result,licenseRef:'private',diagnostic:'secret'},{headers:{'Set-Cookie':'private=secret','X-Private':'secret','Location':'https://invalid.example/'}})));
 assert.equal(response.status,200);assert.deepEqual(await response.json(),result);
 for(const name of ['set-cookie','x-private','location'])assert.equal(response.headers.get(name),null);
 assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 const session=await desktopRedemptionRequest(request('redemption-session'),env(Response.json({identityToken:'synthetic-token',customer:'private'})));assert.deepEqual(await session.json(),{identityToken:'synthetic-token'});
});
test('redemption boundary refuses unconfigured, cross-origin, malformed or unsafe upstream responses',async()=>{
 assert.equal((await desktopRedemptionRequest(request(),{})).status,503);
 let calls=0;const service={DESKTOP_REDEMPTION:{fetch:()=>{calls++;throw Error('must not call');}}};
 assert.equal((await desktopRedemptionRequest(request('redeem',{headers:{Origin:'https://evil.invalid'}}),service)).status,403);
 assert.equal((await desktopRedemptionRequest(request('redeem?code=private'),service)).status,404);assert.equal(calls,0);
 for(const value of [{...result,maxDevices:5},{...result,licenseKey:'<unsafe>'},{...result,emailSent:true},[],null])assert.equal((await desktopRedemptionRequest(request(),env(Response.json(value)))).status,503);
 for(const upstream of [new Response('private',{status:500}),new Response(null,{status:302,headers:{Location:'https://evil.invalid'}}),new Response('x'.repeat(17000),{headers:{'Content-Type':'application/json'}}),new Response('private',{headers:{'Content-Type':'text/plain'}})]){
  const response=await desktopRedemptionRequest(request(),env(upstream));assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/secret|diagnostic|evil/);
 }
 const rate=await desktopRedemptionRequest(request(),env(Response.json({error:'private diagnostic'},{status:429})));assert.equal(rate.status,429);assert.doesNotMatch(await rate.text(),/diagnostic/);
});
