import test from 'node:test';
import assert from 'node:assert/strict';
import {DodoClient} from '../license-service/dodo.mjs';

// Shapes from Dodo's API reference: creation returns session_id, retrieval returns id.
test('checkout status exposes the retrieved session id as session_id',async()=>{
 const client=new DodoClient({apiKey:'test',request:async url=>{assert.match(url,/\/checkouts\/cks_123$/);return new Response(JSON.stringify({id:'cks_123',payment_id:'pay_1',payment_status:'processing',created_at:'2026-09-29T00:00:00Z',customer_email:null,customer_name:null}),{headers:{'content-type':'application/json'}});}});
 const status=await client.checkoutStatus('cks_123');
 assert.equal(status.session_id,'cks_123');assert.equal(status.id,'cks_123');assert.equal(status.payment_id,'pay_1');
});
