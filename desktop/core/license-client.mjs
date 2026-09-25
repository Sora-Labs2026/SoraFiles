import {sign,randomBytes} from 'node:crypto';
import {verifyValidationProof} from '../shared/validation-proof.mjs';
import {deviceIdentity,verifyEntitlement} from '../shared/entitlement.mjs';
import {requestContext} from '../shared/license-request.mjs';
import {replacementPrice} from '../shared/replacement-prices.mjs';

// Native-host adapter. The UI never receives the private key, provider key or raw
// entitlement. Storage callbacks must use protected OS storage in the final host.
export class LicenseClient {
 constructor({origin='https://license.sorafiles.com',keys,readDevice,readLicense,saveLicense,readReplacement=async()=>null,saveReplacement=async()=>{},fetchImpl=fetch,now=Date.now,allowLocalTesting=false}){
  const url=new URL(origin);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||
   !(url.origin==='https://license.sorafiles.com'||allowLocalTesting&&url.protocol==='http:'&&url.hostname==='127.0.0.1'))throw Error('Untrusted license service');
  if(!keys||!Object.keys(keys).length||[readDevice,readLicense,saveLicense,fetchImpl,now].some(value=>typeof value!=='function'))throw Error('Native license configuration required');
  Object.assign(this,{origin:url.origin,keys,readDevice,readLicense,saveLicense,readReplacement,saveReplacement,fetchImpl,now});this.busy=false;
 }
 async post(route,body){
  const response=await this.fetchImpl(this.origin+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok){await response.body?.cancel();throw Error(response.status===409?'Activation needs to be checked. Contact SoraFiles support.':response.status===429?'Please wait a moment and try again.':'License verification could not finish. Try again later.');}
  if(!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||'')||!response.body)throw Error('Invalid license response');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>16384)throw Error('License response too large');chunks.push(part.value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('Invalid license response');}
 }
 async request(action,body,device){
  const context=requestContext(action,body),deviceId=deviceIdentity(device.publicKey);
  const {challenge,token}=await this.post('/v1/challenge',{action,body,publicKey:device.publicKey});
  const time=Math.floor(this.now()/1000);
  if(!challenge||challenge.deviceId!==deviceId||challenge.context!==context||!Number.isSafeInteger(challenge.expires)||challenge.expires<time||challenge.expires>time+300
   ||typeof challenge.id!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(challenge.id)||typeof token!=='string'||token.length>2048)throw Error('Invalid license challenge');
  const signature=sign(null,Buffer.from(`sorafiles-device-v1\n${challenge.id}\n${context}\n${challenge.expires}`),device.privateKey).toString('base64url');
  return this.post('/v1/'+action,{body,publicKey:device.publicKey,signature,token});
 }
 async exclusive(run){if(this.busy)throw Error('Finish the current license action first');this.busy=true;try{return await run();}finally{this.busy=false;}}
 verify(token,device,lastTrustedTime=0){return verifyEntitlement(token,{keys:this.keys,deviceId:deviceIdentity(device.publicKey),now:this.now(),lastTrustedTime});}
 async trial(installedAt){return this.exclusive(async()=>{
  const device=await this.readDevice(),saved=await this.readLicense();
  if(saved?.licenseRef)throw Error('A paid license is already configured');
  const response=await this.request('trial',installedAt===undefined?{}:{installedAt},device);
  const claims=this.verify(response.entitlement,device,saved?.lastTrustedTime||0);if(claims.plan!=='trial')throw Error('Invalid trial response');
  // Starting a trial cannot silently replace an existing paid activation.
  await this.saveLicense({entitlement:response.entitlement,lastTrustedTime:this.now()});
  return {plan:claims.plan,expiresAt:claims.exp};
 });}
 async activate(licenseKey){return this.exclusive(async()=>{
  requestContext('activate',{licenseKey});const device=await this.readDevice(),saved=await this.readLicense();
  if(saved?.licenseKey&&saved.licenseKey.trim()!==licenseKey.trim())throw Error('This device is already bound to a license');
  if(saved?.deactivationPending)throw Error('This saved license needs online verification');
  const response=await this.request('activate',{licenseKey},device),claims=this.verify(response.entitlement,device,saved?.lastTrustedTime||0);
  if(claims.plan==='trial'||claims.licenseRef!==response.licenseRef||typeof response.instanceId!=='string'||!response.instanceId||response.instanceId.length>512)throw Error('Invalid activation response');
  await this.saveLicense({licenseKey,licenseRef:response.licenseRef,instanceId:response.instanceId,entitlement:response.entitlement,lastTrustedTime:this.now()});
  return {plan:claims.plan,expiresAt:claims.exp,maxDevices:claims.maxDevices};
 });}
 async refresh(){return this.exclusive(async()=>{
  const device=await this.readDevice(),saved=await this.readLicense();if(!saved?.licenseRef||!saved?.instanceId||!saved?.licenseKey)throw Error('Activate a paid license first');
  if(saved.deactivationPending)throw Error('This saved license needs online verification');
  const body={licenseKey:saved.licenseKey,licenseRef:saved.licenseRef,instanceId:saved.instanceId};
  const response=await this.request('refresh',body,device),claims=this.verify(response.entitlement,device,saved.lastTrustedTime||0);
  if(claims.plan==='trial'||claims.licenseRef!==saved.licenseRef)throw Error('Invalid renewal response');
  await this.saveLicense({...saved,entitlement:response.entitlement,lastTrustedTime:this.now()});return {plan:claims.plan,expiresAt:claims.exp,maxDevices:claims.maxDevices};
 });}
 async devices(){return this.exclusive(async()=>{
  const device=await this.readDevice(),saved=await this.readLicense();if(!saved?.licenseRef)throw Error('Activate a paid license first');
  const response=await this.request('devices',{licenseRef:saved.licenseRef},device);
  if(!Array.isArray(response.devices)||response.devices.length>256||response.devices.some(row=>!row||typeof row.id!=='string'||row.id.length>128||typeof row.current!=='boolean'||typeof row.active!=='boolean'))throw Error('Invalid device list');
  return response.devices.map(({id,current,active})=>({id,current,active}));
 });}
 async replacementState(){return {replacement:publicReplacement(await this.readReplacement())};}
 async replacementEmailStart(licenseKey){return this.exclusive(async()=>{
  const previous=await this.readReplacement(),saved=await this.readLicense();
  const key=licenseKey||previous?.licenseKey||saved?.licenseKey;
  if(previous?.orderId&&key!==previous.licenseKey)throw Error('Check your existing replacement payment first.');
  requestContext('replacementEmailStart',{licenseKey:key});
  const response=await this.request('replacementEmailStart',{licenseKey:key},await this.readDevice());
  if(!boundedId(response.verificationId)||typeof response.maskedEmail!=='string'||response.maskedEmail.length>254||!response.maskedEmail.includes('*')||/[\x00-\x1f]/.test(response.maskedEmail)||!futureTime(response.expiresAt,this.now())||!Number.isSafeInteger(response.resendAfter))throw Error('Invalid email verification response');
  await this.saveReplacement({...previous,stage:'email',licenseKey:key,verificationId:response.verificationId,maskedEmail:response.maskedEmail,expiresAt:response.expiresAt,resendAfter:response.resendAfter});
  return this.replacementState();
 });}
 async replacementEmailVerify(code){return this.exclusive(async()=>{
  const flow=await this.readReplacement();if(flow?.stage!=='email'||!futureTime(flow.expiresAt,this.now()))throw Error('Request a new email code.');
  if(typeof code!=='string'||!/^\d{8}$/.test(code))throw Error('Enter the eight-digit email code.');
  const response=await this.request('replacementEmailVerify',{verificationId:flow.verificationId,code},await this.readDevice());
  if(typeof response.identityToken!=='string'||!response.identityToken||response.identityToken.length>4096||!boundedId(response.licenseRef)||!futureTime(response.expiresAt,this.now())||!validDevices(response.devices))throw Error('Invalid email verification response');
  replacementPrice(response.plan);
  if(flow.orderId&&(response.licenseRef!==flow.licenseRef||response.plan!==flow.plan))throw Error('Replacement license changed');
  await this.saveReplacement({...flow,stage:flow.orderId?'payment':'verified',identityToken:response.identityToken,licenseRef:response.licenseRef,plan:response.plan,devices:response.devices,expiresAt:response.expiresAt});
  return this.replacementState();
 });}
 async replacementRequest(oldDeviceId){return this.exclusive(async()=>{
  const flow=await this.readReplacement();if(flow?.stage!=='verified'||!futureTime(flow.expiresAt,this.now()))throw Error('Verify your email again to continue.');
  if(!flow.devices.some(row=>row.id===oldDeviceId&&row.active&&!row.current))throw Error('Choose an active device to replace.');
  const result=await this.request('replacementRequest',{licenseRef:flow.licenseRef,oldDeviceId,licenseKey:flow.licenseKey,identityToken:flow.identityToken},await this.readDevice());
  validateReplacementOrder(result,flow.plan);
  await this.saveReplacement({...flow,stage:'payment',oldDeviceId,orderId:result.orderId,status:result.status,checkoutUrl:result.checkoutUrl||null});return this.replacementState();
 });}
 async replacementStatus(){
  const result=await this.exclusive(async()=>{
   const flow=await this.readReplacement();if(!flow?.orderId)throw Error('No replacement payment to check.');
   const response=await this.request('replacementStatus',{orderId:flow.orderId,licenseKey:flow.licenseKey,identityToken:flow.identityToken},await this.readDevice());
   validateReplacementOrder(response,flow.plan);if(response.orderId!==flow.orderId)throw Error('Invalid replacement payment response');
   await this.saveReplacement({...flow,status:response.status});return {complete:response.status==='complete'&&response.replacementAuthorized===true,key:flow.licenseKey};
  });
  // Payment authorizes a normal activation; it never supplies a local entitlement.
  if(result.complete){const activation=await this.activate(result.key);await this.saveReplacement(null);return {...activation,license:'active',activationAvailable:false,replacement:{stage:'complete'}};}
  return this.replacementState();
 }
 async replacementCheckout(){const flow=await this.readReplacement();if(flow?.stage!=='payment'||!trustedCheckout(flow.checkoutUrl))throw Error('Payment page unavailable.');return {checkoutUrl:flow.checkoutUrl};}
 async validateOnline(){return this.exclusive(async()=>{
  const device=await this.readDevice(),saved=await this.readLicense();
  if(!saved?.licenseRef||!saved.instanceId||!saved.licenseKey)return {checked:false};
  const nonce=randomBytes(32).toString('base64url');
  const body={licenseKey:saved.licenseKey,licenseRef:saved.licenseRef,instanceId:saved.instanceId,nonce};
  const response=await this.request('validate',body,device);
  const proof=verifyValidationProof(response.validation,{keys:this.keys,deviceId:deviceIdentity(device.publicKey),licenseRef:saved.licenseRef,instanceId:saved.instanceId,nonce,now:this.now()});
  if(proof.status==='inactive'){
   await this.saveLicense({...saved,deactivationPending:true,lastTrustedTime:Math.max(saved.lastTrustedTime||0,this.now())});
   return {checked:true,active:false};
  }
  const claims=this.verify(proof.entitlement,device,saved.lastTrustedTime||0);
  if(claims.plan==='trial'||claims.licenseRef!==saved.licenseRef)throw Error('Invalid validation entitlement');
  await this.saveLicense({...saved,deactivationPending:false,entitlement:proof.entitlement,lastTrustedTime:Math.max(saved.lastTrustedTime||0,this.now())});
  return {checked:true,active:true,plan:claims.plan,expiresAt:claims.exp};
 });}
 async authorize(){return this.exclusive(async()=>{const device=await this.readDevice(),saved=await this.readLicense();if(!saved)throw Error('Start a trial or activate a license');if(saved.deactivationPending)throw Error('This saved license needs online verification');const claims=this.verify(saved.entitlement,device,saved.lastTrustedTime||0);await this.saveLicense({...saved,lastTrustedTime:Math.max(saved.lastTrustedTime||0,this.now())});return {plan:claims.plan,expiresAt:claims.exp};});}
}

const boundedId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const futureTime=(value,now)=>Number.isSafeInteger(value)&&value>Math.floor(now/1000)&&value<=Math.floor(now/1000)+86400;
const validDevices=value=>Array.isArray(value)&&value.length<=256&&value.every(row=>row&&/^[A-Za-z0-9_-]{43}$/.test(row.id)&&typeof row.active==='boolean'&&typeof row.current==='boolean');
export function trustedCheckout(value){try{const url=new URL(value);return typeof value==='string'&&value.length<=4096&&url.protocol==='https:'&&['checkout.dodopayments.com','test.checkout.dodopayments.com'].includes(url.hostname)&&!url.username&&!url.password&&!url.port;}catch{return false;}}
function validateReplacementOrder(value,plan){const fee=replacementPrice(plan);if(!boundedId(value?.orderId)||!['payment-pending','payment-confirmed','payment-failed','complete'].includes(value.status)||value.fee?.plan!==plan||value.fee.amount!==fee.amount||value.fee.currency!=='USD'||value.checkoutUrl&&!trustedCheckout(value.checkoutUrl))throw Error('Invalid replacement payment response');}
function publicReplacement(flow){if(!flow)return {stage:'idle'};return {stage:flow.stage,maskedEmail:flow.maskedEmail,expiresAt:flow.expiresAt,resendAfter:flow.resendAfter,...(flow.plan?{plan:flow.plan,fee:replacementPrice(flow.plan),devices:flow.devices.map(({id,current,active})=>({id,current,active}))}:{}),...(flow.status?{status:flow.status,checkoutAvailable:trustedCheckout(flow.checkoutUrl)}:{})};}
