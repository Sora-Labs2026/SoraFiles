import {createPublicKey,verify,createHash} from 'node:crypto';
import {open,lstat} from 'node:fs/promises';
import {validateManifest,recommendRelease} from './releases.mjs';
const bytes=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9_-]+$/.test(value))throw Error('Invalid signature encoding');return Buffer.from(value,'base64url');};
function verifySignature(message,signature,kid,keys){if(typeof kid!=='string'||!Object.hasOwn(keys,kid))throw Error('Unknown update signing key');const key=createPublicKey(keys[kid]);if(key.asymmetricKeyType!=='ed25519'||!verify(null,message,key,bytes(signature)))throw Error('Invalid update signature');}
export function verifyReleaseEnvelope(envelope,{keys,now=Math.floor(Date.now()/1000),trustedState={sequence:0,digest:null}}){
 if(!envelope||Object.keys(envelope).sort().join(',')!=='kid,payload,signature'||typeof envelope.payload!=='string'||envelope.payload.length>2*1024*1024)throw Error('Invalid release envelope');
 const raw=bytes(envelope.payload);verifySignature(Buffer.concat([Buffer.from('sorafiles-release-manifest-v1\n'),raw]),envelope.signature,envelope.kid,keys);
 const digest=createHash('sha256').update(raw).digest('hex'),manifest=JSON.parse(raw);
 if(!Number.isSafeInteger(now)||!Number.isSafeInteger(manifest.sequence)||manifest.sequence<1||!Number.isSafeInteger(manifest.issuedAt)||!Number.isSafeInteger(manifest.expiresAt)||manifest.issuedAt>now+300||manifest.expiresAt<=now||manifest.expiresAt<=manifest.issuedAt||manifest.expiresAt-manifest.issuedAt>7*86400)throw Error('Release manifest expired or invalid');
 if(!Number.isSafeInteger(trustedState.sequence)||manifest.sequence<trustedState.sequence||(manifest.sequence===trustedState.sequence&&trustedState.digest!==digest))throw Error('Release manifest rollback');
 validateManifest(manifest);return {manifest,trustedState:{sequence:manifest.sequence,digest}};
}
export function artifactSignatureMessage(release){return Buffer.from('sorafiles-artifact-v1\n'+JSON.stringify([release.version,release.platform,release.arch,release.package,release.bytes,release.sha256,release.url]));}
export function trustedUpdate(envelope,{keys,now,trustedState,device,downloadOrigins}){
 const trusted=verifyReleaseEnvelope(envelope,{keys,now,trustedState});
 if(!device?.currentVersion||!device?.osVersion||!device?.arch||!device?.packageType)throw Error('Installed build identity required');
 const result=recommendRelease(trusted.manifest,device);if(!result.release)return {...trusted,release:null,reason:result.reason};
 const release=result.release;if(!release.updaterEligible)throw Error('Release is not eligible for automatic update');
 if(!Array.isArray(downloadOrigins)||!downloadOrigins.includes(new URL(release.url).origin))throw Error('Untrusted update origin');
 const parts=release.updateSignature.split('.');if(parts.length!==2)throw Error('Artifact signature required');verifySignature(artifactSignatureMessage(release),parts[1],parts[0],keys);
 return {...trusted,release,reason:'verified-compatible-update'};
}
// Independent digest validation for a staged installer. The native installer must keep
// ownership/pinned handles through platform signature verification and execution.
export async function verifyStagedUpdate(path,release,{keys,signal}){
 const parts=release.updateSignature?.split('.')||[];if(parts.length!==2)throw Error('Artifact signature required');verifySignature(artifactSignatureMessage(release),parts[1],parts[0],keys);
 const before=await lstat(path);if(before.isSymbolicLink()||!before.isFile()||before.size!==release.bytes)throw Error('Update size/type mismatch');
 const handle=await open(path,'r');try{const start=await handle.stat();if(start.ino!==before.ino||start.dev!==before.dev||start.size!==before.size)throw Error('Update changed');
  const digest=createHash('sha256'),buffer=Buffer.alloc(1024*1024);let count=0;
  while(true){signal?.throwIfAborted();const {bytesRead}=await handle.read(buffer,0,buffer.length,null);if(!bytesRead)break;count+=bytesRead;if(count>release.bytes)throw Error('Update grew');digest.update(buffer.subarray(0,bytesRead));}
  const end=await handle.stat();if(count!==release.bytes||end.size!==start.size||end.mtimeMs!==start.mtimeMs||digest.digest('hex')!==release.sha256)throw Error('Update integrity mismatch');
  return {verified:true,bytes:count};
 }finally{await handle.close();}
}
