import {randomBytes,randomInt,createHmac,timingSafeEqual} from 'node:crypto';
import {licensePlans} from '../shared/license-plans.mjs';
// `reason` is a fixed, non-sensitive code the transport may return so Desktop can
// show a specific message. It never carries addresses, codes or provider text.
const reject=(reason='code-invalid')=>Object.assign(Error('Email verification could not finish. Check the code or request a new one.'),{reason});
const limited=(reason='email-rate-limited')=>Object.assign(Error('Please wait before requesting another code.'),{httpStatus:429,reason});
const unverified=()=>reject('license-unverified');
export function normalizePurchaserEmail(value){
 if(typeof value!=='string')return null;
 const email=value.normalize('NFKC').trim().toLowerCase();
 return email.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)?email:null;
}
export function maskPurchaserEmail(email){
 if(typeof email!=='string'||email.length>254||!/^([^\s@<>]+)@([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,})$/i.test(email))throw Error('Purchaser email unavailable');
 const [local,domain]=email.split('@');return local[0]+'***@'+domain;
}
// All rows live in the existing license ledger, including limits across restarts.
// No raw email, code, key or verification token is retained in these tables.
export class ReplacementEmailService {
 constructor({store,guard,dodo,authority,sendCode,now=()=>Math.floor(Date.now()/1000)}){
  if(typeof sendCode!=='function')throw Error('Replacement email delivery required');
  Object.assign(this,{store,guard,dodo,authority,sendCode,now});
  store.db.exec('CREATE TABLE IF NOT EXISTS replacement_email_misses(license_ref TEXT NOT NULL,device_id TEXT NOT NULL,created INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS replacement_email_misses_created ON replacement_email_misses(license_ref,created);');
 }
 hash(kind,value){return createHmac('sha256',this.guard.secret).update('sorafiles-replacement-email-v1\n'+kind+'\n'+value).digest('hex');}
 // Cooldown, hourly send limits and wrong-email limits. Failed deliveries count
 // as sends, so a broken mail provider cannot be hammered from the UI.
 assertCanSend(ref,customerId,deviceId,now){
  const db=this.store.db;
  db.prepare('DELETE FROM replacement_email WHERE created<? AND (token_expires IS NULL OR token_expires<?)').run(now-86400,now);
  db.prepare('DELETE FROM replacement_email_misses WHERE created<?').run(now-86400);
  if(db.prepare('SELECT COUNT(*) AS n FROM replacement_email_misses WHERE (license_ref=? OR device_id=?) AND created>?').get(ref,deviceId,now-3600).n>=5)throw limited('email-attempts');
  const recent=db.prepare('SELECT created FROM replacement_email WHERE (license_ref=? OR device_id=?) AND created>? ORDER BY created DESC').all(ref,deviceId,now-3600);
  if(recent.some(row=>row.created>now-60))throw limited('email-cooldown');
  if(recent.length>=3)throw limited();
  if(db.prepare('SELECT COUNT(*) AS n FROM replacement_email WHERE customer_id=? AND created>?').get(customerId,now-3600).n>=6)throw limited();
 }
 // A code is sent only after the person types the purchase email and the server
 // matches it to the authoritative Dodo customer for this license. Resend is the
 // same explicit request with the same email; it supersedes the previous code.
 async start({licenseKey,email},deviceId){
  const now=this.now(),keyHash=this.guard.activationFingerprint(licenseKey),db=this.store.db;
  const entered=normalizePurchaserEmail(email);if(!entered)throw reject('email-required');
  // The key fingerprint must identify a completed first-party activation. It
  // cannot select an arbitrary Dodo customer, email or license supplied by UI.
  const rows=db.prepare("SELECT DISTINCT license_ref,customer_id FROM activation_attempts WHERE key_hash=? AND license_ref IS NOT NULL AND status IN ('complete','blocked')").all(keyHash);
  if(rows.length!==1)throw unverified();
  const {license_ref:ref,customer_id:customerId}=rows[0],binding=this.store.binding(ref);
  if(!binding||binding.customer_id!==customerId)throw unverified();
  // Local limits run before provider I/O, so repeated guesses or clicks cannot
  // reach Dodo or the mail provider.
  this.store.transaction(()=>this.assertCanSend(ref,customerId,deviceId,now));
  const valid=await this.dodo.validate(licenseKey);if(valid?.valid!==true)throw unverified();
  const state=await this.authority.resolve({customerId,licenseRef:ref});
  if(state.ref!==ref||state.status!=='active'||!licensePlans[state.plan]||(state.periodEnd!==null&&state.periodEnd<=now))throw unverified();
  this.store.sync(state);
  const customer=await this.dodo.customer(customerId);
  if(customer?.customer_id!==customerId)throw unverified();
  const purchaser=normalizePurchaserEmail(customer.email);if(!purchaser)throw unverified();
  if(!timingSafeEqual(Buffer.from(this.hash('email',purchaser),'hex'),Buffer.from(this.hash('email',entered),'hex'))){
   db.prepare('INSERT INTO replacement_email_misses(license_ref,device_id,created) VALUES(?,?,?)').run(ref,deviceId,now);
   throw reject('email-mismatch');
  }
  const maskedEmail=maskPurchaserEmail(customer.email),verificationId=randomBytes(32).toString('base64url');
  const code=String(randomInt(0,100000000)).padStart(8,'0'),expiresAt=now+600;
  this.store.transaction(()=>{
   this.assertCanSend(ref,customerId,deviceId,now);
   // Resend invalidates earlier unconsumed codes for this proved device only.
   db.prepare('UPDATE replacement_email SET expires=0 WHERE license_ref=? AND device_id=? AND verified IS NULL').run(ref,deviceId);
   db.prepare('INSERT INTO replacement_email(id,license_ref,customer_id,device_id,key_hash,code_hash,created,expires,attempts) VALUES(?,?,?,?,?,?,?,?,0)').run(verificationId,ref,customerId,deviceId,keyHash,this.hash('code',verificationId+'\n'+code),now,expiresAt);
  });
  try{await this.sendCode({to:customer.email,code,expiresAt,requestId:verificationId});}
  catch{db.prepare('UPDATE replacement_email SET expires=0 WHERE id=?').run(verificationId);throw Object.assign(Error('Verification email could not be sent. Please try again later.'),{code:'providerUnavailable',reason:'email-delivery-failed'});}
  return {verificationId,maskedEmail,expiresAt,resendAfter:now+60};
 }
 verify({verificationId,code},deviceId){
  const now=this.now(),db=this.store.db,token=randomBytes(32).toString('base64url');
  const result=this.store.transaction(()=>{
   const row=db.prepare('SELECT * FROM replacement_email WHERE id=?').get(verificationId);
   if(!row||row.device_id!==deviceId)return {reason:'code-invalid'};
   if(row.verified!==null)return {reason:'code-used'};
   if(row.expires===0)return {reason:'code-superseded'};
   if(row.expires<=now)return {reason:'code-expired'};
   if(row.attempts>=5)return {reason:'code-locked'};
   // Incorrect attempts commit, rather than being undone by an exception.
   db.prepare('UPDATE replacement_email SET attempts=attempts+1 WHERE id=?').run(verificationId);
   const expected=Buffer.from(row.code_hash,'hex'),actual=Buffer.from(this.hash('code',verificationId+'\n'+code),'hex');
   if(!/^\d{8}$/.test(code)||!timingSafeEqual(expected,actual))return {reason:row.attempts+1>=5?'code-locked':'code-invalid'};
   const license=db.prepare('SELECT * FROM licenses WHERE ref=?').get(row.license_ref);
   if(!license||license.status!=='active'||(license.period_end!==null&&license.period_end<=now))return {reason:'license-unverified'};
   const expiresAt=now+1800;
   db.prepare('UPDATE replacement_email SET verified=?,code_hash=?,token_hash=?,token_expires=? WHERE id=?').run(now,'',this.hash('token',token),expiresAt,verificationId);
   return {identityToken:token,licenseRef:row.license_ref,plan:license.plan,expiresAt,devices:this.store.devices(row.license_ref).filter(d=>d.active).map(d=>({id:d.device_id,current:d.device_id===deviceId,active:true}))};
  });
  if(result.reason)throw reject(result.reason);return result;
 }
 // A verified token is scoped to this device/key/license and a single occupied
 // seat. Replays only resume that same replacement; they cannot buy another one.
 identity(token,{licenseRef,deviceId,oldDeviceId,keyHash}){
  const now=this.now();if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw reject();
  return this.store.transaction(()=>{
   const row=this.store.db.prepare('SELECT * FROM replacement_email WHERE token_hash=?').get(this.hash('token',token));
   if(!row||row.verified===null||row.token_expires<=now||row.license_ref!==licenseRef||row.device_id!==deviceId||row.key_hash!==keyHash||row.old_device&&row.old_device!==oldDeviceId)throw reject();
   if(!/^[A-Za-z0-9_-]{43}$/.test(oldDeviceId))throw reject();
   const active=this.store.active(licenseRef,oldDeviceId);
   // Bind verification to this activation, not the reusable device identity.
   // Previously consumed tokens from before this migration need a new OTP.
   if((row.old_device&&!row.old_instance)||(!row.old_instance&&!active)||(row.old_instance&&active&&row.old_instance!==active.instance_id))throw reject();
   const instanceId=row.old_instance??active.instance_id;
   this.store.db.prepare('UPDATE replacement_email SET old_device=?,old_instance=? WHERE id=? AND old_device IS NULL').run(oldDeviceId,instanceId,row.id);
   return {verified:true,customerId:row.customer_id,instanceId};
  });
 }
}
