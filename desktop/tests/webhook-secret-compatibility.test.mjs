import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHmac} from 'node:crypto';
import {decodeWebhookSecret,verifyDodoWebhook} from '../license-service/signing.mjs';

test('Dodo 24-byte webhook secrets authenticate payloads and reject tampering',()=>{
 const key=randomBytes(24),secret='whsec_'+key.toString('base64'),now=1800000000,id='msg-dodo-compat';
 const raw=Buffer.from('{"type":"payment.succeeded","data":{}}');
 const headers={'webhook-id':id,'webhook-timestamp':String(now),'webhook-signature':'v1,'+createHmac('sha256',key).update(`${id}.${now}.`).update(raw).digest('base64')};
 assert.equal(verifyDodoWebhook(raw,headers,secret,{now}).id,id);
 assert.throws(()=>verifyDodoWebhook(Buffer.from('{}'),headers,secret,{now}),/signature/);
 assert.throws(()=>verifyDodoWebhook(raw,headers,secret,{now:now+301}),/webhook/);
 assert.throws(()=>verifyDodoWebhook(raw,headers,'whsec_'+randomBytes(24).toString('base64'),{now}),/signature/);
});

test('webhook secret decoding accepts standard sizes and refuses malformed keys',()=>{
 for(const size of [24,32,64]){const bytes=randomBytes(size);assert.deepEqual(decodeWebhookSecret('whsec_'+bytes.toString('base64')),bytes);}
 for(const size of [0,16,23,65])assert.throws(()=>decodeWebhookSecret('whsec_'+randomBytes(size).toString('base64')));
 for(const value of [null,{},'whsec_%%%%','whsec_'+randomBytes(24).toString('base64')+'!'])assert.throws(()=>decodeWebhookSecret(value));
});
