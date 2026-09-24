import {createHash} from 'node:crypto';
const fields={trial:[],activate:['licenseKey'],refresh:['licenseKey','licenseRef','instanceId'],validate:['licenseKey','licenseRef','instanceId','nonce'],devices:['licenseRef'],replacementRequest:['licenseRef','oldDeviceId','licenseKey','identityToken'],replacementStatus:['orderId','licenseKey','identityToken']};
export function requestContext(action,body){
 const permitted=fields[action];
 if(!permitted||!body||Object.getPrototypeOf(body)!==Object.prototype||Object.keys(body).length!==permitted.length)throw Error('Invalid request fields');
 for(const k of Object.keys(body))if(!permitted.includes(k)||typeof body[k]!=='string'||!body[k].trim()||body[k].length>4096||/[\x00-\x1f]/.test(body[k]))throw Error('Invalid request fields');
 if(action==='validate'&&!/^[A-Za-z0-9_-]{43}$/.test(body.nonce))throw Error('Invalid validation nonce');
 const canonical=JSON.stringify(Object.fromEntries([...permitted].sort().map(k=>[k,body[k]])));
 return action+':'+createHash('sha256').update(canonical).digest('base64url');
}
