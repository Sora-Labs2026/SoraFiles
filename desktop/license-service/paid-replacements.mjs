import {randomUUID} from 'node:crypto';
import {replacementPrice,replacementPrices} from '../shared/replacement-prices.mjs';
import {licensePlans} from '../shared/license-plans.mjs';
import {assertDesktopProductCopy} from './catalog.mjs';

const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const device=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const unavailable=()=>Object.assign(Error('Replacement is unavailable'),{code:'providerUnavailable'});
const pending=()=>Object.assign(Error('Replacement requires reconciliation'),{httpStatus:409});
const columns='id,license_ref,old_device,new_device,instance_id,key_hash,customer_id,plan,amount,currency,product_id,status,created,mode,requester_device';

// Separate one-time products: a replacement must never issue another license or
// inherit subscription/promotional pricing. Recheck the product before checkout.
export function verifyReplacementProduct(plan,product,productId){
 const price=replacementPrice(plan),p=product?.price;assertDesktopProductCopy(product);
 if(!id(productId)||product?.product_id!==productId||product.is_recurring!==false||p?.type!=='one_time_price'
  ||p.currency!=='USD'||p.price!==price.amount||p.tax_inclusive!==true||p.discount||p.discount_bps
  ||p.pay_what_you_want||p.purchasing_power_parity||p.trial_period_days||product.pricing_mode
  ||(product.entitlements?.length??0)!==0)throw Error('Replacement product configuration mismatch');
 return {...price,productId};
}

export class PaidReplacementService {
 constructor({store,guard,dodo,authority,verifyIdentity,products,now=()=>Math.floor(Date.now()/1000)}){
  Object.assign(this,{store,guard,dodo,authority,verifyIdentity,now});
  if(!products||Object.keys(products).length!==6||Object.keys(replacementPrices).some(plan=>!id(products[plan]))
   ||new Set(Object.values(products)).size!==6||typeof verifyIdentity!=='function')throw Error('Replacement configuration required');
  this.products=Object.freeze({...products});
 }
 row(orderId){return this.store.db.prepare('SELECT * FROM paid_replacements WHERE id=?').get(orderId);}
 public(row){return {orderId:row.id,status:row.status==='complete'?'complete':row.status==='paid'?'payment-confirmed':row.status==='failed'?'payment-failed':'payment-pending',fee:replacementPrice(row.plan),...(row.checkout_url?{checkoutUrl:row.checkout_url}:{}),...(row.status==='complete'?{replacementAuthorized:true,revokedInstanceId:row.instance_id}:{} )};}
 async owner(token,ref,context){
  const identity=await this.verifyIdentity(token,{licenseRef:ref,...context}),binding=this.store.binding(ref);
  if(!binding||identity?.customerId!==binding.customer_id||identity?.verified!==true)throw Error('License ownership required');
  const state=await this.authority.resolve({customerId:binding.customer_id,licenseRef:ref});
  if(state.ref!==ref||state.status!=='active')throw Error('License is not active');this.store.sync(state);
  const license=this.store.db.prepare('SELECT * FROM licenses WHERE ref=?').get(ref),plan=licensePlans[license?.plan];
  if(!plan||license.status!=='active'||(plan.interval!=='lifetime'&&license.period_end<=this.now()))throw Error('License is not active');
  return {license,customerId:binding.customer_id,approvedInstanceId:identity.instanceId};
 }
 async request(body,newDevice){
  const {licenseRef,oldDeviceId,licenseKey,identityToken}=body;
  if(!id(licenseRef)||!device(oldDeviceId)||!device(newDevice))throw Error('Invalid replacement');
  const keyHash=this.guard.activationFingerprint(licenseKey);
  const {license,customerId,approvedInstanceId}=await this.owner(identityToken,licenseRef,{deviceId:newDevice,oldDeviceId,keyHash});
  const price=verifyReplacementProduct(license.plan,await this.dodo.product(this.products[license.plan]),this.products[license.plan]);
  const result=this.store.transaction(()=>{
   const old=this.store.active(licenseRef,oldDeviceId);
   if(approvedInstanceId&&old&&approvedInstanceId!==old.instance_id)throw Error('Activation changed; verify email again');
   // Cancelled orders (and cancelled orders paid late, awaiting refund) never
   // block a new request for the same device.
   const previous=this.store.db.prepare("SELECT * FROM paid_replacements WHERE license_ref=? AND old_device=? AND status NOT IN ('cancelled','refund-required') AND (status<>'complete' OR instance_id=? OR ? IS NULL) ORDER BY created DESC,id DESC LIMIT 1").get(licenseRef,oldDeviceId,old?.instance_id??null,old?.instance_id??null);
   if(previous){if(previous.requester_device!==newDevice||previous.key_hash!==keyHash)throw Error('Replacement already pending');return {row:previous,created:false};}
   if(!old||!this.store.db.prepare('SELECT 1 FROM permanent_devices WHERE license_ref=? AND device_id=?').get(licenseRef,oldDeviceId)
    ||!this.store.db.prepare("SELECT 1 FROM activation_attempts WHERE license_ref=? AND device_id=? AND key_hash=? AND status='complete'").get(licenseRef,oldDeviceId,keyHash))throw Error('Completed activation required');
   if(this.store.db.prepare('SELECT 1 FROM support_replacements WHERE license_ref=? AND old_device=?').get(licenseRef,oldDeviceId))throw Error('Device already reserved');
   // Authority can change across product/identity I/O. Final checks are atomic.
   this.store.currentLicense(licenseRef,oldDeviceId,old.instance_id,this.now());
   if(old.plan!==license.plan)throw Error('License plan changed');
   const orderId=randomUUID();
   this.store.db.prepare(`INSERT INTO paid_replacements(${columns}) VALUES(?,?,?,?,?,?,?,?,?,?,?,'creating',?,'release',?)`)
    .run(orderId,licenseRef,oldDeviceId,null,old.instance_id,keyHash,customerId,license.plan,price.amount,price.currency,price.productId,this.now(),newDevice);
   return {row:this.row(orderId),created:true};
  });
  if(!result.created){if(result.row.status==='creating')throw pending();return this.public(result.row);}
  // Never blindly retry an ambiguous external creation. The durable creating row
  // preserves the seat and prevents a second checkout until operator reconciliation.
  const checkout=await this.dodo.replacementCheckout({productId:price.productId,customerId,orderId:result.row.id});
  let url;try{url=new URL(checkout?.checkout_url);}catch{throw pending();}
  if(!id(checkout?.session_id)||url.protocol!=='https:'||!['checkout.dodopayments.com','test.checkout.dodopayments.com'].includes(url.hostname)||url.username||url.password||url.port)throw pending();
  this.store.db.prepare("UPDATE paid_replacements SET checkout_id=?,checkout_url=?,status='pending' WHERE id=? AND status='creating'").run(checkout.session_id,url.href,result.row.id);
  return this.public(this.row(result.row.id));
 }
 // Called only with freshly retrieved provider state, never client JSON or a
 // redirect. Exact customer, session, product, quantity, currency and paid amount
 // are all required; any discount/refund/dispute prevents authorization.
 applyPayment(payment){
  const orderId=payment?.metadata?.sorafiles_replacement;if(!id(orderId))return false;
  return this.store.transaction(()=>{
   const row=this.row(orderId);if(!row)return false;
   if(!id(payment.payment_id)||payment.checkout_session_id!==row.checkout_id||payment.customer?.customer_id!==row.customer_id
    ||payment.currency!==row.currency||payment.total_amount!==row.amount||payment.subscription_id||payment.is_update_payment_method===true
    ||payment.product_cart?.length!==1||payment.product_cart[0].product_id!==row.product_id||payment.product_cart[0].quantity!==1
    ||payment.discount_id||payment.discount_ids?.length||payment.discounts?.length||payment.refund_status
    ||!Array.isArray(payment.refunds)||payment.refunds.length||!Array.isArray(payment.disputes)||payment.disputes.length)throw Error('Replacement payment mismatch');
   if(row.payment_id&&row.payment_id!==payment.payment_id)throw Error('Payment already associated');
   if(row.status==='complete'||row.status==='paid')return true;
   // A stale payment page paid after cancellation never revokes a device. Record
   // it once for an operator refund instead of retrying forever.
   if(row.status==='refund-required')return false;
   if(row.status==='cancelled'){
    if(payment.status==='succeeded')this.store.db.prepare("UPDATE paid_replacements SET status='refund-required',payment_id=?,paid=? WHERE id=? AND status='cancelled'").run(payment.payment_id,this.now(),row.id);
    return false;
   }
   if(!['pending','failed'].includes(row.status))throw pending();
   if(payment.status==='failed'||payment.status==='cancelled'){
    this.store.db.prepare("UPDATE paid_replacements SET status='failed' WHERE id=?").run(row.id);return false;
   }
   if(payment.status!=='succeeded')return false;
   const active=this.store.active(row.license_ref,row.old_device);
   if(!active||active.instance_id!==row.instance_id||this.store.db.prepare('SELECT 1 FROM support_replacements WHERE license_ref=? AND (old_device=? OR new_device=?)').get(row.license_ref,row.old_device,row.new_device))throw Error('Replacement binding changed');
   this.store.db.prepare("UPDATE paid_replacements SET status='paid',payment_id=?,paid=? WHERE id=?").run(payment.payment_id,this.now(),row.id);
   this.store.db.prepare('UPDATE devices SET active=0 WHERE license_ref=? AND device_id=?').run(row.license_ref,row.old_device);
   this.store.db.prepare("UPDATE activation_attempts SET status='blocked' WHERE license_ref=? AND device_id=?").run(row.license_ref,row.old_device);
   return true;
  });
 }
 async status(body,newDevice){
  const {orderId,identityToken,licenseKey}=body;if(!id(orderId))throw Error('Invalid replacement');
  const row=this.row(orderId);if(!row||row.requester_device!==newDevice||row.key_hash!==this.guard.activationFingerprint(licenseKey))throw Error('Replacement unavailable');
  // Checkout creation consumed purchaser verification. The same proved device
  // and key can resume this one order after the short-lived OTP token expires;
  // this cannot create another checkout or select a different seat.
  if(row.status==='complete')return this.public(row);
  if(row.status==='creating')throw pending();
  const checkout=await this.dodo.checkoutStatus(row.checkout_id);
  if(checkout?.session_id!==row.checkout_id)throw Error('Checkout identity mismatch');
  if(checkout.payment_id){const payment=await this.dodo.payment(checkout.payment_id);if(payment?.payment_id!==checkout.payment_id)throw Error('Payment identity mismatch');this.applyPayment(payment);}
  if(this.row(row.id).status==='paid')await this.finishRelease(this.row(row.id),licenseKey);
  return this.public(this.row(row.id));
 }
 // Cancels an unpaid order for the same proved device and key as status(). Dodo is
 // asked first: a completed payment always wins, and a payment still in progress
 // blocks cancellation so money is never taken without the revocation.
 async cancel(body,newDevice){
  const {orderId,licenseKey}=body;if(!id(orderId))throw Error('Invalid replacement');
  const row=this.row(orderId);if(!row||row.requester_device!==newDevice||row.key_hash!==this.guard.activationFingerprint(licenseKey))throw Error('Replacement unavailable');
  if(row.status==='cancelled')return {orderId:row.id,status:'cancelled',fee:replacementPrice(row.plan)};
  if(row.status==='creating')throw pending();
  if(['pending','failed'].includes(row.status)){
   const checkout=await this.dodo.checkoutStatus(row.checkout_id);
   if(checkout?.session_id!==row.checkout_id)throw Error('Checkout identity mismatch');
   if(checkout.payment_id){
    const payment=await this.dodo.payment(checkout.payment_id);if(payment?.payment_id!==checkout.payment_id)throw Error('Payment identity mismatch');
    this.applyPayment(payment);
    if(!['succeeded','failed','cancelled'].includes(payment.status))throw Object.assign(Error('Payment in progress'),{httpStatus:409,reason:'payment-in-progress'});
   }
  }
  const current=this.row(row.id);
  if(current.status==='paid')await this.finishRelease(current,licenseKey);
  if(!['pending','failed'].includes(this.row(row.id).status))return this.public(this.row(row.id));
  this.store.db.prepare("UPDATE paid_replacements SET status='cancelled',completed=? WHERE id=? AND status IN ('pending','failed')").run(this.now(),row.id);
  return {orderId:row.id,status:'cancelled',fee:replacementPrice(row.plan)};
 }
 async providerKey(row){
  // Prefer current grants. Imported/older licenses may require the documented
  // single-license compatibility lookup. Raw keys remain in memory only.
  const grants=await this.dodo.customerGrants(row.customer_id);
  const matches=grants.filter(grant=>grant.customer_id===row.customer_id&&grant.integration_type==='license_key'&&grant.license_key?.id===row.license_ref);
  if(matches.length>1)throw Error('Replacement license identity mismatch');
  let key=matches[0]?.license_key?.key;
  if(typeof key!=='string'){
   const license=await this.dodo.licenseKey(row.license_ref);
   if(license?.id!==row.license_ref||license.customer_id!==row.customer_id)throw Error('Replacement license identity mismatch');
   key=license.key;
  }
  if(typeof key!=='string'||this.guard.activationFingerprint(key)!==row.key_hash)throw Error('Replacement license key mismatch');
  return key;
 }
 async finishRelease(row,providedKey){
  if(row.status!=='paid')return;
  const key=providedKey??await this.providerKey(row);
  if(this.guard.activationFingerprint(key)!==row.key_hash)throw Error('Replacement license key mismatch');
  const valid=await this.dodo.validate(key,row.instance_id);
  if(valid?.valid===true)await this.dodo.deactivate(key,row.instance_id);
  else if(valid?.valid!==false)throw unavailable();
  this.store.transaction(()=>{
   const current=this.row(row.id);if(current.status==='complete')return;
   if(current.status!=='paid')throw Error('Replacement state changed');
   this.store.db.prepare('DELETE FROM permanent_devices WHERE license_ref=? AND device_id=?').run(row.license_ref,row.old_device);
   this.store.db.prepare("UPDATE paid_replacements SET status='complete',completed=? WHERE id=?").run(this.now(),row.id);
  });
 }
 async reconcile(){
  let failed=false;
  for(const event of this.store.db.prepare('SELECT * FROM replacement_payment_events WHERE completed IS NULL ORDER BY received,id LIMIT 20').all()){
   try{const payment=await this.dodo.payment(event.payment_id);if(payment?.payment_id!==event.payment_id)throw Error('Payment identity mismatch');this.applyPayment(payment);
    this.store.db.prepare('UPDATE replacement_payment_events SET completed=? WHERE id=?').run(this.now(),event.id);
   }catch{failed=true;}
  }
  // Paid rows remain durable retry work even after webhook acknowledgement, OTP
  // expiry, closed apps, or an outage during provider deactivation.
  for(const row of this.store.db.prepare("SELECT * FROM paid_replacements WHERE status='paid' ORDER BY paid,id LIMIT 20").all()){
   try{await this.finishRelease(row);}catch{failed=true;}
  }
  if(failed)throw unavailable();
 }
}

// Persist only authenticated delivery/payment identifiers, never the payload.
export function queueReplacementEvent(store,id,event,now){
 if(!/^payment\.(succeeded|failed|cancelled)$/.test(event?.type??'')||!idSafePayment(event?.data?.payment_id))return;
 store.db.prepare('INSERT OR IGNORE INTO replacement_payment_events(id,payment_id,received) VALUES(?,?,?)').run(id,event.data.payment_id,now);
}
const idSafePayment=id;
