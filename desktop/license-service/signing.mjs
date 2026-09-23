import {createPrivateKey,createPublicKey,sign,verify,randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
import {deviceIdentity} from '../shared/entitlement.mjs';
import {licensePlans as plans} from '../shared/license-plans.mjs';
import {desktopEntitlementFeatures,validDesktopFeatures} from '../shared/tool-policy.mjs';
export function signEntitlement(payload,{privateKey,kid}){if(!validDesktopFeatures(payload?.features))throw Error('Feature not authorized');const key=createPrivateKey(privateKey);if(key.asymmetricKeyType!=='ed25519'||!kid)throw Error('Invalid signing configuration');const data=[{alg:'EdDSA',typ:'sf-entitlement+jwt',kid},payload].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');return data+'.'+sign(null,Buffer.from(data),key).toString('base64url');}
export function entitlementClaims({license,deviceId,now,trial}){
 const base={schema:1,iss:'sorafiles-license-service',aud:'sorafiles-desktop',jti:randomUUID(),deviceId,iat:now,nbf:now,features:[...desktopEntitlementFeatures]};
 if(trial)return {...base,plan:'trial',edition:'Trial',maxDevices:1,exp:trial.exp};
 const plan=plans[license.plan];if(!plan||license.status!=='active')throw Error('Inactive license');const exp=plan.interval==='lifetime'?null:Math.min(license.period_end,now+31*86400);if(exp!==null&&(!Number.isSafeInteger(exp)||exp<=now))throw Error('Subscription expired');
 return {...base,plan:plan.id,edition:plan.edition,maxDevices:plan.maxDevices,licenseRef:license.ref,exp};
}
// Server-issued random challenge is consumed transactionally. Context includes action and
// the digest of the complete request body, preventing cross-endpoint/body replay.
export function verifyDeviceProof({publicKey,signature,challenge,expectedContext,now,consume}){
 if(challenge.context!==expectedContext||!Number.isSafeInteger(challenge.expires)||challenge.expires<now||challenge.expires>now+300)throw Error('Invalid challenge');
 const key=createPublicKey(publicKey);if(key.asymmetricKeyType!=='ed25519')throw Error('Invalid device key');
 const message=Buffer.from(`sorafiles-device-v1\n${challenge.id}\n${challenge.context}\n${challenge.expires}`);
 if(!verify(null,message,key,Buffer.from(signature,'base64url')))throw Error('Invalid device proof');consume(challenge.id,challenge.expires,now);return deviceIdentity(publicKey);
}
// Standard Webhooks HMAC-SHA256 framing; raw request bytes, not reserialized JSON.
export function verifyDodoWebhook(raw,headers,secret,{now=Math.floor(Date.now()/1000)}={}){
 const id=headers['webhook-id'],timestamp=headers['webhook-timestamp'],signatures=headers['webhook-signature'];
 if(!id||id.length>200||!/^\d+$/.test(timestamp||'')||Math.abs(now-Number(timestamp))>300||typeof signatures!=='string'||signatures.length>4096||raw.length>1024*1024)throw Error('Invalid webhook');
 const key=Buffer.from(secret.replace(/^whsec_/,''),'base64');if(key.length<32)throw Error('Invalid webhook secret');
 const expected=createHmac('sha256',key).update(`${id}.${timestamp}.`).update(raw).digest();
 const valid=signatures.split(' ').some(s=>{const [version,value]=s.split(',');if(version!=='v1'||!value)return false;const actual=Buffer.from(value,'base64');return actual.length===expected.length&&timingSafeEqual(actual,expected);});
 if(!valid)throw Error('Invalid webhook signature');const event=JSON.parse(raw.toString('utf8'));return {id,event};
}
