import test from 'node:test';import assert from 'node:assert/strict';import {amountInMinorUnits,verifyDodoProduct,fetchVerifiedCatalog} from '../license-service/catalog.mjs';import {plans} from '../shared/plans.mjs';
const product=(p,currency='EUR')=>({product_id:p.id,is_recurring:p.recurring,price:{currency,tax_inclusive:true,price:amountInMinorUnits(p.amount,currency),type:p.recurring?'recurring_price':'one_time_price',payment_frequency_count:1,payment_frequency_interval:p.interval==='monthly'?'Month':'Year'},entitlements:[{id:'ent-'+p.id,integration_type:'license_key',integration_config:{activations_limit:p.maxDevices,fulfillment_mode:'auto'}}]});
test('Dodo catalog rejects excluded capabilities in paid product or entitlement copy',()=>{
 const p=plans['personal-lifetime'],mapping={productId:p.id,entitlementId:'ent-'+p.id};
 for(const patch of [x=>x.name='Desktop Unlock PDF',x=>x.description='Remove PDF Password',x=>x.metadata={pdf_unlock:true},x=>x.entitlements[0].name='Decrypt PDF',x=>x.entitlements[0].integration_config.features={unlock_pdf:true}]){
  const item=product(p);patch(item);assert.throws(()=>verifyDodoProduct(p.id,item,mapping),/excluded Desktop capability/);
 }
 const item=product(p);item.description='Protect PDF and local file tools';assert.equal(verifyDodoProduct(p.id,item,mapping).plan,p.id);
});
test('all approved prices must include tax, including when the provider omits its tax setting',()=>{
 for(const p of Object.values(plans))for(const value of [false,undefined]){
  const item=product(p);item.price.tax_inclusive=value;
  assert.throws(()=>verifyDodoProduct(p.id,item,{productId:p.id,entitlementId:'ent-'+p.id}),/must include tax/);
 }
});
test('catalog reads currency from Dodo, checks all six exact prices and never creates checkout',async()=>{const config=Object.values(plans).map(p=>({plan:p.id,productId:p.id,entitlementId:'ent-'+p.id})),calls=[];const rows=await fetchVerifiedCatalog({product:async id=>{calls.push(id);return product(plans[id],'BHD');}},config);assert.equal(rows.length,6);assert.ok(rows.every(r=>r.currency==='BHD'));assert.equal(calls.length,6);assert.equal(amountInMinorUnits('4.99','BHD'),4990);assert.throws(()=>amountInMinorUnits('4.99','JPY'));});
test('price drift, wrong currency units, manual keys, unlimited seats and wrong billing intervals fail closed',()=>{const p=plans['personal-monthly'],mapping={productId:p.id,entitlementId:'ent-'+p.id};const patches=[x=>x.price.price++,x=>x.price.payment_frequency_interval='Year',x=>x.price.purchasing_power_parity=true,x=>x.price.discount_bps=100,x=>x.entitlements[0].integration_config.activations_limit=null,x=>x.entitlements[0].integration_config.fulfillment_mode='manual',x=>x.entitlements[0].integration_config.duration_count=30,x=>x.product_id='wrong'];for(const patch of patches){const item=product(p);patch(item);assert.throws(()=>verifyDodoProduct(p.id,item,mapping));}});
