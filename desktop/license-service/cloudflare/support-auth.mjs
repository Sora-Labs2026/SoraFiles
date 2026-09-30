import {createPublicKey,createHash,verify} from 'node:crypto';
const handle=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const exact=(value,keys)=>{if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw Error('Invalid support request');};

// Signing format shared with a private support caller. Raw license keys never
// enter audit rows, error messages or signed request metadata.
export function supportReplacementMessage(packet){
 const request=packet.request;
 if(!request||Object.getPrototypeOf(request)!==Object.prototype)throw Error('Invalid support request');
 const canonical=JSON.stringify(Object.fromEntries(Object.keys(request).sort().map(key=>[key,request[key]])));
 const digest=createHash('sha256').update(canonical).digest('base64url');
 const keyDigest=createHash('sha256').update(packet.licenseKey.trim()).digest('base64url');
 return Buffer.from(['sorafiles-support-replace-v1',packet.kid,packet.nonce,packet.issuedAt,packet.expiresAt,digest,keyDigest].join('\n'));
}

export function authorizeSupportReplacement(store,packet,configuration,now=Math.floor(Date.now()/1000)){
 exact(packet,['kid','nonce','issuedAt','expiresAt','request','licenseKey','signature']);
 if(!handle(packet.kid)||typeof packet.nonce!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(packet.nonce)
  ||!Number.isSafeInteger(packet.issuedAt)||!Number.isSafeInteger(packet.expiresAt)||packet.issuedAt>now+30
  ||packet.expiresAt<=now||packet.expiresAt>packet.issuedAt+120||packet.expiresAt<=packet.issuedAt
  ||typeof packet.licenseKey!=='string'||!packet.licenseKey.trim()||packet.licenseKey.length>4096
  ||typeof packet.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(packet.signature))throw Error('Invalid support proof');
 const request=packet.request,keys=['ticket','licenseRef','oldDeviceId','newDeviceId','reason'];
 if(request&&Object.hasOwn(request,'overrideTicket'))keys.push('overrideTicket');exact(request,keys);
 if(Object.values(request).some(value=>typeof value!=='string'||value.length>128))throw Error('Invalid support request');
 const config=JSON.parse(configuration||'{}');
 if(!config||Object.getPrototypeOf(config)!==Object.prototype||!Object.hasOwn(config,packet.kid))throw Error('Support key unavailable');
 const operator=config[packet.kid];
 if(!handle(operator?.operator)||typeof operator.publicKey!=='string'||operator.publicKey.length>2048
  ||(request.overrideTicket&&operator.canOverride!==true))throw Error('Support role unavailable');
 const key=createPublicKey(operator.publicKey);
 if(key.asymmetricKeyType!=='ed25519'||!verify(null,supportReplacementMessage(packet),key,Buffer.from(packet.signature,'base64url')))throw Error('Invalid support signature');
 // Separate namespace from device nonces. Retries sign a fresh nonce while
 // retaining the same ticket; the replacement ledger remains idempotent.
 store.consumeNonce('support:'+packet.kid+':'+packet.nonce,packet.expiresAt,now);
 return {...request,operator:operator.operator};
}
