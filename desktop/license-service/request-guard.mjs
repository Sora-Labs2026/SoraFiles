import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {deviceIdentity} from '../shared/entitlement.mjs';
import {verifyDeviceProof} from './signing.mjs';

const fields={trial:['subjectToken'],activate:['licenseKey'],refresh:['licenseKey','licenseRef','instanceId'],deactivate:['licenseKey','licenseRef','instanceId'],devices:['licenseRef']};
export function requestContext(action,body){
 const permitted=fields[action];
 if(!permitted||!body||Object.getPrototypeOf(body)!==Object.prototype||Object.keys(body).length!==permitted.length)throw Error('Invalid request fields');
 for(const k of Object.keys(body))if(!permitted.includes(k)||typeof body[k]!=='string'||!body[k].trim()||body[k].length>4096||/[\x00-\x1f]/.test(body[k]))throw Error('Invalid request fields');
 // Only commercial/device identifiers are accepted. No file metadata crosses this boundary.
 const canonical=JSON.stringify(Object.fromEntries([...permitted].sort().map(k=>[k,body[k]])));
 return action+':'+createHash('sha256').update(canonical).digest('base64url');
}

// Tokens are authenticated by a separate server secret. A client cannot invent a nonce.
// One-use consumption is in the shared durable store, so it works across service processes.
export class RequestGuard {
 constructor({secret,store,now=()=>Math.floor(Date.now()/1000)}){if(!(secret instanceof Uint8Array)||secret.length<32)throw Error('Challenge secret required');this.secret=secret;this.store=store;this.now=now;}
 activationFingerprint(licenseKey){return createHmac('sha256',this.secret).update('sorafiles-activation-v1\n').update(licenseKey.trim()).digest('hex');}
 issue({action,body,publicKey}){const now=this.now(),deviceId=deviceIdentity(publicKey),context=requestContext(action,body);
  const value={id:randomBytes(32).toString('base64url'),deviceId,context,expires:now+120};
  const encoded=Buffer.from(JSON.stringify(value)).toString('base64url');
  return {challenge:value,token:encoded+'.'+createHmac('sha256',this.secret).update(encoded).digest('base64url')};
 }
 verify({action,body,publicKey,signature,token}){
  if(typeof token!=='string'||token.length>2048)throw Error('Invalid challenge');
  const parts=token.split('.');if(parts.length!==2||parts.some(x=>!/^[A-Za-z0-9_-]+$/.test(x)))throw Error('Invalid challenge');
  const actual=Buffer.from(parts[1],'base64url'),expected=createHmac('sha256',this.secret).update(parts[0]).digest();
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error('Invalid challenge');
  const challenge=JSON.parse(Buffer.from(parts[0],'base64url'));
  if(challenge.deviceId!==deviceIdentity(publicKey))throw Error('Wrong challenge device');
  return verifyDeviceProof({publicKey,signature,challenge,expectedContext:requestContext(action,body),now:this.now(),consume:(...args)=>this.store.consumeNonce(...args)});
 }
}

// Bounded per-process limiter. Production ingress must ALSO rate-limit across replicas;
// never trust a caller-supplied forwarded address without an explicitly trusted proxy.
export class RateLimiter {
 constructor({limit=12,windowSeconds=60,maxKeys=10000,now=()=>Math.floor(Date.now()/1000)}={}){this.limit=limit;this.window=windowSeconds;this.maxKeys=maxKeys;this.now=now;this.entries=new Map();}
 take(key){const now=this.now();for(const [k,v] of this.entries)if(v.until<=now)this.entries.delete(k);let entry=this.entries.get(key);
  if(!entry){if(this.entries.size>=this.maxKeys)throw Error('Rate limited');entry={until:now+this.window,count:0};this.entries.set(key,entry);}
  if(++entry.count>this.limit)throw Error('Rate limited');
 }
}
