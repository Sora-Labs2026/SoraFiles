import {generateKeyPairSync} from 'node:crypto';
import {LicenseClient} from '../core/license-client.mjs';
import {deviceIdentity} from '../shared/entitlement.mjs';
import {resolveNativeActions,resolveNativeActionRequest,implementedNativeToolIds} from '../shared/native-actions.mjs';

// Trusted native parent supplies state/config and acknowledges every protected
// write before execution continues. Renderer fields cannot configure this host.
export async function runLicenseAction({action,params={},state,config,saveState,fetchImpl}) {
 if(!['support','status','trial','activate','refresh','devices','validate','nativeActions'].includes(action)||!params||typeof params!=='object'
  ||Object.keys(params).some(key=>action==='nativeActions'?!['files','platform','actionId','outputMode'].includes(key):action!=='activate'||key!=='licenseKey'))throw Error('Invalid license action');
 if(action==='nativeActions'){
  if(!Array.isArray(params.files)||params.files.length>256)throw Error('Invalid selection');
  let authorized=false;
  if(state?.device&&state?.license&&config?.keys&&!state.license.deactivationPending){
   try{const {verifyEntitlement}=await import('../shared/entitlement.mjs');verifyEntitlement(state.license.entitlement,{keys:config.keys,deviceId:deviceIdentity(state.device.publicKey),lastTrustedTime:state.license.lastTrustedTime||0});authorized=true;}catch{}
  }
  const context={files:params.files,platform:params.platform,authorized,outputMode:params.outputMode,installedTools:config?.installedTools??implementedNativeToolIds};
  const actions=resolveNativeActions(context).map(({id,label,tool,options,direct,requiresUI})=>({id,label,tool,options,direct,requiresUI}));
  if(params.actionId){const request=resolveNativeActionRequest(params.actionId,context);return {actions,action:{id:request.actionId,tool:request.tool,options:request.options,direct:request.direct,requiresUI:request.requiresUI}};}
  return {actions};
 }
 if(action==='status'&&!state?.license)return {license:'not-activated'};
 if(action!=='support'&&(!config?.keys||!Object.keys(config.keys).length))throw Error('License service configuration is not available in this build');
 let current=state;
 if(!current?.device){
  if(current)throw Error('Private device state is damaged');
  const pair=generateKeyPairSync('ed25519');current={schema:1,device:{publicKey:pair.publicKey.export({format:'pem',type:'spki'}),privateKey:pair.privateKey.export({format:'pem',type:'pkcs8'})},license:null};
  await saveState(current);
 }
 if(action==='support')return {supportDeviceId:deviceIdentity(current.device.publicKey)};
 const client=new LicenseClient({origin:config.origin,keys:config.keys,allowLocalTesting:config.allowLocalTesting===true,
  readDevice:async()=>current.device,readLicense:async()=>current.license,
  saveLicense:async license=>{const next={...current,license};await saveState(next);current=next;},...(fetchImpl?{fetchImpl}:{})});
 // This display hint never grants access. Paid activation still requires a
 // device proof, provider validation and a signed entitlement in LicenseClient.
 const activationAvailable=!current.license?.licenseRef&&!current.license?.licenseKey;
 if(action==='validate'){
  const result=await client.validateOnline();
  if(!result.checked)return {};
  return result.active?{license:'active',plan:result.plan,expiresAt:result.expiresAt}:{license:'needs-verification',activationAvailable:false};
 }
 if(action==='status'){try{const result=await client.authorize();return {license:result.plan==='trial'?'trial':'active',activationAvailable,...result};}catch{return {license:'needs-verification',activationAvailable};}}
 if(action==='devices')return {devices:await client.devices()};
 const result=await (action==='activate'?client.activate(params.licenseKey):client[action]());
 return {license:result.plan==='trial'?'trial':'active',activationAvailable:result.plan==='trial',...result};
}
