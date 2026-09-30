import {createHash,randomBytes,randomUUID,createCipheriv,createDecipheriv} from 'node:crypto';
import {promotionDurations,promotionalPlans} from '../shared/license-plans.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const unavailable=()=>Object.assign(Error('This code cannot be redeemed. Check your code or contact support.'),{code:'redemptionUnavailable'});
const pending=()=>Object.assign(Error('Your redemption is being prepared. Retry with the same verified account.'),{code:'redemptionPending'});
const exact=(value,keys)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw unavailable();};
const normalize=code=>{if(typeof code!=='string'||code.length>100)throw unavailable();const value=code.trim().toUpperCase();if(!/^SORA(?:-[A-F0-9]{8}){4}$/.test(value))throw unavailable();return value;};
const safeId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);

export class PromotionStore {
 constructor(store,{encryptionKey}){
  if(!Buffer.isBuffer(encryptionKey)||encryptionKey.length!==32)throw Error('Promotion encryption key must be 32 bytes');
  this.store=store;this.db=store.db;this.key=Buffer.from(encryptionKey);
  this.db.exec(`
   CREATE TABLE IF NOT EXISTS promo_campaigns(id TEXT PRIMARY KEY,name TEXT NOT NULL,plan TEXT NOT NULL,product_id TEXT NOT NULL,quantity INTEGER NOT NULL,starts INTEGER NOT NULL,ends INTEGER NOT NULL,enabled INTEGER NOT NULL,notes TEXT NOT NULL,created INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS promo_codes(hash TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES promo_campaigns(id));
   CREATE TABLE IF NOT EXISTS promo_redemptions(id TEXT PRIMARY KEY,code_hash TEXT UNIQUE NOT NULL REFERENCES promo_codes(hash),subject_hash TEXT NOT NULL,customer_id TEXT NOT NULL,key_box TEXT NOT NULL,expires INTEGER,created INTEGER NOT NULL,license_ref TEXT UNIQUE,state TEXT NOT NULL,lease_until INTEGER NOT NULL DEFAULT 0,lease_owner TEXT,revoked INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS promo_audit(sequence INTEGER PRIMARY KEY AUTOINCREMENT,campaign_id TEXT,redemption_id TEXT,event TEXT NOT NULL,created INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS promo_rates(bucket TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL);
  `);
 }
 seal(value,id){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);cipher.setAAD(Buffer.from(id));const bytes=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64url');}
 unseal(box,id){const b=Buffer.from(box,'base64url'),cipher=createDecipheriv('aes-256-gcm',this.key,b.subarray(0,12));cipher.setAAD(Buffer.from(id));cipher.setAuthTag(b.subarray(12,28));return Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]).toString('utf8');}
 audit(campaign,id,event,now){this.db.prepare('INSERT INTO promo_audit(campaign_id,redemption_id,event,created) VALUES(?,?,?,?)').run(campaign,id,event,now);}
 create(input,now){
  exact(input,['id','name','tier','duration','productId','quantity','starts','ends','enabled','notes']);
  const {id,name,tier,duration,productId,quantity,starts,ends,enabled=false,notes=''}=input;
  const plan=promotionalPlans[`promo-${String(tier).toLowerCase()}-${duration}`];
  if(!safeId(id)||typeof name!=='string'||!name.trim()||name.length>120||!plan||!safeId(productId)||!Number.isSafeInteger(quantity)||quantity<1||quantity>10000||!Number.isSafeInteger(starts)||!Number.isSafeInteger(ends)||starts>=ends||ends<=now||typeof enabled!=='boolean'||typeof notes!=='string'||notes.length>2000)throw Error('Invalid campaign');
  return this.store.transaction(()=>{
   this.db.prepare('INSERT INTO promo_campaigns VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,name,plan.id,productId,quantity,starts,ends,enabled?1:0,notes,now);
   const codes=[];for(let i=0;i<quantity;i++){
    const code='SORA-'+randomBytes(16).toString('hex').toUpperCase().match(/.{8}/g).join('-');
    this.db.prepare('INSERT INTO promo_codes VALUES(?,?)').run(hash(code),id);codes.push(code);
   }
   this.audit(id,null,'campaign-created',now);return codes;
  });
 }
 setEnabled(id,enabled,now){if(typeof enabled!=='boolean')throw Error('Invalid state');return this.store.transaction(()=>{if(this.db.prepare('UPDATE promo_campaigns SET enabled=? WHERE id=?').run(enabled?1:0,id).changes!==1)throw Error('Campaign missing');this.audit(id,null,enabled?'campaign-enabled':'campaign-disabled',now);});}
 list(){return this.db.prepare(`SELECT c.id,c.name,c.plan,c.quantity,c.starts,c.ends,c.enabled,c.created,COUNT(r.id) AS claimed,SUM(CASE WHEN r.state='ready' THEN 1 ELSE 0 END) AS ready FROM promo_campaigns c LEFT JOIN promo_codes k ON k.campaign_id=c.id LEFT JOIN promo_redemptions r ON r.code_hash=k.hash GROUP BY c.id ORDER BY c.created,c.id`).all();}
 takeRate(bucket,now){
  // Shared across SQLite connections/processes. Persist rejection counts too.
  const allowed=this.store.transaction(()=>{
   this.db.prepare('DELETE FROM promo_rates WHERE until<=?').run(now);
   const old=this.db.prepare('SELECT count FROM promo_rates WHERE bucket=?').get(bucket);
   if(!old&&this.db.prepare('SELECT COUNT(*) AS n FROM promo_rates').get().n>=10000)return false;
   this.db.prepare('INSERT INTO promo_rates VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1').run(bucket,now+60);
   return (old?.count||0)<6;
  });if(!allowed)throw Object.assign(Error('Please wait before trying again.'),{code:'rateLimited'});
 }
 reserve(code,identity,now){
  const digest=hash(normalize(code));
  return this.store.transaction(()=>{
   const row=this.db.prepare('SELECT c.* FROM promo_codes k JOIN promo_campaigns c ON c.id=k.campaign_id WHERE k.hash=?').get(digest);
   const existing=this.db.prepare('SELECT * FROM promo_redemptions WHERE code_hash=?').get(digest);
   if(existing){if(existing.subject_hash!==identity.subjectHash||existing.customer_id!==identity.customerId||existing.revoked)throw unavailable();return {...existing,campaign:row};}
   if(!row||!row.enabled||now<row.starts||now>=row.ends)throw unavailable();
   const id=randomUUID(),key='SF-LIC-'+randomBytes(32).toString('base64url'),plan=promotionalPlans[row.plan],days=promotionDurations[plan.duration];
   const expires=days===null?null:now+days*86400;
   this.db.prepare('INSERT INTO promo_redemptions(id,code_hash,subject_hash,customer_id,key_box,expires,created,state) VALUES(?,?,?,?,?,?,?,?)').run(id,digest,identity.subjectHash,identity.customerId,this.seal(key,id),expires,now,'reserved');
   this.audit(row.id,id,'code-claimed',now);
   return {...this.db.prepare('SELECT * FROM promo_redemptions WHERE id=?').get(id),campaign:row};
  });
 }
 lease(id,now){const owner=randomUUID();return this.db.prepare("UPDATE promo_redemptions SET lease_until=?,lease_owner=? WHERE id=? AND state='reserved' AND revoked=0 AND lease_until<=?").run(now+60,owner,id,now).changes?owner:null;}
 release(id,owner){this.db.prepare('UPDATE promo_redemptions SET lease_until=0,lease_owner=NULL WHERE id=? AND lease_owner=?').run(id,owner);}
 complete(row,license,owner,now){return this.store.transaction(()=>{
  const updated=this.db.prepare("UPDATE promo_redemptions SET state='ready',license_ref=?,lease_until=0,lease_owner=NULL WHERE id=? AND lease_owner=? AND state='reserved' AND revoked=0").run(license.id,row.id,owner);
  if(updated.changes!==1)throw pending();this.audit(row.campaign.id,row.id,'license-assigned',now);
 });}
 registered(ref){return this.db.prepare("SELECT r.*,c.plan,c.product_id,c.id AS campaign_id FROM promo_redemptions r JOIN promo_codes k ON k.hash=r.code_hash JOIN promo_campaigns c ON c.id=k.campaign_id WHERE r.license_ref=? AND r.state='ready'").get(ref);}
 revoke(id,now){return this.store.transaction(()=>{const r=this.db.prepare('SELECT * FROM promo_redemptions WHERE id=?').get(id);if(!r)throw Error('Redemption missing');this.db.prepare('UPDATE promo_redemptions SET revoked=1 WHERE id=?').run(id);if(r.license_ref)this.db.prepare("UPDATE licenses SET status='revoked',updated=? WHERE ref=?").run(now,r.license_ref);this.audit(null,id,'license-revoked',now);});}
}

function assertImported(key,row,value){
 const plan=promotionalPlans[row.campaign.plan],expected=row.expires===null?null:row.expires*1000;
 if(!safeId(key?.id)||key.key!==value||key.customer_id!==row.customer_id||key.product_id!==row.campaign.product_id||key.activations_limit!==plan.maxDevices||key.subscription_id||key.source!=='import'||(key.expires_at?Date.parse(key.expires_at):null)!==expected)throw Error('Imported license did not match campaign');
 return key;
}

export class PromotionService {
 constructor({store,dodo,verifyIdentity,now=()=>Math.floor(Date.now()/1000)}){if(typeof verifyIdentity!=='function')throw Error('Verified customer identity required');Object.assign(this,{store,dodo,verifyIdentity,now});}
 async redeem(request,{rateBucket}){
  // Caller derives bucket from trusted ingress, never an editable body/IP header.
  if(typeof rateBucket!=='string'||!/^[a-f0-9]{64}$/.test(rateBucket))throw Error('Trusted rate bucket required');
  this.store.takeRate(rateBucket,this.now());exact(request,['code','identityToken']);
  normalize(request.code);
  if(typeof request.identityToken!=='string'||request.identityToken.length>8192)throw unavailable();
  const identity=await this.verifyIdentity(request.identityToken);
  if(!identity||!/^[a-f0-9]{64}$/.test(identity.subjectHash)||!safeId(identity.customerId))throw unavailable();
  const row=this.store.reserve(request.code,identity,this.now()),value=this.store.unseal(row.key_box,row.id);
  if(row.state==='ready'){const state=await this.resolve({customerId:row.customer_id,licenseRef:row.license_ref});if(state?.status!=='active')throw unavailable();return this.deliver(row,value);}
  const owner=this.store.lease(row.id,this.now());if(!owner)throw pending();
  try{
   // Retry uses the same encrypted key, customer and expiry. Dodo uniqueness is
   // the second safety boundary if a process dies or a response is lost.
   const known=await this.dodo.importedLicenses(row.customer_id,row.campaign.product_id);
   let key=known.find(item=>item.key===value);
   if(!key){try{key=await this.dodo.importLicense({customerId:row.customer_id,productId:row.campaign.product_id,key:value,maxDevices:promotionalPlans[row.campaign.plan].maxDevices,expiresAt:row.expires===null?null:new Date(row.expires*1000).toISOString()});}
    catch(error){if(error.status!==409)throw error;key=(await this.dodo.importedLicenses(row.customer_id,row.campaign.product_id)).find(item=>item.key===value);}}
   assertImported(key,row,value);if(key.status!=='active'||(row.expires!==null&&row.expires<=this.now()))throw unavailable();
   this.store.complete(row,key,owner,this.now());return this.deliver({...row,license_ref:key.id},value);
  }catch(error){if(error.code==='redemptionUnavailable')throw error;throw pending();}
  finally{this.store.release(row.id,owner);}
 }
 deliver(row,key){if(row.expires!==null&&row.expires<=this.now())throw unavailable();return {licenseKey:key,licenseRef:row.license_ref,edition:promotionalPlans[row.campaign.plan].edition,maxDevices:promotionalPlans[row.campaign.plan].maxDevices,expiresAt:row.expires===null?null:new Date(row.expires*1000).toISOString(),emailSent:false};}
 async resolve({customerId,licenseRef}){
  const row=this.store.registered(licenseRef);if(!row)return null;
  if(row.customer_id!==customerId)throw unavailable();
  const value=this.store.unseal(row.key_box,row.id);
  const key=(await this.dodo.importedLicenses(customerId,row.product_id)).find(k=>k.id===licenseRef);
  assertImported(key,{...row,campaign:{plan:row.plan,product_id:row.product_id}},value);
  const now=this.now();return {ref:licenseRef,plan:row.plan,status:row.revoked?'revoked':key.status==='active'&&(row.expires===null||row.expires>now)?'active':'inactive',periodEnd:row.expires,observedAt:now};
 }
}
