import test from 'node:test';import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';import {mkdtemp} from 'node:fs/promises';import {resolve} from 'node:path';
import {build} from 'esbuild';import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
async function bundle(entry){return (await build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'neutral',external:['node:*','cloudflare:*'],logLevel:'silent'})).outputFiles[0].text;}
test('actual workerd redemption bindings enforce identity, durable limits and recovery after a lost synthetic provider response',async()=>{
 const script=await bundle('desktop/tests/fixtures/cloudflare-redemption.mjs'),siteScript=await bundle('desktop/tests/fixtures/cloudflare-redemption-site.mjs');
 const folder=await mkdtemp(resolve('.artifacts/cloudflare-redemption-'));
 const bindings={RATE_HMAC_SECRET:randomBytes(32).toString('hex'),SORA_PROMOTIONS_ENCRYPTION_KEY:randomBytes(32).toString('hex'),REDEMPTION_ENABLED:'true'};
 const common={modules:true,compatibilityDate:'2026-08-09',compatibilityFlags:['nodejs_compat'],stripCfConnectingIp:false,outboundService:()=>{throw Error('External network forbidden');}};
 const start=(enabled=true,identity=true)=>new Miniflare({...convertV4MiniflareOptions({workers:[
  {...common,name:'license',script,bindings:{...bindings,REDEMPTION_ENABLED:String(enabled)},durableObjects:{LICENSE_LEDGER:{className:'TestLedger',useSQLite:true}},...(identity?{serviceBindings:{REDEMPTION_IDENTITY:{name:'identity',entrypoint:'TestIdentity'}}}:{})},
  {...common,name:'identity',script},
  {...common,name:'site',script:siteScript,serviceBindings:{DESKTOP_REDEMPTION:{name:'license',entrypoint:'RedemptionGateway'}}},
 ]}),resourcePersistencePath:folder});
 let mf=start(),sequence=1;
 const post=async(path,body,headers={})=>(await mf.getWorker('site')).fetch('https://sorafiles.com/api/desktop/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Test-Origin':'https://sorafiles.com','CF-Connecting-IP':'192.0.2.'+(sequence++),...headers},body:JSON.stringify(body)});
 try{
  const code=(await(await mf.dispatchFetch('https://local.invalid/seed')).json()).code;
  const first=await post('redemption-session',{});assert.equal(first.status,401,await first.text());
  const session=await post('redemption-session',{}, {Cookie:'fixture=verified'});assert.equal(session.status,200);const {identityToken}=await session.json();assert.equal(identityToken,'synthetic-subject-token');
  assert.equal((await post('redemption-session',{customerId:'injected'}, {Cookie:'fixture=verified'})).status,400);
  assert.equal((await post('redeem',{code,identityToken:'forged'})).status,400);
  assert.equal((await post('redeem',{code,identityToken,maxDevices:5})).status,400);
  assert.equal((await post('redeem',{code,identityToken})).status,503);
  await mf.dispose();mf=start();
  const recovered=await post('redeem',{code,identityToken});assert.equal(recovered.status,200);const grant=await recovered.json();assert.equal(grant.edition,'Personal');assert.equal(grant.maxDevices,1);assert.equal(grant.expiresAt,null);assert.equal(grant.emailSent,false);assert.match(grant.licenseKey,/^SF-LIC-/);
  const retry=await post('redeem',{code,identityToken});assert.deepEqual(await retry.json(),grant);assert.equal(recovered.headers.get('cache-control'),'no-store');
  for(let i=0;i<12;i++)assert.equal((await post('redemption-session',{}, {'CF-Connecting-IP':'198.51.100.1','X-Forwarded-For':String(i)})).status,401);
  assert.equal((await post('redemption-session',{}, {'CF-Connecting-IP':'198.51.100.1'})).status,429);
  await mf.dispose();mf=start();assert.equal((await post('redemption-session',{}, {'CF-Connecting-IP':'198.51.100.1'})).status,429);
  assert.equal((await post('redeem',{code,identityToken},{'X-Test-Origin':'https://evil.invalid'})).status,403);
  assert.equal((await mf.dispatchFetch('https://local.invalid/api/desktop/redeem',{method:'POST',body:'{}'})).status,404);
  await mf.dispose();mf=start(false);assert.equal((await post('redemption-session',{}, {Cookie:'fixture=verified'})).status,503);
  await mf.dispose();mf=start(true,false);assert.equal((await post('redemption-session',{}, {Cookie:'fixture=verified'})).status,503);
 }finally{await mf.dispose();}
});
