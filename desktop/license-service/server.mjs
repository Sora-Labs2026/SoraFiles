import {readFile,mkdir} from 'node:fs/promises';import {isAbsolute,dirname,resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {createPrivateKey} from 'node:crypto';
import {createLicenseRuntime} from './runtime.mjs';
import {decodeWebhookSecret} from './signing.mjs';

export function deploymentSettings(config,env){
 if(!config||Object.getPrototypeOf(config)!==Object.prototype||Object.keys(config).some(key=>!['mode','listenHost','listenPort','databasePath','publicOrigin','catalogConfig'].includes(key)))throw Error('Invalid service configuration');
 if(!['test_mode','live_mode'].includes(config.mode)||config.publicOrigin!=='https://license.sorafiles.com'||!['127.0.0.1','0.0.0.0'].includes(config.listenHost)
  ||!Number.isInteger(config.listenPort)||config.listenPort<1024||config.listenPort>65535||typeof config.databasePath!=='string'||!isAbsolute(config.databasePath)||config.databasePath.includes('\0'))throw Error('Invalid service configuration');
 const apiKey=env.DODO_API_KEY,webhookSecret=env.DODO_WEBHOOK_SECRET,kid=env.ENTITLEMENT_KEY_ID,privateKey=env.ENTITLEMENT_ED25519_PRIVATE_KEY;
 if(typeof apiKey!=='string'||!apiKey.trim()||apiKey.length>4096||typeof webhookSecret!=='string'||!webhookSecret.startsWith('whsec_')
  ||typeof kid!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(kid)||typeof privateKey!=='string'||privateKey.length>4096)throw Error('Service secrets are missing or invalid');
 decodeWebhookSecret(webhookSecret);
 try{if(createPrivateKey(privateKey).asymmetricKeyType!=='ed25519')throw Error();}catch{throw Error('Service signing key is invalid');}
 const secrets=['CHALLENGE_HMAC_SECRET','RATE_HMAC_SECRET'].map(name=>{const value=env[name];if(typeof value!=='string'||!/^[a-f0-9]{64}$/i.test(value))throw Error('Service HMAC secrets must each contain 32 random bytes encoded as hex');return Buffer.from(value,'hex');});
 if(secrets[0].equals(secrets[1]))throw Error('Challenge and rate-limit secrets must be different');
 if(!Array.isArray(config.catalogConfig)||config.catalogConfig.length!==6)throw Error('Six catalog mappings required');
 return {host:config.listenHost,port:config.listenPort,runtime:{databasePath:config.databasePath,apiKey,mode:config.mode,catalogConfig:config.catalogConfig,signing:{privateKey,kid},challengeSecret:secrets[0],rateSecret:secrets[1],webhookSecret}};
}

export async function startLicenseServer({config,env=process.env,createRuntime=createLicenseRuntime,onFailure=()=>{}}){
 const settings=deploymentSettings(config,env);await mkdir(dirname(settings.runtime.databasePath),{recursive:true,mode:0o700});
 const runtime=await createRuntime({...settings.runtime,onFailure});
 try{
  await new Promise((ready,fail)=>{const listener=runtime.server;listener.once('error',fail);listener.listen(settings.port,settings.host,()=>{listener.off('error',fail);ready();});});
  runtime.startReconciliation();let closing;
  return {address:runtime.server.address(),close:()=>closing??=(async()=>runtime.close())()};
 }catch(error){await runtime.close();throw error;}
}

async function main(){
 const path=process.env.SORA_LICENSE_CONFIG_FILE;
 if(!path||!isAbsolute(path))throw Error('SORA_LICENSE_CONFIG_FILE must name a private absolute configuration path');
 const bytes=await readFile(path);if(bytes.length>32768)throw Error('Service configuration is too large');
 const service=await startLicenseServer({config:JSON.parse(bytes),onFailure:({status,operation})=>console.error(JSON.stringify({event:'service_failure',status,operation:operation==='reconcile'?'reconcile':'request'}))});
 console.log(JSON.stringify({event:'ready',port:service.address.port}));
 for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{void service.close().then(()=>process.exit(0),()=>process.exit(1));});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('License service failed to start. Check its private configuration, catalog access and persistent storage.');process.exitCode=1;});
