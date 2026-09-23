import {generateKeyPairSync} from 'node:crypto';
import {deviceIdentity} from '../shared/entitlement.mjs';
import {signEntitlement,entitlementClaims} from '../license-service/signing.mjs';
export function processingFixture(){
 const pair=generateKeyPairSync('ed25519'),devicePair=generateKeyPairSync('ed25519');
 const device={publicKey:devicePair.publicKey.export({type:'spki',format:'pem'}),privateKey:devicePair.privateKey.export({type:'pkcs8',format:'pem'})};
 const now=Math.floor(Date.now()/1000),claims=entitlementClaims({license:{ref:'synthetic',plan:'personal-lifetime',status:'active'},deviceId:deviceIdentity(device.publicKey),now});
 const token=signEntitlement(claims,{privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'}),kid:'test'});
 return {state:{schema:1,device,license:{licenseRef:'synthetic',licenseKey:'synthetic-key',entitlement:token,lastTrustedTime:Date.now()}},config:{origin:'https://license.sorafiles.com',keys:{test:pair.publicKey.export({type:'spki',format:'pem'})}}};
}
