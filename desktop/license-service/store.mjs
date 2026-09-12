import {DatabaseSync} from 'node:sqlite';
import {licensePlans as plans} from '../shared/license-plans.mjs';
export class LicenseStore {
 constructor(file){this.db=new DatabaseSync(file);this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS licenses(ref TEXT PRIMARY KEY,plan TEXT NOT NULL,status TEXT NOT NULL,period_end INTEGER,updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS devices(license_ref TEXT NOT NULL REFERENCES licenses(ref),device_id TEXT NOT NULL,instance_id TEXT NOT NULL,active INTEGER NOT NULL,PRIMARY KEY(license_ref,device_id));
 CREATE TABLE IF NOT EXISTS trials(subject_hash TEXT PRIMARY KEY,device_id TEXT UNIQUE NOT NULL,issued INTEGER NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS consumed_nonces(id TEXT PRIMARY KEY,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS webhook_events(id TEXT PRIMARY KEY,received INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS license_bindings(license_ref TEXT PRIMARY KEY REFERENCES licenses(ref),customer_id TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS webhook_inbox(sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,received INTEGER NOT NULL,completed INTEGER);
 `);}
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const value=fn();this.db.exec('COMMIT');return value;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 sync({ref,plan,status,periodEnd,observedAt}){if(!plans[plan]||!['active','inactive','revoked'].includes(status)||!Number.isSafeInteger(observedAt))throw Error('Invalid authoritative state');this.db.prepare('INSERT INTO licenses VALUES(?,?,?,?,?) ON CONFLICT(ref) DO UPDATE SET plan=excluded.plan,status=excluded.status,period_end=excluded.period_end,updated=excluded.updated WHERE excluded.updated>licenses.updated OR (excluded.updated=licenses.updated AND excluded.status<>\'active\')').run(ref,plan,status,periodEnd??null,observedAt);}
 bind(ref,customerId){const old=this.binding(ref);if(old&&old.customer_id!==customerId)throw Error('License customer mismatch');this.db.prepare('INSERT OR IGNORE INTO license_bindings VALUES(?,?)').run(ref,customerId);}
 binding(ref){return this.db.prepare('SELECT * FROM license_bindings WHERE license_ref=?').get(ref);}
 devices(ref){return this.db.prepare('SELECT device_id,active FROM devices WHERE license_ref=?').all(ref);}
 existingTrial(subjectHash,deviceId){return this.db.prepare('SELECT issued AS iat,expires AS exp FROM trials WHERE subject_hash=? AND device_id=?').get(subjectHash,deviceId);}
 queueWebhook(id,now){return this.db.prepare('INSERT OR IGNORE INTO webhook_inbox(id,received) VALUES(?,?)').run(id,now).changes===1;}
 pendingWebhookBoundary(){return this.db.prepare('SELECT MAX(sequence) AS boundary FROM webhook_inbox WHERE completed IS NULL').get().boundary;}
 completeWebhooks(boundary,now){this.db.prepare('UPDATE webhook_inbox SET completed=? WHERE sequence<=? AND completed IS NULL').run(now,boundary);}
 bindingPage(after='',limit=100){return this.db.prepare('SELECT * FROM license_bindings WHERE license_ref>? ORDER BY license_ref LIMIT ?').all(after,limit);}
 activate(ref,deviceId,instanceId,now){return this.transaction(()=>{const license=this.db.prepare('SELECT * FROM licenses WHERE ref=?').get(ref);if(!license||license.status!=='active')throw Error('License inactive');const plan=plans[license.plan];if(plan.interval!=='lifetime'&&(!license.period_end||license.period_end<=now))throw Error('Subscription expired');
  const existing=this.db.prepare('SELECT * FROM devices WHERE license_ref=? AND device_id=? AND active=1').get(ref,deviceId);
  if(existing){if(existing.instance_id!==instanceId)throw Error('Device already activated; refresh existing activation');return license;}
  const {count}=this.db.prepare('SELECT COUNT(*) AS count FROM devices WHERE license_ref=? AND active=1').get(ref);if(count>=plan.maxDevices)throw Error('Activation limit reached');
  this.db.prepare('INSERT INTO devices VALUES(?,?,?,1) ON CONFLICT(license_ref,device_id) DO UPDATE SET instance_id=excluded.instance_id,active=1').run(ref,deviceId,instanceId);return license;
 });}
 deactivate(ref,deviceId){this.db.prepare('UPDATE devices SET active=0 WHERE license_ref=? AND device_id=?').run(ref,deviceId);}
 active(ref,deviceId){return this.db.prepare('SELECT d.*,l.plan,l.status,l.period_end FROM devices d JOIN licenses l ON l.ref=d.license_ref WHERE d.license_ref=? AND d.device_id=? AND d.active=1').get(ref,deviceId);}
 trial(subjectHash,deviceId,now){return this.transaction(()=>{if(this.db.prepare('SELECT 1 FROM trials WHERE subject_hash=? OR device_id=?').get(subjectHash,deviceId))throw Error('Trial already used');const exp=now+7*86400;this.db.prepare('INSERT INTO trials VALUES(?,?,?,?)').run(subjectHash,deviceId,now,exp);return {iat:now,exp};});}
 consumeNonce(id,expires,now){this.db.prepare('DELETE FROM consumed_nonces WHERE expires<?').run(now);try{this.db.prepare('INSERT INTO consumed_nonces VALUES(?,?)').run(id,expires);}catch{throw Error('Replayed request');}}
 webhookOnce(id,now,apply){return this.transaction(()=>{if(this.db.prepare('SELECT 1 FROM webhook_events WHERE id=?').get(id))return false;apply();this.db.prepare('INSERT INTO webhook_events VALUES(?,?)').run(id,now);return true;});}
 close(){this.db.close();}
}
