import {sign,randomBytes} from 'node:crypto';
import {verifyValidationProof} from '../shared/validation-proof.mjs';
import {deviceIdentity,verifyEntitlement} from '../shared/entitlement.mjs';
import {requestContext} from '../shared/license-request.mjs';

// Native-host adapter. The UI never receives the private key, provider key or raw
// entitlement. Storage callbacks must use protected OS storage in the final host.
export class LicenseClient {
 constructor({origin='https://license.sorafiles.com',keys,readDevice,readLicense,saveLicense,fetchImpl=fetch,now=Date.now,allowLocalTesting=false}){
  const url=new URL(origin);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||
   !(url.origin==='https://license.sorafiles.com'||allowLocalTesting&&url.protocol==='http:'&&url.hostname==='127.0.0.1'))throw Error('Untrusted license service');
  if(!keys||!Object.keys(keys).length||[readDevice,readLicense,saveLicense,fetchImpl,now].some(value=>typeof value!=='function'))throw Error('Native license configuration required');
  Object.assign(this,{origin:url.origin,keys,readDevice,readLicense,saveLicense,fetchImpl,now});this.busy=false;
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
 async trial(){return this.exclusive(async()=>{
  const device=await this.readDevice(),saved=await this.readLicense();
  if(saved?.licenseRef)throw Error('A paid license is already configured');
  const response=await this.request('trial',{},device);
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
