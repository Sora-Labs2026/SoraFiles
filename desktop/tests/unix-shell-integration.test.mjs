import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm,access,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {renderUnixShellAssets,setUnixShellIntegration} from '../scripts/unix-shell-integration.mjs';

test('Unix menu assets preserve executable quoting and literal selected-file forwarding',async()=>{
 const app='/Users/O\'Brien/Sora "Files"/$paid`v`%F\\bin';
 const mac=await renderUnixShellAssets({platform:'darwin',app});
 const workflow=[...mac.values()][1];
 assert.ok(workflow.includes('&quot;$@&quot;'));
 assert.ok(workflow.includes('--edit --'));
 assert.ok(workflow.includes('O&apos;&quot;&apos;&quot;&apos;Brien'));
 assert.ok(!workflow.includes('/Applications/'));
 const linux=await renderUnixShellAssets({platform:'linux',app});
 const python=[...linux.values()][0],desktop=[...linux.values()][1];
 assert.ok(python.includes('APP = '+JSON.stringify(app)));
 assert.ok(desktop.includes('%%F'));
 assert.ok(desktop.endsWith(' --edit -- %F\n'));
 assert.ok(!desktop.includes('sh -c'));
 for(const invalid of ['relative','/foo\nbar','/foo\0bar'])await assert.rejects(renderUnixShellAssets({platform:'linux',app:invalid}));
});

for(const platform of ['darwin','linux'])test(`${platform} per-user install is idempotent and preserves foreign edits`,async()=>{
 const home=await mkdtemp(join(tmpdir(),'sorafiles-shell-test-'));
 const options={home,platform,app:'/opt/SoraFiles/bin/sorafiles'};
 try{
  assert.deepEqual(await setUnixShellIntegration({...options,enabled:false}),{enabled:false,changed:false});
  assert.equal((await setUnixShellIntegration({...options,enabled:true})).enabled,true);
  assert.equal((await setUnixShellIntegration({...options,enabled:true})).changed,false);
  const assets=await renderUnixShellAssets(options),first=join(home,[...assets.keys()][0]);
  const original=await readFile(first);
  await writeFile(first,'foreign edited content');
  await assert.rejects(setUnixShellIntegration({...options,enabled:false}),/modified/);
  await assert.rejects(setUnixShellIntegration({...options,enabled:true}),/modified/);
  assert.equal(await readFile(first,'utf8'),'foreign edited content');
  await writeFile(first,original);
  await assert.rejects(setUnixShellIntegration({...options,app:'/another/install',enabled:true}),/another installation/);
  const sibling=join(dirname(first),'personal-file');await writeFile(sibling,'keep');
  assert.equal((await setUnixShellIntegration({...options,enabled:false})).enabled,false);
  for(const relative of assets.keys())await assert.rejects(access(join(home,relative)));
  assert.equal(await readFile(sibling,'utf8'),'keep');
 }finally{await rm(home,{recursive:true,force:true});}
});

test('installer rejects unowned collisions before creating other menu assets',async()=>{
 const home=await mkdtemp(join(tmpdir(),'sorafiles-shell-test-'));
 try{
  const options={home,platform:'linux',app:'/opt/sorafiles'},assets=await renderUnixShellAssets(options);
  const paths=[...assets.keys()],collision=join(home,paths[1]);
  await mkdir(dirname(collision),{recursive:true});await writeFile(collision,'user-owned');
  await assert.rejects(setUnixShellIntegration({...options,enabled:true}),/modified/);
  await assert.rejects(access(join(home,paths[0])));
  assert.equal(await readFile(collision,'utf8'),'user-owned');
 }finally{await rm(home,{recursive:true,force:true});}
});

test('installer refuses a redirected integration directory',async()=>{
 const home=await mkdtemp(join(tmpdir(),'sorafiles-shell-test-'));
 try{
  const outside=join(home,'outside');await mkdir(outside);
  await symlink(outside,join(home,'.local'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(setUnixShellIntegration({home,platform:'linux',app:'/opt/sorafiles',enabled:true}),/symbolic links/);
 }finally{await rm(home,{recursive:true,force:true});}
});
