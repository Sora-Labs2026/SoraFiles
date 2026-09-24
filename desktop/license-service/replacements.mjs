import {createHash} from 'node:crypto';
import {licensePlans} from '../shared/license-plans.mjs';

const handle = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const device = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const reasons = new Set(['lost', 'stolen', 'hardware-failure', 'reinstalled', 'upgraded']);

// Called only by an authenticated server operator, never by the public HTTP API.
// Keep old permanent bindings until provider release is confirmed. Pending work
// therefore cannot accidentally free a seat after an ambiguous provider response.
export function prepareReplacement(store, request, now) {
  const {ticket, operator, licenseRef, oldDeviceId, newDeviceId, reason, keyHash, overrideTicket = null} = request;
  if (!handle(ticket) || !handle(operator) || !handle(licenseRef) || !device(oldDeviceId)
      || !device(newDeviceId) || oldDeviceId === newDeviceId || !reasons.has(reason)
      || !/^[a-f0-9]{64}$/.test(keyHash) || !Number.isSafeInteger(now)
      || (overrideTicket !== null && (!handle(overrideTicket) || overrideTicket === ticket))) throw Error('Invalid replacement request');
  return store.transaction(() => {
    const previous = store.db.prepare('SELECT * FROM support_replacements WHERE ticket=?').get(ticket);
    if (previous) {
      for (const [column, value] of Object.entries({operator, license_ref:licenseRef, old_device:oldDeviceId,
        new_device:newDeviceId, reason, key_hash:keyHash, override_ticket:overrideTicket}))
        if (previous[column] !== value) throw Error('Replacement ticket already used');
      return previous;
    }
    const license = store.db.prepare('SELECT * FROM licenses WHERE ref=?').get(licenseRef);
    const plan = licensePlans[license?.plan];
    if (!plan || license.status !== 'active' || (plan.interval !== 'lifetime' && license.period_end <= now)) throw Error('License is not active');
    const old = store.db.prepare('SELECT * FROM devices WHERE license_ref=? AND device_id=?').get(licenseRef, oldDeviceId);
    if (!old || !store.db.prepare('SELECT 1 FROM permanent_devices WHERE license_ref=? AND device_id=?').get(licenseRef, oldDeviceId)) throw Error('Completed activation required');
    if (store.db.prepare('SELECT 1 FROM paid_replacements WHERE license_ref=? AND (old_device=? OR new_device=?)').get(licenseRef,oldDeviceId,newDeviceId)
      || store.db.prepare('SELECT 1 FROM support_replacements WHERE license_ref=? AND (old_device=? OR new_device=?)').get(licenseRef, oldDeviceId, newDeviceId)
      || store.db.prepare('SELECT 1 FROM devices WHERE license_ref=? AND device_id=?').get(licenseRef, newDeviceId)) throw Error('Device already used in a replacement');
    const {count} = store.db.prepare('SELECT COUNT(*) AS count FROM support_replacements WHERE license_ref=? AND created>?').get(licenseRef, now-365*86400);
    if (count >= plan.maxDevices*2 && !overrideTicket) throw Error('Additional support review required for replacement limit');
    // A replacement device cannot repeatedly hop to another device within a week
    // without an explicit second support review. Legitimate exceptions remain possible.
    const recent = store.db.prepare('SELECT 1 FROM support_replacements WHERE license_ref=? AND new_device=? AND created>?').get(licenseRef, oldDeviceId, now-7*86400);
    if (recent && !overrideTicket) throw Error('Additional support review required for recent replacement');
    store.db.prepare("INSERT INTO support_replacements VALUES(?,?,?,?,?,?,?,?,?,?,?,'pending',NULL,NULL)")
      .run(ticket, operator, licenseRef, oldDeviceId, newDeviceId, old.instance_id, keyHash, reason, overrideTicket, now, plan.maxDevices);
    store.db.prepare('UPDATE devices SET active=0 WHERE license_ref=? AND device_id=?').run(licenseRef, oldDeviceId);
    store.db.prepare("UPDATE activation_attempts SET status='blocked' WHERE license_ref=? AND device_id=?").run(licenseRef, oldDeviceId);
    return store.db.prepare('SELECT * FROM support_replacements WHERE ticket=?').get(ticket);
  });
}

export function completeReplacement(store, ticket, now) {
  return store.transaction(() => {
    const row = store.db.prepare('SELECT * FROM support_replacements WHERE ticket=?').get(ticket);
    if (!row) throw Error('Replacement missing');
    if (row.status === 'complete') return row;
    store.db.prepare('DELETE FROM permanent_devices WHERE license_ref=? AND device_id=?').run(row.license_ref, row.old_device);
    store.db.prepare("UPDATE support_replacements SET status='complete',completed=? WHERE ticket=?").run(now, ticket);
    return store.db.prepare('SELECT * FROM support_replacements WHERE ticket=?').get(ticket);
  });
}

export async function replaceDevice({store, guard, dodo, authority, request, licenseKey, now=Math.floor(Date.now()/1000)}) {
  if (typeof licenseKey !== 'string' || !licenseKey.trim() || licenseKey.length>4096) throw Error('License key required');
  const binding = store.binding(request.licenseRef);
  if (!binding) throw Error('License binding required');
  const state = await authority.resolve({customerId:binding.customer_id, licenseRef:request.licenseRef});
  if (state.ref !== request.licenseRef || state.status !== 'active') throw Error('Active provider license required');
  store.sync(state);
  const keyHash = guard.activationFingerprint(licenseKey);
  const attempt = store.db.prepare('SELECT 1 FROM activation_attempts WHERE license_ref=? AND device_id=? AND key_hash=?')
    .get(request.licenseRef, request.oldDeviceId, keyHash);
  const previous = store.db.prepare('SELECT * FROM support_replacements WHERE ticket=?').get(request.ticket);
  if (!attempt && previous?.key_hash !== keyHash) throw Error('License key does not match activation history');
  const row = prepareReplacement(store, {...request,keyHash}, now);
  if (row.status !== 'complete') {
    // On retry, an invalid old instance means provider release already happened.
    // An outage throws and leaves the seat reserved and the old device blocked.
    const validation = await dodo.validate(licenseKey, row.instance_id);
    if (validation?.valid === true) await dodo.deactivate(licenseKey, row.instance_id);
    else if (validation?.valid !== false) throw Error('Provider release requires verification');
    completeReplacement(store, row.ticket, now);
  }
  return {ticket:row.ticket,status:'complete',replacementAuthorized:true,oldActivationRevoked:true,
    oldOfflineEntitlementRevoked:false,historyRef:createHash('sha256').update(row.ticket).digest('hex').slice(0,16)};
}
