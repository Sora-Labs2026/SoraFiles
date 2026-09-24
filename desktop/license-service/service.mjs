import {entitlementClaims,signEntitlement,signValidation} from './signing.mjs';
import {licensePlans} from '../shared/license-plans.mjs';

const reconciliationRequired=()=>Object.assign(Error('Activation requires reconciliation'),{code:'activationReconciliation',httpStatus:409});

// Application layer, deliberately separate from HTTP and deploy-specific identity providers.
// All public actions require device proof. No client-provided plan/status can issue a grant.
export class LicenseService {
 constructor({store,guard,dodo,authority,signing,replacements=null,replacementEmail=null,now=()=>Math.floor(Date.now()/1000)}){signEntitlement({configurationCheck:true,features:['process']},signing);store.pinActivationKey(guard.activationFingerprint(''));Object.assign(this,{store,guard,dodo,authority,signing,replacements,replacementEmail,now});}
 challenge(request){return this.guard.issue(request);}
 issue(license,deviceId,trial){return signEntitlement(entitlementClaims({license,deviceId,trial,now:this.now()}),this.signing);}
 async execute(action,request){
  const deviceId=this.guard.verify({...request,action}),body=request.body;
  if(action==='replacementEmailStart'||action==='replacementEmailVerify'){
   if(!this.replacementEmail)throw Object.assign(Error('Email verification is unavailable'),{code:'providerUnavailable'});
   return this.replacementEmail[action==='replacementEmailStart'?'start':'verify'](body,deviceId);
  }
  if(action==='replacementRequest'||action==='replacementStatus'){
   if(!this.replacements)throw Object.assign(Error('Replacement configuration required'),{code:'providerUnavailable'});
   return this.replacements[action==='replacementRequest'?'request':'status'](body,deviceId);
  }
  if(action==='validate')return this.validate(body,deviceId);
  if(action==='trial'){
   // Owner-selected accountless trial: only the proved device key determines the
   // ledger subject. A new key can represent a new device; no hardware tracking.
   const subject=this.guard.trialSubject(deviceId);
   const trial=this.store.existingTrial(subject,deviceId)||this.store.trial(subject,deviceId,this.now());if(trial.exp<=this.now())throw Error('Trial expired');return {entitlement:this.issue(null,deviceId,trial)};
  }
  if(action==='activate'){
   const fingerprint=this.guard.activationFingerprint(body.licenseKey);
   // Commit intent before contacting Dodo. A timeout or process crash must never
   // permit an automatic second activation that could consume another seat.
   if(!this.store.reserveActivation(fingerprint,deviceId,this.now())){
    const previous=this.store.activationAttempt(fingerprint,deviceId);
    if(previous?.status!=='complete')throw reconciliationRequired();
    const local=this.store.active(previous.license_ref,deviceId);
    if(!local||local.instance_id!==previous.instance_id)throw reconciliationRequired();
    const valid=await this.dodo.validate(body.licenseKey,previous.instance_id);
    if(valid?.valid!==true)throw Error('License no longer valid');
    const state=await this.authority.resolve({customerId:previous.customer_id,licenseRef:previous.license_ref});
    if(state.ref!==previous.license_ref)throw Error('License reference mismatch');
    this.store.sync(state);
    const entitlement=this.store.issueForDevice(state.ref,deviceId,previous.instance_id,this.now(),license=>this.issue(license,deviceId));
    return {licenseRef:state.ref,instanceId:previous.instance_id,entitlement};
   }
   let activation;
   try{
    activation=await this.dodo.activate(body.licenseKey,deviceId);
    if([activation?.id,activation?.license_key_id,activation?.customer?.customer_id].some(value=>typeof value!=='string'||!value||value.length>512))throw Error('Invalid activation response');
    this.store.recordActivation(fingerprint,deviceId,activation);
   }catch(error){
    // Explicit client rejections did not create a seat. Network/server errors and
    // incomplete responses are ambiguous, including crashes before recording IDs.
    if(error.code==='providerRejected'&&[400,401,403,404,409,422].includes(error.status)){
     this.store.forgetActivation(fingerprint,deviceId);throw error;
    }
    this.store.finishActivation(fingerprint,deviceId,'blocked');throw reconciliationRequired();
   }
   let registered=false;
   try{
    const state=await this.authority.resolve({customerId:activation.customer.customer_id,licenseRef:activation.license_key_id});
    if(state.ref!==activation.license_key_id)throw Error('License reference mismatch');
    this.store.sync(state);this.store.bind(state.ref,activation.customer.customer_id);
    this.store.activate(state.ref,deviceId,activation.id,this.now(),{provisional:true});registered=true;
    const entitlement=this.store.finishActivation(fingerprint,deviceId,'complete',this.now(),current=>this.issue(current,deviceId));
    return {licenseRef:state.ref,instanceId:activation.id,entitlement};
   }catch(error){
    if(registered)this.store.rollbackActivation(activation.license_key_id,deviceId);
    // A failed compensation must remain visible; it needs reconciliation before retry.
    try{await this.dodo.deactivate(body.licenseKey,activation.id);}catch{this.store.finishActivation(fingerprint,deviceId,'blocked');throw reconciliationRequired();}
    this.store.forgetActivation(fingerprint,deviceId);
    throw error;
   }
  }
  const local=this.store.active(body.licenseRef,deviceId),binding=this.store.binding(body.licenseRef);
  if(!local||!binding)throw Error('Device is not activated');
  if(action==='devices')return {devices:this.store.devices(body.licenseRef).map(d=>({id:d.device_id,current:d.device_id===deviceId,active:!!d.active}))};
  if(local.instance_id!==body.instanceId)throw Error('Wrong activation instance');
  if(action==='refresh'){
   const valid=await this.dodo.validate(body.licenseKey,body.instanceId);if(valid?.valid!==true)throw Error('License no longer valid');
   this.store.sync(await this.authority.resolve({customerId:binding.customer_id,licenseRef:body.licenseRef}));
   const entitlement=this.store.issueForDevice(body.licenseRef,deviceId,body.instanceId,this.now(),license=>this.issue(license,deviceId));return {entitlement};
  }
  throw Error('Unknown license action');
 }
 async validate(body,deviceId){
  const {licenseRef,instanceId,nonce,licenseKey}=body,keyHash=this.guard.activationFingerprint(licenseKey);
  const history=this.store.db.prepare('SELECT 1 FROM activation_attempts WHERE key_hash=? AND device_id=? AND license_ref=? AND instance_id=?').get(keyHash,deviceId,licenseRef,instanceId);
  const replaced=()=>this.store.db.prepare("SELECT 1 FROM paid_replacements WHERE license_ref=? AND old_device=? AND instance_id=? AND key_hash=? AND status IN ('paid','complete') UNION SELECT 1 FROM support_replacements WHERE license_ref=? AND old_device=? AND instance_id=? AND key_hash=?").get(licenseRef,deviceId,instanceId,keyHash,licenseRef,deviceId,instanceId,keyHash);
  const binding=this.store.binding(licenseRef);if(!binding||(!history&&!replaced()))throw Error('Activation history required');
  const answer=(status,reason,entitlement)=>{const now=this.now();return {validation:signValidation({schema:1,iss:'sorafiles-license-service',aud:'sorafiles-desktop',deviceId,licenseRef,instanceId,nonce,iat:now,exp:now+300,status,...(reason?{reason}:{}),...(entitlement?{entitlement}:{})},this.signing)};};
  if(replaced())return answer('inactive','device-replaced');
  // Provider/authority failures propagate without a signed revocation. Offline
  // access changes only after an authenticated, request-bound authoritative reply.
  const valid=await this.dodo.validate(licenseKey,instanceId);
  if(typeof valid?.valid!=='boolean')throw Object.assign(Error('Invalid provider response'),{code:'providerUnavailable'});
  const state=await this.authority.resolve({customerId:binding.customer_id,licenseRef});
  if(state.ref!==licenseRef)throw Error('License reference mismatch');this.store.sync(state);
  return this.store.transaction(()=>{
   if(replaced())return answer('inactive','device-replaced');
   const license=this.store.db.prepare('SELECT * FROM licenses WHERE ref=?').get(licenseRef);
   if(license.status!=='active'||!valid.valid||!this.store.active(licenseRef,deviceId))return answer('inactive','license-inactive');
   if(licensePlans[license.plan].interval!=='lifetime'&&license.period_end<=this.now())return answer('inactive','subscription-expired');
   return answer('active',null,this.issue(this.store.currentLicense(licenseRef,deviceId,instanceId,this.now()),deviceId));
  });
 }
}
