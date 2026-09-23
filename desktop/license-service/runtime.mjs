import {DodoClient} from './dodo.mjs';import {fetchVerifiedCatalog} from './catalog.mjs';import {DodoAuthority} from './authority.mjs';import {LicenseStore} from './store.mjs';import {RequestGuard} from './request-guard.mjs';import {LicenseService} from './service.mjs';import {WebhookInbox} from './webhooks.mjs';import {createLicenseHttpServer} from './http.mjs';
import {PromotionStore,PromotionService} from './promotions.mjs';import {createPromotionHttpServer} from './promotion-http.mjs';

// Host deployment supplies service secrets. Trials use proved device keys, with no sign-in provider. This function
// never reads web-app PUBLIC_ variables and does not start a production service by import.
export async function createLicenseRuntime({databasePath,apiKey,mode='test_mode',catalogConfig,signing,challengeSecret,rateSecret,webhookSecret,promotionConfig=null,onFailure=()=>{}}){
 if(!apiKey||!webhookSecret)throw Error('Dodo configuration required');
 const dodo=new DodoClient({apiKey,mode}),catalog=await fetchVerifiedCatalog(dodo,catalogConfig);
 const store=new LicenseStore(databasePath);
 try{const promotions=promotionConfig?new PromotionService({store:new PromotionStore(store,{encryptionKey:promotionConfig.encryptionKey}),dodo,verifyIdentity:promotionConfig.verifyIdentity}):null;
  const promotionServer=promotions?createPromotionHttpServer({promotions,rateSecret,issueIdentitySession:promotionConfig.issueIdentitySession??null}):null;
  const authority=new DodoAuthority({dodo,catalog,promotions}),guard=new RequestGuard({store,secret:challengeSecret}),service=new LicenseService({store,guard,dodo,authority,signing});
  const webhooks=new WebhookInbox({store,authority,secret:webhookSecret}),server=createLicenseHttpServer({service,webhooks,rateSecret,onFailure});
  let timer=null,closing=false,active=null;const controller=new AbortController();
  const sweep=()=>{if(closing||active)return;active=webhooks.reconcile({signal:controller.signal}).catch(()=>{try{onFailure({status:503,operation:'reconcile'});}catch{}}).finally(()=>{active=null;});};
  return {server,promotionServer,catalog,startReconciliation(){if(timer)return;sweep();timer=setInterval(sweep,30000);timer.unref();},async close(){closing=true;if(timer)clearInterval(timer);controller.abort();for(const listener of [server,promotionServer].filter(Boolean)){listener.closeIdleConnections();await new Promise(resolve=>{if(!listener.listening)return resolve();const timeout=setTimeout(()=>listener.closeAllConnections(),25000);listener.close(()=>{clearTimeout(timeout);resolve();});});}if(active)await active;store.close();}};
 }catch(error){store.close();throw error;}
}
