// Standard compact JWS with Ed25519; verification keys only in desktop distribution.
import {createPublicKey,verify,createHash} from 'node:crypto';
import {licensePlans as plans} from './license-plans.mjs';
import {validDesktopFeatures} from './tool-policy.mjs';
const decode=s=>{if(!/^[A-Za-z0-9_-]+$/.test(s))throw Error('Invalid token');return Buffer.from(s,'base64url');};
export function deviceIdentity(publicKey){const key=createPublicKey(publicKey);if(key.asymmetricKeyType!=='ed25519')throw Error('Device key algorithm');return createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('base64url');}
export function verifyEntitlement(token,{keys,deviceId,now=Date.now(),lastTrustedTime=0,feature='process'}){
 if(typeof token!=='string'||token.length>12000)throw Error('Invalid entitlement');const parts=token.split('.');if(parts.length!==3)throw Error('Invalid entitlement');
 const header=JSON.parse(decode(parts[0]));if(!header||Object.keys(header).some(k=>!['alg','typ','kid'].includes(k))||header.alg!=='EdDSA'||header.typ!=='sf-entitlement+jwt'||typeof header.kid!=='string'||!Object.hasOwn(keys,header.kid))throw Error('Untrusted signing key');
 const key=createPublicKey(keys[header.kid]);if(key.asymmetricKeyType!=='ed25519'||!verify(null,Buffer.from(parts[0]+'.'+parts[1]),key,decode(parts[2])))throw Error('Invalid signature');
 const e=JSON.parse(decode(parts[1]));const time=Math.floor(now/1000);
 if(!Number.isFinite(now)||!Number.isFinite(lastTrustedTime)||now+300000<lastTrustedTime)throw Error('Clock needs verification');
 // Separate processes can straddle a clock tick or have small clock offsets.
 // Tolerance applies only to the start boundary, never to expired access.
 if(e.schema!==1||e.iss!=='sorafiles-license-service'||e.aud!=='sorafiles-desktop'||e.deviceId!==deviceId||!e.jti||!Number.isSafeInteger(e.iat)||!Number.isSafeInteger(e.nbf)||e.iat>time+60||e.nbf>time+60)throw Error('Invalid entitlement claims');
 if(!validDesktopFeatures(e.features)||!e.features.includes(feature))throw Error('Feature not authorized');
 if(e.plan==='trial'){if(e.maxDevices!==1||!Number.isSafeInteger(e.exp)||e.exp>e.iat+7*86400)throw Error('Invalid trial');}
 else {const plan=plans[e.plan];if(!plan||e.maxDevices!==plan.maxDevices||e.edition!==plan.edition||!e.licenseRef)throw Error('Invalid plan');if(plan.interval==='lifetime'){if(e.exp!==null)throw Error('Lifetime requires permanent grant');}else if(!Number.isSafeInteger(e.exp))throw Error('Subscription expiry required');}
 if(e.exp!==null&&(!Number.isSafeInteger(e.exp)||e.exp<=time||e.exp<=e.nbf))throw Error('Entitlement expired');
 return Object.freeze(e);
}
