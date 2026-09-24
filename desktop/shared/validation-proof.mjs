import {createPublicKey,verify} from 'node:crypto';
// A transient error never revokes offline access. Only a short-lived signed,
// request-bound answer can change the saved authorization state.
export function verifyValidationProof(token,{keys,deviceId,licenseRef,instanceId,nonce,now=Date.now()}){
 if(typeof token!=='string'||token.length>16000)throw Error('Invalid validation response');
 const parts=token.split('.');if(parts.length!==3||parts.some(p=>!p||!/^[A-Za-z0-9_-]+$/.test(p)))throw Error('Invalid validation response');
 const decode=part=>JSON.parse(Buffer.from(part,'base64url').toString('utf8'));
 const header=decode(parts[0]);
 if(header.alg!=='EdDSA'||header.typ!=='sf-validation+jwt'||!Object.hasOwn(keys,header.kid)||Object.keys(header).some(k=>!['alg','typ','kid'].includes(k)))throw Error('Invalid validation signature');
 const key=createPublicKey(keys[header.kid]);
 if(key.asymmetricKeyType!=='ed25519'||!verify(null,Buffer.from(parts[0]+'.'+parts[1]),key,Buffer.from(parts[2],'base64url')))throw Error('Invalid validation signature');
 const claim=decode(parts[1]),time=Math.floor(now/1000);
 if(!Number.isFinite(now)||claim.schema!==1||claim.iss!=='sorafiles-license-service'||claim.aud!=='sorafiles-desktop'||claim.deviceId!==deviceId||claim.licenseRef!==licenseRef||claim.instanceId!==instanceId||claim.nonce!==nonce||!Number.isSafeInteger(claim.iat)||!Number.isSafeInteger(claim.exp)||claim.iat>time+60||claim.exp<=time||claim.exp>claim.iat+300||claim.exp<=claim.iat)throw Error('Invalid validation claims');
 if(!['active','inactive'].includes(claim.status)||claim.status==='inactive'&&!['device-replaced','license-inactive','subscription-expired'].includes(claim.reason))throw Error('Invalid validation state');
 return Object.freeze(claim);
}
