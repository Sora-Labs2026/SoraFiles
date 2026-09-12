import {entitlementClaims,signEntitlement} from './signing.mjs';

// Application layer, deliberately separate from HTTP and deploy-specific identity providers.
// All public actions require device proof. No client-provided plan/status can issue a grant.
export class LicenseService {
 constructor({store,guard,dodo,authority,signing,verifyTrialSubject,now=()=>Math.floor(Date.now()/1000)}){signEntitlement({configurationCheck:true},signing);Object.assign(this,{store,guard,dodo,authority,signing,verifyTrialSubject,now});}
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
   const activation=await this.dodo.activate(body.licenseKey,deviceId);
   if(!activation?.id||!activation.license_key_id||!activation.customer?.customer_id)throw Error('Invalid activation response');
   let registered=false;
   try{
    const state=await this.authority.resolve({customerId:activation.customer.customer_id,licenseRef:activation.license_key_id});
    this.store.sync(state);this.store.bind(state.ref,activation.customer.customer_id);
    const license=this.store.activate(state.ref,deviceId,activation.id,this.now());registered=true;
    return {licenseRef:state.ref,instanceId:activation.id,entitlement:this.issue(license,deviceId)};
   }catch(error){
    if(registered)this.store.deactivate(activation.license_key_id,deviceId);
    // A failed compensation must remain visible; it needs reconciliation before retry.
    try{await this.dodo.deactivate(body.licenseKey,activation.id);}catch{throw Error('Activation requires reconciliation');}
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
   const license=this.store.activate(body.licenseRef,deviceId,body.instanceId,this.now());return {entitlement:this.issue(license,deviceId)};
  }
  throw Error('Unknown license action');
 }
}
