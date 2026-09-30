// Local/server-owner CLI only. There is deliberately no HTTP admin endpoint.
import {readFile,open,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {LicenseStore} from '../license-service/store.mjs';
import {PromotionStore} from '../license-service/promotions.mjs';
const [action,...args]=process.argv.slice(2);
let store,exportHandle;
try {
 if(!['create','list','enable','disable','revoke'].includes(action))throw Error('Usage');
 const database=process.env.SORA_PROMOTIONS_DB,key=process.env.SORA_PROMOTIONS_ENCRYPTION_KEY;
 if(!database||!key||!/^[a-fA-F0-9]{64}$/.test(key))throw Error('Configuration');
 store=new LicenseStore(resolve(database));const promotions=new PromotionStore(store,{encryptionKey:Buffer.from(key,'hex')}),now=Math.floor(Date.now()/1000);
 if(action==='create'){
  if(args.length!==2)throw Error('Usage');
  const config=JSON.parse(await readFile(resolve(args[0]),'utf8'));
  if(config.enabled===true)throw Error('Create disabled, export, then enable');
  // Reserve the export file before committing codes. Never overwrite old exports.
  const path=resolve(args[1]);await mkdir(dirname(path),{recursive:true});exportHandle=await open(path,'wx',0o600);
  const codes=promotions.create(config,now);
  // Codes are shown once in this private export; database stores only their hashes.
  await exportHandle.writeFile('code\r\n'+codes.join('\r\n')+'\r\n');await exportHandle.sync();await exportHandle.close();exportHandle=null;
  process.stdout.write(JSON.stringify({campaignId:config.id,codesExported:codes.length,enabled:config.enabled===true})+'\n');
 }else if(action==='list'){
  if(args.length)throw Error('Usage');process.stdout.write(JSON.stringify(promotions.list(),null,2)+'\n');
 }else{
  if(args.length!==1)throw Error('Usage');
  if(action==='revoke')promotions.revoke(args[0],now);else promotions.setEnabled(args[0],action==='enable',now);
  process.stdout.write(JSON.stringify({action,completed:true})+'\n');
 }
}catch{
 // Do not echo exception text, config, codes, tokens, keys or database paths.
 process.stderr.write('Promotion command failed. Check command arguments, configuration and private export permissions.\n');process.exitCode=1;
}finally{if(exportHandle)await exportHandle.close();store?.close();}
