import {readdir,mkdir,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {spawnSync} from 'node:child_process';
if(process.platform!=='darwin')throw Error('Run this inspection on the macOS build runner');
const folder=resolve(process.argv[2]||'');const apps=(await readdir(folder)).filter(name=>name.endsWith('.app'));if(apps.length!==1)throw Error('Expected one app bundle');const app=join(folder,apps[0]);
const run=(command,args)=>spawnSync(command,args,{encoding:'utf8',timeout:120000});
const verified=run('/usr/bin/codesign',['--verify','--deep','--strict','--verbose=2',app]);if(verified.status!==0)throw Error('macOS bundle integrity check failed');
const identity=run('/usr/bin/codesign',['--display','--verbose=4',app]);if(identity.status!==0||!identity.stderr.includes('Signature=adhoc'))throw Error('Expected explicit ad-hoc signature');
// Gatekeeper assessment is read-only. A valid ad-hoc bundle is expected to need
// user approval; rejection is recorded, never silently converted to notarized.
const assessment=run('/usr/sbin/spctl',['--assess','--type','execute','--verbose=4',app]);
await mkdir('.artifacts',{recursive:true});await writeFile('.artifacts/macos-bundle-inspection.json',JSON.stringify({platform:'macos',arch:process.arch,integrityVerified:true,signing:'ad-hoc',notarized:false,gatekeeperAssessmentExit:assessment.status,manualApprovalRequired:true,notTested:['quarantined browser download and first launch','Finder integration','engine and licensing workflows']},null,2));
console.log('Ad-hoc signature integrity verified; Gatekeeper first-launch approval still needs a real download test.');
