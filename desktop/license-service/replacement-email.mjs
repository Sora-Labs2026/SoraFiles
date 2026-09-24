import {randomBytes,randomInt,createHmac,timingSafeEqual} from 'node:crypto';
import {licensePlans} from '../shared/license-plans.mjs';
const reject=()=>Error('Email verification could not finish. Check the code or request a new one.');
const limited=()=>Object.assign(Error('Please wait before requesting another code.'),{httpStatus:429});
export function maskPurchaserEmail(email){
 if(typeof email!=='string'||email.length>254||!/^([^\s@<>]+)@([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,})$/i.test(email))throw Error('Purchaser email unavailable');
 const [local,domain]=email.split('@');return local[0]+'***@'+domain;
}
// All rows live in the existing license ledger, including limits across restarts.
// No raw email, code, key or verification token is retained in this table.
export class ReplacementEmailService {
 constructor({store,guard,dodo,authority,sendCode,now=()=>Math.floor(Date.now()/1000)}){
  if(typeof sendCode!=='function')throw Error('Replacement email delivery required');
  Object.assign(this,{store,guard,dodo,authority,sendCode,now});
 }
 hash(kind,value){return createHmac('sha256',this.guard.secret).update('sorafiles-replacement-email-v1\n'+kind+'\n'+value).digest('hex');}
 async start({licenseKey},deviceId){
  const now=this.now(),keyHash=this.guard.activationFingerprint(licenseKey),db=this.store.db;
  // The key fingerprint must identify a completed first-party activation. It
  // cannot select an arbitrary Dodo customer, email or license supplied by UI.
  const rows=db.prepare("SELECT DISTINCT license_ref,customer_id FROM activation_attempts WHERE key_hash=? AND license_ref IS NOT NULL AND status IN ('complete','blocked')").all(keyHash);
  if(rows.length!==1)throw reject();
  const {license_ref:ref,customer_id:customerId}=rows[0],binding=this.store.binding(ref);
  if(!binding||binding.customer_id!==customerId)throw reject();
  const valid=await this.dodo.validate(licenseKey);if(valid?.valid!==true)throw reject();
  const state=await this.authority.resolve({customerId,licenseRef:ref});
  if(state.ref!==ref||state.status!=='active'||!licensePlans[state.plan]||(state.periodEnd!==null&&state.periodEnd<=now))throw reject();
  this.store.sync(state);
  const customer=await this.dodo.customer(customerId);
  if(customer?.customer_id!==customerId)throw reject();
  const maskedEmail=maskPurchaserEmail(customer.email),verificationId=randomBytes(32).toString('base64url');
  const code=String(randomInt(0,100000000)).padStart(8,'0'),expiresAt=now+600;
  this.store.transaction(()=>{
   db.prepare('DELETE FROM replacement_email WHERE created<? AND (token_expires IS NULL OR token_expires<?)').run(now-86400,now);
   const recent=db.prepare('SELECT created FROM replacement_email WHERE (license_ref=? OR device_id=?) AND created>? ORDER BY created DESC').all(ref,deviceId,now-3600);
   if(recent.length>=3||recent.some(row=>row.created>now-60))throw limited();
   const customerCount=db.prepare('SELECT COUNT(*) AS n FROM replacement_email WHERE customer_id=? AND created>?').get(customerId,now-3600).n;
   if(customerCount>=6)throw limited();
   // Resend invalidates earlier unconsumed codes for this proved device only.
   db.prepare('UPDATE replacement_email SET expires=0 WHERE license_ref=? AND device_id=? AND verified IS NULL').run(ref,deviceId);
   db.prepare('INSERT INTO replacement_email(id,license_ref,customer_id,device_id,key_hash,code_hash,created,expires,attempts) VALUES(?,?,?,?,?,?,?,?,0)').run(verificationId,ref,customerId,deviceId,keyHash,this.hash('code',verificationId+'\n'+code),now,expiresAt);
  });
  try{await this.sendCode({to:customer.email,code,expiresAt,requestId:verificationId});}
  catch{db.prepare('UPDATE replacement_email SET expires=0 WHERE id=?').run(verificationId);throw Object.assign(Error('Verification email could not be sent. Please try again later.'),{code:'providerUnavailable'});}
  return {verificationId,maskedEmail,expiresAt,resendAfter:now+60};
 }
 verify({verificationId,code},deviceId){
  const now=this.now(),db=this.store.db,token=randomBytes(32).toString('base64url');
  const result=this.store.transaction(()=>{
   const row=db.prepare('SELECT * FROM replacement_email WHERE id=?').get(verificationId);
   if(!row||row.device_id!==deviceId||row.expires<=now||row.verified!==null||row.attempts>=5)return null;
   // Incorrect attempts commit, rather than being undone by an exception.
   db.prepare('UPDATE replacement_email SET attempts=attempts+1 WHERE id=?').run(verificationId);
   const expected=Buffer.from(row.code_hash,'hex'),actual=Buffer.from(this.hash('code',verificationId+'\n'+code),'hex');
   if(!/^\d{8}$/.test(code)||!timingSafeEqual(expected,actual))return null;
   const license=db.prepare('SELECT * FROM licenses WHERE ref=?').get(row.license_ref);
   if(!license||license.status!=='active'||(license.period_end!==null&&license.period_end<=now))return null;
   const expiresAt=now+1800;
   db.prepare('UPDATE replacement_email SET verified=?,code_hash=?,token_hash=?,token_expires=? WHERE id=?').run(now,'',this.hash('token',token),expiresAt,verificationId);
   return {identityToken:token,licenseRef:row.license_ref,plan:license.plan,expiresAt,devices:this.store.devices(row.license_ref).filter(d=>d.active&&d.device_id!==deviceId).map(d=>({id:d.device_id,current:false,active:true}))};
  });
  if(!result)throw reject();return result;
 }
 // A verified token is scoped to this device/key/license and a single occupied
 // seat. Replays only resume that same replacement; they cannot buy another one.
 identity(token,{licenseRef,deviceId,oldDeviceId,keyHash}){
  const now=this.now();if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw reject();
  return this.store.transaction(()=>{
   const row=this.store.db.prepare('SELECT * FROM replacement_email WHERE token_hash=?').get(this.hash('token',token));
   if(!row||row.verified===null||row.token_expires<=now||row.license_ref!==licenseRef||row.device_id!==deviceId||row.key_hash!==keyHash||row.old_device&&row.old_device!==oldDeviceId)throw reject();
   if(!/^[A-Za-z0-9_-]{43}$/.test(oldDeviceId))throw reject();
   this.store.db.prepare('UPDATE replacement_email SET old_device=? WHERE id=? AND old_device IS NULL').run(oldDeviceId,row.id);
   return {verified:true,customerId:row.customer_id};
  });
 }
}
