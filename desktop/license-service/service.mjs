import {entitlementClaims,signEntitlement} from './signing.mjs';

const reconciliationRequired=()=>Object.assign(Error('Activation requires reconciliation'),{code:'activationReconciliation',httpStatus:409});

// Application layer, deliberately separate from HTTP and deploy-specific identity providers.
// All public actions require device proof. No client-provided plan/status can issue a grant.
export class LicenseService {
 constructor({store,guard,dodo,authority,signing,verifyTrialSubject,now=()=>Math.floor(Date.now()/1000)}){signEntitlement({configurationCheck:true},signing);store.pinActivationKey(guard.activationFingerprint(''));Object.assign(this,{store,guard,dodo,authority,signing,verifyTrialSubject,now});}
 challenge(request){return this.guard.issue(request);}
 issue(license,deviceId,trial){return signEntitlement(entitlementClaims({license,deviceId,trial,now:this.now()}),this.signing);}
 async execute(action,request){
  const deviceId=this.guard.verify({...request,action}),body=request.body;
  if(action==='trial'){
   if(!this.verifyTrialSubject)throw Error('Trial verification unavailable');
   // Provider returns an opaque, stable server-verified subject hash. Never accept an
   // editable installation ID/email as trial eligibility, or trust a UI verified flag.
   const subject=await this.verifyTrialSubject(body.subjectToken);if(typeof subject!=='string'||!/^[a-f0-9]{64}$/.test(subject))throw Error('Trial identity unavailable');
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
    const license=this.store.activate(state.ref,deviceId,previous.instance_id,this.now(),{existingOnly:true});
    return {licenseRef:state.ref,instanceId:previous.instance_id,entitlement:this.issue(license,deviceId)};
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
    const license=this.store.activate(state.ref,deviceId,activation.id,this.now());registered=true;
    const entitlement=this.issue(license,deviceId);
    this.store.finishActivation(fingerprint,deviceId,'complete');
    return {licenseRef:state.ref,instanceId:activation.id,entitlement};
   }catch(error){
    if(registered)this.store.deactivate(activation.license_key_id,deviceId);
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
  if(action==='deactivate'){
   await this.dodo.deactivate(body.licenseKey,body.instanceId);this.store.deactivate(body.licenseRef,deviceId);return {deactivated:true};
  }
  if(action==='refresh'){
   const valid=await this.dodo.validate(body.licenseKey,body.instanceId);if(valid?.valid!==true)throw Error('License no longer valid');
   this.store.sync(await this.authority.resolve({customerId:binding.customer_id,licenseRef:body.licenseRef}));
   // Reuse the atomic activation check to enforce current status/period immediately before signing.
   const license=this.store.activate(body.licenseRef,deviceId,body.instanceId,this.now(),{existingOnly:true});return {entitlement:this.issue(license,deviceId)};
  }
  throw Error('Unknown license action');
 }
}
