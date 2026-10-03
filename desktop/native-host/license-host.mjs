import {generateKeyPairSync} from 'node:crypto';
import {LicenseClient} from '../core/license-client.mjs';
import {deviceIdentity,verifyEntitlement} from '../shared/entitlement.mjs';
import {resolveNativeActions,resolveNativeActionRequest,implementedNativeToolIds} from '../shared/native-actions.mjs';
import {localizeNativeActions} from '../shared/menu-localization.mjs';
import {replacementMessageList} from '../shared/replacement-messages.mjs';

// Star ratings share the website's store (sorafiles.com). The anonymous rater id
// is a one-way HMAC of this installation's private device key: stable, never
// sent in raw form, and unlinkable to the licence device id (a public-key hash).
const RATING_ORIGIN='https://sorafiles.com';
const ratingSubjects=new Set(['sorafiles',...implementedNativeToolIds]);
async function toolRating({action,params,state,fetchImpl=fetch}){
 if(!ratingSubjects.has(params.subject)||action==='ratingSubmit'&&!(Number.isInteger(params.rating)&&params.rating>=1&&params.rating<=5))throw Error('Invalid rating');
 const key=state?.device?.privateKey;if(typeof key!=='string'||!key)throw Error('Ratings are available once SoraFiles is set up');
 const {createHmac}=await import('node:crypto');
 const rater=createHmac('sha256',key).update('sorafiles-rating-v1').digest('base64url');
 const response=await fetchImpl(`${RATING_ORIGIN}/__sf/ratings/${params.subject}`,{method:'POST',headers:{'Content-Type':'application/json','X-SoraFiles-Client':'desktop'},body:JSON.stringify(action==='ratingSubmit'?{rater,rating:params.rating}:{rater}),redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error(response.status===429?'Too many ratings. Please try again later.':'Ratings are unavailable right now.');
 const body=await response.json(),rating=value=>value===null||Number.isInteger(value)&&value>=1&&value<=5;
 if(body?.subject!==params.subject||!Number.isSafeInteger(body.count)||body.count<0||!(body.average===null||typeof body.average==='number'&&body.average>=1&&body.average<=5)||!rating(body.userRating))throw Error('Invalid rating response');
 return {subject:body.subject,count:body.count,average:body.average,userRating:body.userRating};
}

// Trusted native parent supplies state/config and acknowledges every protected
// write before execution continues. Renderer fields cannot configure this host.
export async function runLicenseAction({action,params={},state,config,saveState,fetchImpl,now=Date.now}) {
 const fields={support:[],status:[],prepareTrial:[],initializeTrial:[],trial:[],activate:['licenseKey'],refresh:[],devices:[],portal:[],validate:[],nativeActions:['files','platform','actionId','outputMode','locale'],replacementState:[],replacementEmailStart:['email','licenseKey'],replacementEmailResend:[],replacementReset:[],replacementEmailVerify:['code'],replacementRequest:['oldDeviceId'],replacementStatus:[],replacementCancel:[],replacementCheckout:[],ratingStatus:['subject'],ratingSubmit:['subject','rating']};
 if(!fields[action]||!params||typeof params!=='object'||Object.keys(params).some(key=>!fields[action].includes(key)))throw Error('Invalid license action');
 if(action==='ratingStatus'||action==='ratingSubmit')return {rating:await toolRating({action,params,state,fetchImpl})};
 if(action==='nativeActions'){
  if(!Array.isArray(params.files)||params.files.length>256)throw Error('Invalid selection');
  let authorized=false;
  if(state?.device&&state?.license&&config?.keys&&!state.license.deactivationPending){
   try{const {verifyEntitlement}=await import('../shared/entitlement.mjs');verifyEntitlement(state.license.entitlement,{keys:config.keys,deviceId:deviceIdentity(state.device.publicKey),lastTrustedTime:state.license.lastTrustedTime||0});authorized=true;}catch{}
  }
  const context={files:params.files,platform:params.platform,authorized,outputMode:params.outputMode,locale:params.locale,installedTools:config?.installedTools??implementedNativeToolIds};
  const actions=localizeNativeActions(resolveNativeActions(context),params.locale).map(({id,label,tool,options,direct,requiresUI})=>({id,label,tool,options,direct,requiresUI}));
  if(params.actionId){const request=resolveNativeActionRequest(params.actionId,context);return {actions,action:{id:request.actionId,tool:request.tool,options:request.options,direct:request.direct,requiresUI:request.requiresUI}};}
  return {actions};
 }
 const pending=()=>({license:'needs-verification',activationAvailable:true,trialPending:state?.installedAt+7*86400>Math.floor(now()/1000),expiresAt:state?.installedAt+7*86400});
 const revoked=()=>({license:'revoked',activationAvailable:true,trialPending:false,plan:'',expiresAt:null,devices:[]});
 if(['status','initializeTrial'].includes(action)&&state?.license?.revoked)return revoked();
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
  try{return await (action==='replacementEmailStart'?client[action]({email:params.email,licenseKey:params.licenseKey}):action==='replacementEmailVerify'?client[action](params.code):action==='replacementRequest'?client[action](params.oldDeviceId):client[action]());}
  catch(error){if(replacementMessageList.includes(error.message)||/^(Enter the eight-digit email code\.|Verify your email again to continue\.|Choose an active device to revoke\.|No revocation payment to cancel\.|Please wait a moment and try again\.)$/.test(error.message))throw error;throw Error('Device revocation could not finish. Check your code or payment and try again.');}
 }
 if(action==='validate'){
  const result=await client.validateOnline();
  if(!result.checked)return {};
  return result.active?{license:'active',plan:result.plan,expiresAt:result.expiresAt}:result.revoked?revoked():{license:'needs-verification',activationAvailable:false};
 }
 if(action==='status'){try{const result=await client.authorize();return {license:result.plan==='trial'?'trial':'active',activationAvailable,...result};}catch{return {license:'needs-verification',activationAvailable};}}
 if(action==='devices')return {devices:await client.devices()};
 if(action==='portal')return await client.portal();
 let result;
 try{result=await (action==='activate'?client.activate(params.licenseKey):action==='trial'||action==='initializeTrial'?client.trial(current.installedAt):client[action]());}
 catch(error){if(action!=='initializeTrial')throw error;return {license:'needs-verification',activationAvailable:true,trialPending:true,expiresAt:current.installedAt+7*86400};}
 return {license:result.plan==='trial'?'trial':'active',activationAvailable:result.plan==='trial',...result};
}
