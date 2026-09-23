// Resumable alarm work: one bounded page per invocation. Receipts arriving during
// a sweep remain pending for the next sweep. Advance only after authority commits.
export async function reconcileBatch(store,authority,{limit=10,now=()=>Math.floor(Date.now()/1000)}={}){
 const db=store.db;
 let sweep=JSON.parse(db.prepare("SELECT value FROM service_metadata WHERE name='cf-webhook-sweep'").get()?.value||'null');
 if(!sweep){const boundary=store.pendingWebhookBoundary();if(boundary===null)return {pending:false,updated:0};sweep={boundary,after:''};db.prepare("INSERT INTO service_metadata VALUES('cf-webhook-sweep',?)").run(JSON.stringify(sweep));}
 const rows=store.bindingPage(sweep.after,limit);let updated=0;
 for(const row of rows){
  const state=await authority.resolve({customerId:row.customer_id,licenseRef:row.license_ref});
  if(state.ref!==row.license_ref)throw Error('Authority identity mismatch');
  store.transaction(()=>{store.sync(state);sweep.after=row.license_ref;db.prepare("UPDATE service_metadata SET value=? WHERE name='cf-webhook-sweep'").run(JSON.stringify(sweep));});updated++;
 }
 if(rows.length<limit)store.transaction(()=>{store.completeWebhooks(sweep.boundary,now());db.prepare("DELETE FROM service_metadata WHERE name='cf-webhook-sweep'").run();});
 return {pending:store.pendingWebhookBoundary()!==null,updated};
}
