import {verifyDodoWebhook} from './signing.mjs';

// A verified webhook invalidates cached authority. Persist only its delivery ID/time;
// customer names, email addresses, payment details and raw payload are not retained.
// Coalesce deliveries into one sweep of existing registrations. New purchases resolve
// directly from Dodo on activation, so a webhook never itself creates a device grant.
export class WebhookInbox {
 #running=false;
 constructor({store,authority,secret,now=()=>Math.floor(Date.now()/1000)}){Object.assign(this,{store,authority,secret,now});}
 accept(raw,headers){const {id}=verifyDodoWebhook(raw,headers,this.secret,{now:this.now()});return {accepted:true,duplicate:!this.store.queueWebhook(id,this.now())};}
 async reconcile({signal}={}){
  if(this.#running)return {busy:true};this.#running=true;
  try{const boundary=this.store.pendingWebhookBoundary();if(boundary===null)return {updated:0};
   let after='',updated=0;
   while(true){signal?.throwIfAborted();const rows=this.store.bindingPage(after,100);if(!rows.length)break;
    for(const row of rows){signal?.throwIfAborted();const state=await this.authority.resolve({customerId:row.customer_id,licenseRef:row.license_ref});this.store.sync(state);updated++;after=row.license_ref;}
   }
   // If Dodo fails or shutdown interrupts, no ack is recorded; restart safely retries.
   this.store.completeWebhooks(boundary,this.now());return {updated};
  }finally{this.#running=false;}
 }
}
