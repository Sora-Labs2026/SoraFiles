// Test-only entrypoint; never referenced by deployment configuration.
import {DurableLicenseStore} from '../../license-service/cloudflare/store.mjs';
import {DurableRateLimiter} from '../../license-service/cloudflare/rate-limit.mjs';
import {reconcileBatch} from '../../license-service/cloudflare/reconcile.mjs';
import {prepareReplacement,completeReplacement} from '../../license-service/replacements.mjs';
import {PromotionStore} from '../../license-service/promotions.mjs';
import {LicenseLedgerObject} from '../../license-service/cloudflare/worker.mjs';
const id=n=>Buffer.alloc(32,n).toString('base64url');
export class Probe {
 constructor(ctx){this.ctx=ctx;this.store=new DurableLicenseStore(ctx.storage);}
 async fetch(request){
  const s=this.store,db=s.db,now=1800000000;
  try {
   switch(new URL(request.url).pathname){
    case '/rollback': {
     try{s.transaction(()=>{s.sync({ref:'rollback',plan:'personal-lifetime',status:'active',observedAt:now});throw Error('rollback');});}catch{}
     let foreignKey=false;try{db.prepare('INSERT INTO devices VALUES(?,?,?,1)').run('absent','device','instance');}catch{foreignKey=true;}
     return Response.json({rolledBack:!db.prepare("SELECT 1 FROM licenses WHERE ref='rollback'").get(),foreignKey});
    }
    case '/replacement': {
     s.sync({ref:'license',plan:'personal-lifetime',status:'active',observedAt:now});s.activate('license',id(1),'old',now);
     prepareReplacement(s,{ticket:'CASE-1',operator:'support',licenseRef:'license',oldDeviceId:id(1),newDeviceId:id(2),reason:'lost',keyHash:'a'.repeat(64)},now);
     completeReplacement(s,'CASE-1',now);
     let reserved=false;try{s.activate('license',id(3),'extra',now);}catch{reserved=true;}
     s.activate('license',id(2),'new',now);
     let revoked=false;try{s.issueForDevice('license',id(1),'old',now,()=>true);}catch{revoked=true;}
     return Response.json({reserved,revoked,history:db.prepare('SELECT COUNT(*) AS n FROM support_replacements').get().n});
    }
    case '/caps': {
     const limits=[];
     for(const plan of ['personal-monthly','personal-annual','personal-lifetime','team-monthly','team-annual','team-lifetime']){
      const cap=plan.startsWith('team')?5:1;s.sync({ref:plan,plan,status:'active',periodEnd:now+86400,observedAt:now});
      for(let n=0;n<cap;n++)s.activate(plan,id(n),'i'+n,now);
      let refused=false;try{s.activate(plan,id(10),'extra',now);}catch{refused=true;}
      limits.push(refused);
     }
     return Response.json({limits});
    }
    case '/promotion': {
     const p=new PromotionStore(s,{encryptionKey:Buffer.alloc(32,7)});
     const codes=p.create({id:'test',name:'Synthetic',tier:'Personal',duration:'lifetime',productId:'test',quantity:2,starts:now-1,ends:now+100,enabled:true},now);
     return Response.json({codes:codes.length,roundTrip:p.unseal(p.seal('synthetic-key','id'),'id')==='synthetic-key'});
    }
    case '/rate': {
     const rate=new DurableRateLimiter(s,{limit:1,now:()=>now});let allowed=true;try{rate.take('synthetic');}catch{allowed=false;}return Response.json({allowed});
    }
    case '/reconcile': {
     for(let n=0;n<3;n++){s.sync({ref:'r'+n,plan:'personal-lifetime',status:'active',observedAt:now-1});s.bind('r'+n,'customer');}
     s.queueWebhook('event',now);let calls=0;
     const authority={resolve:async({licenseRef})=>{calls++;if(calls===2)throw Error('outage');return {ref:licenseRef,plan:'personal-lifetime',status:'revoked',observedAt:now};}};
     try{await reconcileBatch(s,authority,{limit:2,now:()=>now});}catch{}
     const saved=JSON.parse(db.prepare("SELECT value FROM service_metadata WHERE name='cf-webhook-sweep'").get().value);
     s.queueWebhook('later',now);
     await reconcileBatch(s,authority,{limit:2,now:()=>now});
     const end=await reconcileBatch(s,authority,{limit:2,now:()=>now});
     const older=db.prepare("SELECT completed FROM webhook_inbox WHERE id='event'").get();
     return Response.json({cursor:saved.after,olderComplete:older.completed===now,laterPending:end.pending});
    }
   }
   return new Response(null,{status:404});
  }catch(error){return Response.json({error:error.message},{status:500});}
 }
}
// Executes the production alarm handler; synthetic authority fails once, then
// recovers on a real scheduled alarm. The shortened retry exists only in tests.
export class AlarmProbe extends LicenseLedgerObject {
 async runtime(){return {authority:{resolve:async({licenseRef})=>{
  if(!this.store.db.prepare("SELECT 1 FROM service_metadata WHERE name='test-alarm-failed'").get()){
   this.store.db.prepare("INSERT INTO service_metadata VALUES('test-alarm-failed','1')").run();throw Error('Synthetic provider outage');
  }
  return {ref:licenseRef,plan:'personal-lifetime',status:'revoked',observedAt:1800000000};
 }}};}
 async alarm(){
  await super.alarm();
  if(this.store.pendingWebhookBoundary()!==null)await this.ctx.storage.setAlarm(Date.now()+50);
 }
 async fetch(request){
  if(request.method==='POST'){
   this.store.sync({ref:'alarm-license',plan:'personal-lifetime',status:'active',observedAt:1799999999});this.store.bind('alarm-license','customer');
   await this.ctx.storage.transaction(async()=>{this.store.queueWebhook('alarm-event',1800000000);await this.ctx.storage.setAlarm(Date.now()+50);});
  }
  return Response.json({pending:this.store.pendingWebhookBoundary()!==null,status:this.store.db.prepare("SELECT status FROM licenses WHERE ref='alarm-license'").get()?.status,failedOnce:!!this.store.db.prepare("SELECT 1 FROM service_metadata WHERE name='test-alarm-failed'").get(),alarm:await this.ctx.storage.getAlarm()});
 }
}
export default {fetch(request,env){const path=new URL(request.url).pathname,binding=path==='/alarm'?env.ALARM:env.PROBE;const stub=binding.get(binding.idFromName(path));return stub.fetch(request);}};
