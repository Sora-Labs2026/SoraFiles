import {generateKeyPairSync} from 'node:crypto';
import {LicenseClient} from '../core/license-client.mjs';
import {deviceIdentity,verifyEntitlement} from '../shared/entitlement.mjs';
import {resolveNativeActions,resolveNativeActionRequest,implementedNativeToolIds} from '../shared/native-actions.mjs';

// Trusted native parent supplies state/config and acknowledges every protected
// write before execution continues. Renderer fields cannot configure this host.
export async function runLicenseAction({action,params={},state,config,saveState,fetchImpl,now=Date.now}) {
 const fields={support:[],status:[],prepareTrial:[],initializeTrial:[],trial:[],activate:['licenseKey'],refresh:[],devices:[],validate:[],nativeActions:['files','platform','actionId','outputMode'],replacementState:[],replacementEmailStart:['licenseKey'],replacementEmailVerify:['code'],replacementRequest:['oldDeviceId'],replacementStatus:[],replacementCheckout:[]};
 if(!fields[action]||!params||typeof params!=='object'||Object.keys(params).some(key=>!fields[action].includes(key)))throw Error('Invalid license action');
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
 const pending=()=>({license:'needs-verification',activationAvailable:true,trialPending:state?.installedAt+7*86400>Math.floor(now()/1000),expiresAt:state?.installedAt+7*86400});
 if(action==='status'&&!state?.license)return state?.installedAt?pending():{license:'not-activated'};
 if(!['support','prepareTrial','initializeTrial'].includes(action)&&(!config?.keys||!Object.keys(config.keys).length))throw Error('License service configuration is not available in this build');
 let current=state;
 if(!current?.device){
  if(current)throw Error('Private device state is damaged');
  const pair=generateKeyPairSync('ed25519');current={schema:1,device:{publicKey:pair.publicKey.export({format:'pem',type:'spki'}),privateKey:pair.privateKey.export({format:'pem',type:'pkcs8'})},license:null};
  if(['prepareTrial','initializeTrial','trial'].includes(action))current.installedAt=Math.floor(now()/1000);
  await saveState(current);
 }
 if(action==='support')return {supportDeviceId:deviceIdentity(current.device.publicKey)};
 if(['prepareTrial','initializeTrial','trial'].includes(action)&&!current.license&&!current.installedAt){
  const next={...current,installedAt:Math.floor(now()/1000)};await saveState(next);current=next;
 }
 if(action==='prepareTrial')return {};
 if(action==='initializeTrial'&&current.license){
  const activationAvailable=!current.license.licenseRef&&!current.license.licenseKey;
  try{if(current.license.deactivationPending)throw Error('Verification required');const claims=verifyEntitlement(current.license.entitlement,{keys:config?.keys,deviceId:deviceIdentity(current.device.publicKey),now:now(),lastTrustedTime:current.license.lastTrustedTime||0});return {license:claims.plan==='trial'?'trial':'active',plan:claims.plan,expiresAt:claims.exp,activationAvailable};}
  catch{return {license:'needs-verification',activationAvailable};}
 }
 if(action==='initializeTrial'&&(!config?.keys||!Object.keys(config.keys).length||current.installedAt+7*86400<=Math.floor(now()/1000)))return {license:'needs-verification',activationAvailable:true,trialPending:current.installedAt+7*86400>Math.floor(now()/1000),expiresAt:current.installedAt+7*86400};
 const client=new LicenseClient({origin:config.origin,keys:config.keys,allowLocalTesting:config.allowLocalTesting===true,
  readDevice:async()=>current.device,readLicense:async()=>current.license,
  readReplacement:async()=>current.replacement||null,saveReplacement:async replacement=>{const next={...current,replacement};await saveState(next);current=next;},
  saveLicense:async license=>{const next={...current,license};await saveState(next);current=next;},now,...(fetchImpl?{fetchImpl}:{})});
 // This display hint never grants access. Paid activation still requires a
 // device proof, provider validation and a signed entitlement in LicenseClient.
 const activationAvailable=!current.license?.licenseRef&&!current.license?.licenseKey;
 if(action.startsWith('replacement')){
  try{return await (action==='replacementEmailStart'?client[action](params.licenseKey):action==='replacementEmailVerify'?client[action](params.code):action==='replacementRequest'?client[action](params.oldDeviceId):client[action]());}
  catch(error){if(/^(Request a new email code\.|Enter the eight-digit email code\.|Verify your email again to continue\.|Choose an active device to replace\.|Check your existing replacement payment first\.|Please wait a moment and try again\.)$/.test(error.message))throw error;throw Error('Device replacement could not finish. Check your code or payment and try again.');}
 }
 if(action==='validate'){
  const result=await client.validateOnline();
  if(!result.checked)return {};
  return result.active?{license:'active',plan:result.plan,expiresAt:result.expiresAt}:{license:'needs-verification',activationAvailable:false};
 }
 if(action==='status'){try{const result=await client.authorize();return {license:result.plan==='trial'?'trial':'active',activationAvailable,...result};}catch{return {license:'needs-verification',activationAvailable};}}
 if(action==='devices')return {devices:await client.devices()};
 let result;
 try{result=await (action==='activate'?client.activate(params.licenseKey):action==='trial'||action==='initializeTrial'?client.trial(current.installedAt):client[action]());}
 catch(error){if(action!=='initializeTrial')throw error;return {license:'needs-verification',activationAvailable:true,trialPending:true,expiresAt:current.installedAt+7*86400};}
 return {license:result.plan==='trial'?'trial':'active',activationAvailable:result.plan==='trial',...result};
}
