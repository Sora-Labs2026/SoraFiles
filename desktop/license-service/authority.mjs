import {plans,verifiedCatalog} from '../shared/plans.mjs';

// Translate only freshly fetched Dodo state. Caller-provided plan, price, status and
// redirect query parameters are deliberately absent from this API.
export class DodoAuthority {
 constructor({dodo,catalog,promotions=null,now=()=>Math.floor(Date.now()/1000)}){this.dodo=dodo;this.catalog=verifiedCatalog(catalog);this.promotions=promotions;this.now=now;}
 async resolve({customerId,licenseRef}){
  const promo=await this.promotions?.resolve({customerId,licenseRef});if(promo)return promo;
  const grants=await this.dodo.customerGrants(customerId);
  const matches=grants.filter(g=>g.customer_id===customerId&&g.integration_type==='license_key'&&g.license_key?.id===licenseRef);
  if(matches.length!==1)throw Error('License grant unavailable');const grant=matches[0];
  const row=this.catalog.find(p=>p.entitlementId===grant.entitlement_id);if(!row)throw Error('Unknown product entitlement');
  const plan=plans[row.id],now=this.now(),key=grant.license_key;
  if(key.activations_limit!==plan.maxDevices)throw Error('Dodo device limit mismatch');
  let status=grant.status==='Revoked'||key.status==='expired'?'revoked':grant.status==='Delivered'&&key.status==='active'?'active':'inactive';
  let periodEnd=null;
  if(plan.interval!=='lifetime'){
   if(!grant.subscription_id)throw Error('Subscription missing');const sub=await this.dodo.subscription(grant.subscription_id);
   if(sub.subscription_id!==grant.subscription_id||sub.customer?.customer_id!==customerId||sub.product_id!==row.productId)throw Error('Subscription identity mismatch');
   periodEnd=Math.floor(Date.parse(sub.next_billing_date)/1000);if(!Number.isSafeInteger(periodEnd))throw Error('Subscription period missing');
   if(sub.status!=='active'||periodEnd<=now)status='inactive';
  }else if(grant.subscription_id||key.expires_at)throw Error('Lifetime configuration must be permanent');
  if(key.expires_at){const expires=Math.floor(Date.parse(key.expires_at)/1000);if(!Number.isSafeInteger(expires))throw Error('Invalid Dodo license expiry');periodEnd=Math.min(periodEnd,expires);if(expires<=now)status='inactive';}
  return {ref:licenseRef,plan:plan.id,status,periodEnd,observedAt:now};
 }
}
