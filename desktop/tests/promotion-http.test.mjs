import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';import {createPromotionHttpServer} from '../license-service/promotion-http.mjs';
test('redemption HTTP enforces first-party origin, exact route, request bounds and no secret-bearing errors',async()=>{
 const buckets=[],server=createPromotionHttpServer({rateSecret:'x'.repeat(32),promotions:{redeem:async(_request,{rateBucket})=>{buckets.push(rateBucket);throw Error('private-code-and-key');}}});server.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+server.address().port+'/api/desktop/redeem';
 try{const headers={'Content-Type':'application/json',Origin:'https://sorafiles.com'};
  assert.equal((await fetch(url,{method:'POST',body:'{}',headers:{...headers,Origin:'https://attacker.example'}})).status,403);
  assert.equal((await fetch(url,{method:'POST',body:'x'.repeat(12001),headers})).status,413);
  assert.equal((await fetch(url+'?code=anything',{method:'POST',body:'{}',headers})).status,404);
  for(const ip of ['1.2.3.4','5.6.7.8']){const response=await fetch(url,{method:'POST',body:'{}',headers:{...headers,'X-Forwarded-For':ip}});assert.equal(response.status,400);assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(!(await response.text()).includes('private'));}
  assert.equal(buckets[0],buckets[1]);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
