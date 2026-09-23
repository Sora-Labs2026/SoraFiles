import {licensePlans as plans} from '../shared/license-plans.mjs';
// Synchronous ledger shared by Node SQLite and Cloudflare Durable Object SQLite.
// Provider calls stay outside transactions; final checking and signing stay inside.
export class LicenseLedger {
 constructor(database){this.db=database;this.db.exec(`
 CREATE TABLE IF NOT EXISTS licenses(ref TEXT PRIMARY KEY,plan TEXT NOT NULL,status TEXT NOT NULL,period_end INTEGER,updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS devices(license_ref TEXT NOT NULL REFERENCES licenses(ref),device_id TEXT NOT NULL,instance_id TEXT NOT NULL,active INTEGER NOT NULL,PRIMARY KEY(license_ref,device_id));
 CREATE TABLE IF NOT EXISTS trials(subject_hash TEXT PRIMARY KEY,device_id TEXT UNIQUE NOT NULL,issued INTEGER NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS consumed_nonces(id TEXT PRIMARY KEY,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS webhook_events(id TEXT PRIMARY KEY,received INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS license_bindings(license_ref TEXT PRIMARY KEY REFERENCES licenses(ref),customer_id TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS webhook_inbox(sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,received INTEGER NOT NULL,completed INTEGER);
 CREATE TABLE IF NOT EXISTS activation_attempts(key_hash TEXT NOT NULL,device_id TEXT NOT NULL,status TEXT NOT NULL,license_ref TEXT,instance_id TEXT,customer_id TEXT,created INTEGER NOT NULL,PRIMARY KEY(key_hash,device_id));
 CREATE TABLE IF NOT EXISTS service_metadata(name TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS permanent_devices(license_ref TEXT NOT NULL REFERENCES licenses(ref),device_id TEXT NOT NULL,PRIMARY KEY(license_ref,device_id));
 CREATE TABLE IF NOT EXISTS deactivation_receipts(license_ref TEXT NOT NULL,device_id TEXT NOT NULL,instance_id TEXT NOT NULL,key_hash TEXT NOT NULL,PRIMARY KEY(license_ref,device_id,instance_id));
 CREATE TABLE IF NOT EXISTS support_replacements(ticket TEXT PRIMARY KEY,operator TEXT NOT NULL,license_ref TEXT NOT NULL REFERENCES licenses(ref),old_device TEXT NOT NULL,new_device TEXT NOT NULL,instance_id TEXT NOT NULL,key_hash TEXT NOT NULL,reason TEXT NOT NULL,override_ticket TEXT,created INTEGER NOT NULL,device_limit INTEGER NOT NULL,status TEXT NOT NULL,completed INTEGER,activated INTEGER,UNIQUE(license_ref,old_device),UNIQUE(license_ref,new_device));
 `);
 // Migrate old completed registrations once. Reopening a second service replica
 // must not turn another replica's in-flight provisional registration permanent.
 this.transaction(()=>{
  if(this.db.prepare("SELECT 1 FROM service_metadata WHERE name='permanent-bindings-v1'").get())return;
  this.db.exec('INSERT OR IGNORE INTO permanent_devices SELECT license_ref,device_id FROM devices WHERE active=1');
  this.db.exec('INSERT OR IGNORE INTO permanent_devices SELECT r.license_ref,r.device_id FROM deactivation_receipts r JOIN licenses l ON l.ref=r.license_ref');
  this.db.prepare("INSERT INTO service_metadata VALUES('permanent-bindings-v1','1')").run();
 });}
 transaction(fn){const sync=()=>{const value=fn();if(value&&typeof value.then==='function')throw Error('Ledger transactions must be synchronous');return value;};if(this.db.transactionSync)return this.db.transactionSync(sync);this.db.exec('BEGIN IMMEDIATE');try{const value=sync();this.db.exec('COMMIT');return value;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 sync({ref,plan,status,periodEnd,observedAt}){if(!plans[plan]||!['active','inactive','revoked'].includes(status)||!Number.isSafeInteger(observedAt))throw Error('Invalid authoritative state');this.db.prepare('INSERT INTO licenses VALUES(?,?,?,?,?) ON CONFLICT(ref) DO UPDATE SET plan=excluded.plan,status=excluded.status,period_end=excluded.period_end,updated=excluded.updated WHERE excluded.updated>licenses.updated OR (excluded.updated=licenses.updated AND excluded.status<>\'active\')').run(ref,plan,status,periodEnd??null,observedAt);}
 bind(ref,customerId){const old=this.binding(ref);if(old&&old.customer_id!==customerId)throw Error('License customer mismatch');this.db.prepare('INSERT OR IGNORE INTO license_bindings VALUES(?,?)').run(ref,customerId);}
 binding(ref){return this.db.prepare('SELECT * FROM license_bindings WHERE license_ref=?').get(ref);}
 pinActivationKey(marker){this.db.prepare("INSERT OR IGNORE INTO service_metadata VALUES('activation-key',?)").run(marker);if(this.db.prepare("SELECT value FROM service_metadata WHERE name='activation-key'").get().value!==marker)throw Error('Activation key changed; migrate the activation ledger before rotation');}
 activationAttempt(keyHash,deviceId){return this.db.prepare('SELECT * FROM activation_attempts WHERE key_hash=? AND device_id=?').get(keyHash,deviceId);}
 reserveActivation(keyHash,deviceId,now){if(this.db.prepare('SELECT 1 FROM support_replacements WHERE key_hash=? AND old_device=?').get(keyHash,deviceId))throw Error('Old activation replaced; contact support');return this.db.prepare("INSERT OR IGNORE INTO activation_attempts(key_hash,device_id,status,created) VALUES(?,?,'pending',?)").run(keyHash,deviceId,now).changes===1;}
 recordActivation(keyHash,deviceId,activation){this.db.prepare('UPDATE activation_attempts SET license_ref=?,instance_id=?,customer_id=? WHERE key_hash=? AND device_id=? AND status=\'pending\'').run(activation.license_key_id,activation.id,activation.customer.customer_id,keyHash,deviceId);}
 finishActivation(keyHash,deviceId,status,now=Math.floor(Date.now()/1000),issue){if(!['complete','blocked'].includes(status))throw Error('Invalid activation outcome');return this.transaction(()=>{const row=this.activationAttempt(keyHash,deviceId);let result;if(status==='complete'){if(!row?.license_ref||!this.active(row.license_ref,deviceId))throw Error('Missing activation to bind');if(issue)result=issue(this.currentLicense(row.license_ref,deviceId,row.instance_id,now));this.db.prepare('INSERT OR IGNORE INTO permanent_devices VALUES(?,?)').run(row.license_ref,deviceId);this.db.prepare("UPDATE support_replacements SET activated=COALESCE(activated,?) WHERE license_ref=? AND new_device=? AND status='complete'").run(now,row.license_ref,deviceId);}this.db.prepare('UPDATE activation_attempts SET status=? WHERE key_hash=? AND device_id=?').run(status,keyHash,deviceId);return result;});}
 currentLicense(ref,deviceId,instanceId,now){
  const license=this.db.prepare('SELECT * FROM licenses WHERE ref=?').get(ref),active=this.active(ref,deviceId);
  if(!license||license.status!=='active')throw Error('License inactive');
  if(plans[license.plan].interval!=='lifetime'&&(!license.period_end||license.period_end<=now))throw Error('Subscription expired');
  if(this.db.prepare('SELECT 1 FROM support_replacements WHERE license_ref=? AND old_device=?').get(ref,deviceId))throw Error('Old activation replaced; contact support');
  if(!active||active.instance_id!==instanceId)throw Error('Device is not activated');
  return license;
 }
 // Signing is synchronous inside the write transaction. A second service process
 // cannot revoke/replace between the final status check and entitlement issuance.
 issueForDevice(ref,deviceId,instanceId,now,issue){return this.transaction(()=>issue(this.currentLicense(ref,deviceId,instanceId,now)));}
 forgetActivation(keyHash,deviceId){this.db.prepare('DELETE FROM activation_attempts WHERE key_hash=? AND device_id=?').run(keyHash,deviceId);}
 devices(ref){return this.db.prepare('SELECT d.device_id,d.active FROM devices d JOIN permanent_devices p ON p.license_ref=d.license_ref AND p.device_id=d.device_id WHERE d.license_ref=?').all(ref);}
 existingTrial(subjectHash,deviceId){return this.db.prepare('SELECT issued AS iat,expires AS exp FROM trials WHERE subject_hash=? AND device_id=?').get(subjectHash,deviceId);}
 queueWebhook(id,now){return this.db.prepare('INSERT OR IGNORE INTO webhook_inbox(id,received) VALUES(?,?)').run(id,now).changes===1;}
 pendingWebhookBoundary(){return this.db.prepare('SELECT MAX(sequence) AS boundary FROM webhook_inbox WHERE completed IS NULL').get().boundary;}
 completeWebhooks(boundary,now){this.db.prepare('UPDATE webhook_inbox SET completed=? WHERE sequence<=? AND completed IS NULL').run(now,boundary);}
 bindingPage(after='',limit=100){return this.db.prepare('SELECT * FROM license_bindings WHERE license_ref>? ORDER BY license_ref LIMIT ?').all(after,limit);}
 activate(ref,deviceId,instanceId,now,{existingOnly=false,provisional=false}={}){return this.transaction(()=>{const license=this.db.prepare('SELECT * FROM licenses WHERE ref=?').get(ref);if(!license||license.status!=='active')throw Error('License inactive');const plan=plans[license.plan];if(plan.interval!=='lifetime'&&(!license.period_end||license.period_end<=now))throw Error('Subscription expired');
  if(this.db.prepare('SELECT 1 FROM support_replacements WHERE license_ref=? AND old_device=?').get(ref,deviceId))throw Error('Old activation replaced; contact support');
  if(this.db.prepare("SELECT 1 FROM support_replacements WHERE license_ref=? AND new_device=? AND status='pending'").get(ref,deviceId))throw Error('Provider release is pending');
  const existing=this.db.prepare('SELECT * FROM devices WHERE license_ref=? AND device_id=? AND active=1').get(ref,deviceId);
  if(existing){if(existing.instance_id!==instanceId)throw Error('Device already activated; refresh existing activation');return license;}
  if(existingOnly)throw Error('Device is not activated');
  const bound=this.db.prepare('SELECT 1 FROM permanent_devices WHERE license_ref=? AND device_id=?').get(ref,deviceId);if(bound)throw Error('Device binding requires verification');
  const {count}=this.db.prepare("SELECT COUNT(*) AS count FROM (SELECT device_id FROM devices WHERE license_ref=? AND active=1 UNION SELECT device_id FROM permanent_devices WHERE license_ref=? UNION SELECT new_device AS device_id FROM support_replacements WHERE license_ref=? AND status='complete' AND new_device<>? AND activated IS NULL)").get(ref,ref,ref,deviceId);if(count>=plan.maxDevices)throw Error('Activation limit reached; contact support for device replacement');
  this.db.prepare('INSERT INTO devices VALUES(?,?,?,1) ON CONFLICT(license_ref,device_id) DO UPDATE SET instance_id=excluded.instance_id,active=1').run(ref,deviceId,instanceId);if(!provisional){this.db.prepare('INSERT OR IGNORE INTO permanent_devices VALUES(?,?)').run(ref,deviceId);this.db.prepare("UPDATE support_replacements SET activated=? WHERE license_ref=? AND new_device=? AND status='complete'").run(now,ref,deviceId);}return license;
 });}
 revokeDevice(ref,deviceId){this.transaction(()=>{this.db.prepare('UPDATE devices SET active=0 WHERE license_ref=? AND device_id=?').run(ref,deviceId);this.db.prepare("DELETE FROM activation_attempts WHERE license_ref=? AND device_id=? AND status='complete'").run(ref,deviceId);});}
 active(ref,deviceId){return this.db.prepare('SELECT d.*,l.plan,l.status,l.period_end FROM devices d JOIN licenses l ON l.ref=d.license_ref WHERE d.license_ref=? AND d.device_id=? AND d.active=1').get(ref,deviceId);}
 rollbackActivation(ref,deviceId){this.transaction(()=>{if(this.db.prepare('SELECT 1 FROM permanent_devices WHERE license_ref=? AND device_id=?').get(ref,deviceId))throw Error('A completed device binding cannot be released');this.db.prepare('UPDATE devices SET active=0 WHERE license_ref=? AND device_id=?').run(ref,deviceId);});}
 trial(subjectHash,deviceId,now){return this.transaction(()=>{if(this.db.prepare('SELECT 1 FROM trials WHERE subject_hash=? OR device_id=?').get(subjectHash,deviceId))throw Error('Trial already used');const exp=now+7*86400;this.db.prepare('INSERT INTO trials VALUES(?,?,?,?)').run(subjectHash,deviceId,now,exp);return {iat:now,exp};});}
 consumeNonce(id,expires,now){this.db.prepare('DELETE FROM consumed_nonces WHERE expires<?').run(now);try{this.db.prepare('INSERT INTO consumed_nonces VALUES(?,?)').run(id,expires);}catch{throw Error('Replayed request');}}
 webhookOnce(id,now,apply){return this.transaction(()=>{if(this.db.prepare('SELECT 1 FROM webhook_events WHERE id=?').get(id))return false;apply();this.db.prepare('INSERT INTO webhook_events VALUES(?,?)').run(id,now);return true;});}
 close(){this.db.close?.();}
}
