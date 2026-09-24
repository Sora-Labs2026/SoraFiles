// Server only. This module must never enter a desktop/client bundle.
export class DodoClient {
 constructor({apiKey,mode='test_mode',request=fetch}){if(!['test_mode','live_mode'].includes(mode))throw Error('Invalid Dodo environment');this.origin=mode==='test_mode'?'https://test.dodopayments.com':'https://live.dodopayments.com';this.key=apiKey;this.request=request;}
 async call(path,{body,privileged=false,method=body?'POST':'GET'}={}){if(privileged&&!this.key)throw Error('Dodo server credentials not configured');if(!path.startsWith('/')||path.includes('..'))throw Error('Invalid API path');
  let response;try{response=await this.request(this.origin+path,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',...(privileged?{Authorization:'Bearer '+this.key}:{})},...(body?{body:JSON.stringify(body)}:{})});}catch{throw Object.assign(Error('Dodo unavailable'),{code:'providerUnavailable'});}
  if(!response.ok)throw Object.assign(Error(response.status===429?'License service busy':'Dodo request failed'),{status:response.status,code:response.status===429||response.status>=500?'providerUnavailable':'providerRejected'});if(response.status===204)return null;const text=await response.text();return text?JSON.parse(text):null;
 }
 activate(licenseKey,deviceId){return this.call('/licenses/activate',{body:{license_key:licenseKey.trim(),name:'SoraFiles '+deviceId.slice(0,16)}});}
 validate(licenseKey,instanceId){return this.call('/licenses/validate',{body:{license_key:licenseKey.trim(),license_key_instance_id:instanceId}});}
 deactivate(licenseKey,instanceId){return this.call('/licenses/deactivate',{body:{license_key:licenseKey.trim(),license_key_instance_id:instanceId}});}
 subscription(id){return this.call('/subscriptions/'+encodeURIComponent(id),{privileged:true});}
 customer(id){return this.call('/customers/'+encodeURIComponent(id),{privileged:true});}
 product(id){return this.call('/products/'+encodeURIComponent(id),{privileged:true});}
 async customerGrants(customerId){const items=[];for(let page=0;page<100;page++){
  const result=await this.call('/customers/'+encodeURIComponent(customerId)+'/entitlement-grants?integration_type=license_key&page_size=100&page_number='+page,{privileged:true});
  if(!Array.isArray(result?.items)||result.items.length>100)throw Error('Invalid Dodo grants response');items.push(...result.items);if(result.items.length<100)return items;
 }throw Error('Dodo grants pagination limit');}
 checkout(productId,currency){if(!Intl.supportedValuesOf('currency').includes(currency))throw Error('Verified checkout currency required');return this.call('/checkouts',{privileged:true,body:{product_cart:[{product_id:productId,quantity:1}],billing_currency:currency,feature_flags:{allow_discount_code:true,allow_currency_selection:false},return_url:'https://sorafiles.com/desktop/purchase'}});}
 importLicense({customerId,productId,key,maxDevices,expiresAt}){return this.call('/license_keys',{privileged:true,body:{customer_id:customerId,product_id:productId,key,activations_limit:maxDevices,expires_at:expiresAt}});}
 async importedLicenses(customerId,productId){
  // Narrow compatibility fallback for imported-key recovery. Normal paid authority
  // uses the current customer-grants API. Remove when Dodo exposes equivalent import lookup.
  const items=[];for(let page=0;page<100;page++){
   const query=new URLSearchParams({customer_id:customerId,product_id:productId,source:'import',page_size:'100',page_number:String(page)});
   const result=await this.call('/license_keys?'+query,{privileged:true});
   if(!Array.isArray(result?.items)||result.items.length>100)throw Error('Invalid import lookup');items.push(...result.items);if(result.items.length<100)return items;
  }throw Error('Import lookup limit');
 }
 checkoutStatus(id){return this.call('/checkouts/'+encodeURIComponent(id),{privileged:true});}
 payment(id){return this.call('/payments/'+encodeURIComponent(id),{privileged:true});}
 replacementCheckout({productId,customerId,orderId}){return this.call('/checkouts',{privileged:true,body:{product_cart:[{product_id:productId,quantity:1}],customer:{customer_id:customerId},billing_currency:'USD',metadata:{sorafiles_replacement:orderId},feature_flags:{allow_discount_code:false,allow_currency_selection:false,allow_customer_editing_name:false,allow_customer_editing_email:false},return_url:'https://sorafiles.com/desktop/purchase'}});}
 portal(customerId){return this.call('/customers/'+encodeURIComponent(customerId)+'/customer-portal/session',{privileged:true,body:{}});}
}
