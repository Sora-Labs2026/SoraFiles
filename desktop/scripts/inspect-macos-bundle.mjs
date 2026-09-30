import {readdir,mkdir,writeFile,mkdtemp,rmdir} from 'node:fs/promises';import {resolve,join,dirname} from 'node:path';import {spawnSync} from 'node:child_process';
if(process.platform!=='darwin')throw Error('Run this inspection on the macOS build runner');
const run=(command,args)=>spawnSync(command,args,{encoding:'utf8',timeout:120000});
if(!process.argv[2])throw Error('Native bundle folder required');
const folder=resolve(process.argv[2]),dmgFolder=join(dirname(folder),'dmg');
const images=(await readdir(dmgFolder)).filter(name=>name.endsWith('.dmg'));if(images.length!==1)throw Error('Expected one disk image');
await mkdir('.artifacts',{recursive:true});await mkdir(folder,{recursive:true});
// Tauri removes its intermediate .app when only DMG was requested. Inspect a
// copy from the actual readonly disk image, rather than an intermediate build.
const mount=await mkdtemp(resolve('.artifacts/macos-mount-'));let mounted=false,app;
try {
 const attached=run('/usr/bin/hdiutil',['attach','-readonly','-nobrowse','-noautoopen','-mountpoint',mount,join(dmgFolder,images[0])]);
 if(attached.status!==0)throw Error('Could not mount candidate disk image');mounted=true;
 const apps=(await readdir(mount,{withFileTypes:true})).filter(entry=>entry.isDirectory()&&entry.name.endsWith('.app'));
 if(apps.length!==1)throw Error('Expected one app in the candidate disk image');
 app=join(folder,apps[0].name);
 if((await readdir(folder)).some(name=>name.endsWith('.app')))throw Error('Unexpected pre-existing app copy');
 const copied=run('/usr/bin/ditto',[join(mount,apps[0].name),app]);if(copied.status!==0)throw Error('Could not copy the packaged app');
} finally {
 if(mounted&&run('/usr/bin/hdiutil',['detach',mount]).status!==0)throw Error('Could not detach candidate disk image');
 await rmdir(mount);
}
const verified=run('/usr/bin/codesign',['--verify','--deep','--strict','--verbose=2',app]);if(verified.status!==0)throw Error('macOS bundle integrity check failed');
const identity=run('/usr/bin/codesign',['--display','--verbose=4',app]);if(identity.status!==0||!identity.stderr.includes('Signature=adhoc'))throw Error('Expected explicit ad-hoc signature');
// Gatekeeper assessment is read-only. A valid ad-hoc bundle is expected to need
// user approval; rejection is recorded, never silently converted to notarized.
const assessment=run('/usr/sbin/spctl',['--assess','--type','execute','--verbose=4',app]);
await writeFile('.artifacts/macos-bundle-inspection.json',JSON.stringify({platform:'macos',arch:process.arch,source:'App copied from built DMG mounted readonly',integrityVerified:true,signing:'ad-hoc',notarized:false,gatekeeperAssessmentExit:assessment.status,manualApprovalRequired:true,notTested:['quarantined browser download and first launch','Finder integration','engine and licensing workflows']},null,2));
console.log('Ad-hoc signature integrity verified; Gatekeeper first-launch approval still needs a real download test.');
