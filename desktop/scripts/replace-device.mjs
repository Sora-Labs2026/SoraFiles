// Authenticated server-operator CLI. No public replacement endpoint. Secrets
// come from the service account's secret manager, never command-line arguments.
import {readFile,stat} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {LicenseStore} from '../license-service/store.mjs';
import {RequestGuard} from '../license-service/request-guard.mjs';
import {DodoClient} from '../license-service/dodo.mjs';
import {DodoAuthority} from '../license-service/authority.mjs';
import {fetchVerifiedCatalog} from '../license-service/catalog.mjs';
import {replaceDevice} from '../license-service/replacements.mjs';
import {PromotionStore,PromotionService} from '../license-service/promotions.mjs';
let store;
try {
  const [requestPath] = process.argv.slice(2);
  const configPath = process.env.SORA_LICENSE_CONFIG_FILE;
  if (process.argv.length!==3 || !requestPath || !configPath || !isAbsolute(configPath)
    || (await stat(requestPath)).size>8192 || (await stat(configPath)).size>32768) throw Error();
  const config=JSON.parse(await readFile(configPath,'utf8'));
  const request=JSON.parse(await readFile(requestPath,'utf8'));
  const allowed=['ticket','operator','licenseRef','oldDeviceId','newDeviceId','reason','overrideTicket'];
  if (!request || Object.getPrototypeOf(request)!==Object.prototype || Object.keys(request).some(k=>!allowed.includes(k))) throw Error();
  const secret=process.env.CHALLENGE_HMAC_SECRET;
  if (!/^[a-f0-9]{64}$/i.test(secret||'') || !isAbsolute(config.databasePath)
    || !['test_mode','live_mode'].includes(config.mode) || !process.env.DODO_API_KEY) throw Error();
  const dodo=new DodoClient({apiKey:process.env.DODO_API_KEY,mode:config.mode});
  const catalog=await fetchVerifiedCatalog(dodo,config.catalogConfig);
  store=new LicenseStore(config.databasePath);
  const guard=new RequestGuard({store,secret:Buffer.from(secret,'hex')});
  store.pinActivationKey(guard.activationFingerprint(''));
  const promoKey=process.env.SORA_PROMOTIONS_ENCRYPTION_KEY;
  if(promoKey&&!/^[a-f0-9]{64}$/i.test(promoKey))throw Error();
  const promotions=promoKey?new PromotionService({store:new PromotionStore(store,{encryptionKey:Buffer.from(promoKey,'hex')}),dodo,
    verifyIdentity:async()=>{throw Error('No redemption through support CLI');}}):null;
  const result=await replaceDevice({store,guard,dodo,authority:new DodoAuthority({dodo,catalog,promotions}),request,
    licenseKey:process.env.SORA_REPLACEMENT_LICENSE_KEY});
  console.log(JSON.stringify(result));
} catch {
  console.error('Replacement did not complete. Check the private support record, provider status and replacement history before retrying the same ticket.');
  process.exitCode=1;
} finally {store?.close();}
