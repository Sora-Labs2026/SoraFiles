import {generateKeyPairSync} from 'node:crypto';
import {LicenseClient} from '../core/license-client.mjs';

// Trusted native parent supplies state/config and acknowledges every protected
// write before execution continues. Renderer fields cannot configure this host.
export async function runLicenseAction({action,params={},state,config,saveState,fetchImpl}) {
 if(!['status','trial','activate','refresh','devices'].includes(action)||!params||typeof params!=='object'
  ||Object.keys(params).some(key=>action!=='activate'||key!=='licenseKey'))throw Error('Invalid license action');
 if(action==='status'&&!state?.license)return {license:'not-activated'};
 if(!config?.keys||!Object.keys(config.keys).length)throw Error('License service configuration is not available in this build');
 let current=state;
 if(!current?.device){
  if(current)throw Error('Private device state is damaged');
  const pair=generateKeyPairSync('ed25519');current={schema:1,device:{publicKey:pair.publicKey.export({format:'pem',type:'spki'}),privateKey:pair.privateKey.export({format:'pem',type:'pkcs8'})},license:null};
  await saveState(current);
 }
 const client=new LicenseClient({origin:config.origin,keys:config.keys,allowLocalTesting:config.allowLocalTesting===true,
  readDevice:async()=>current.device,readLicense:async()=>current.license,
  saveLicense:async license=>{const next={...current,license};await saveState(next);current=next;},...(fetchImpl?{fetchImpl}:{})});
 // This display hint never grants access. Paid activation still requires a
 // device proof, provider validation and a signed entitlement in LicenseClient.
 const activationAvailable=!current.license?.licenseRef&&!current.license?.licenseKey;
 if(action==='status'){try{const result=await client.authorize();return {license:result.plan==='trial'?'trial':'active',activationAvailable,...result};}catch{return {license:'needs-verification',activationAvailable};}}
 if(action==='devices')return {devices:await client.devices()};
 const result=await (action==='activate'?client.activate(params.licenseKey):client[action]());
 return {license:result.plan==='trial'?'trial':'active',activationAvailable:result.plan==='trial',...result};
}
