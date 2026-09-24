// Extract candidate packages without installing them. Every packaged resource
// must match the generated pack; end-user installation remains a separate check.
import {mkdir,mkdtemp,readdir,writeFile,lstat} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {spawn} from 'node:child_process';
import {inventoryResources,compareResources,findResourceTree,readRuntimeManifest} from './unix-payload-core.mjs';

const targets={
 'aarch64-apple-darwin':{platform:'darwin',arch:'arm64'},
 'x86_64-apple-darwin':{platform:'darwin',arch:'x64'},
 'x86_64-unknown-linux-gnu':{platform:'linux',arch:'x64'}
};
const target=process.argv[2],expectedTarget=targets[target];
if(!expectedTarget||process.argv.length!==3)throw Error('Supply exactly one supported Unix native target');
if(process.platform!==expectedTarget.platform||process.arch!==expectedTarget.arch)throw Error('Verify packages on their matching native runner');
const root=resolve('.'),bundle=join(root,'desktop/native/target',target,'release/bundle');
const generated=await inventoryResources(join(root,'.artifacts/desktop-license-host'));
await mkdir(join(root,'.artifacts'),{recursive:true});
const run=async(program,args,cwd)=>new Promise((done,fail)=>{
 const child=spawn(program,args,{cwd,stdio:['ignore','pipe','pipe'],env:{PATH:'/usr/bin:/bin',...process.env.TMPDIR?{TMPDIR:process.env.TMPDIR}:{} }});
 let stdout='',stderr='',timedOut=false;const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},300000);
 child.stdout.on('data',bytes=>stdout=(stdout+bytes).slice(-32768));child.stderr.on('data',bytes=>stderr=(stderr+bytes).slice(-32768));
 child.once('error',error=>{clearTimeout(timer);fail(error);});
 child.once('close',(code,signal)=>{clearTimeout(timer);if(code!==0||timedOut)fail(Error('Package verification command failed ('+program+' '+args[0]+'): '+(timedOut?'timeout':signal||code)+' '+stderr));else done(stdout.trim());});
});
async function single(folder,suffix){
 const entries=(await readdir(folder,{withFileTypes:true})).filter(entry=>entry.name.endsWith(suffix));
 if(entries.length!==1||!entries[0].isFile()||entries[0].isSymbolicLink())throw Error('Expected exactly one ordinary '+suffix+' package');
 return join(folder,entries[0].name);
}
const packages=[];
if(process.platform==='darwin'){
 // inspect-macos-bundle.mjs first copies the app from the actual read-only DMG.
 const folder=join(bundle,'macos'),apps=(await readdir(folder,{withFileTypes:true})).filter(entry=>entry.name.endsWith('.app'));
 if(apps.length!==1||!apps[0].isDirectory()||apps[0].isSymbolicLink())throw Error('Expected one previously inspected DMG app copy');
 const app=join(folder,apps[0].name),resources=join(app,'Contents/Resources');
 for(const path of [app,join(app,'Contents'),resources])if(!(await lstat(path)).isDirectory()||(await lstat(path)).isSymbolicLink())throw Error('Unexpected linked app resource ancestor');
 const pack=await findResourceTree(resources);
 if(pack!==join(resources,'license-host'))throw Error('Unexpected macOS resource location');
 packages.push({format:'dmg',package:await single(join(bundle,'dmg'),'.dmg'),pack});
}else{
 for(const [format,folder,suffix] of [['deb','deb','.deb'],['appimage','appimage','.AppImage']]){
  const file=await single(join(bundle,folder),suffix);
  const directory=await mkdtemp(join(root,'.artifacts/unix-payload-'+format+'-'));
  if(format==='deb')await run('/usr/bin/dpkg-deb',['--extract',file,directory],directory);
  else await run(file,['--appimage-extract'],directory);
  const extracted=format==='deb'?directory:join(directory,'squashfs-root');
  packages.push({format,package:file,pack:await findResourceTree(extracted),extraction:directory});
 }
}
const verified=[];
for(const item of packages){
 const actual=await inventoryResources(item.pack);compareResources(generated,actual);
 const runtime=await readRuntimeManifest(item.pack,expectedTarget),node=join(item.pack,'node');
 if(await run(node,['--version'],item.pack)!==runtime.node)throw Error('Packaged Node version differs from manifest');
 const identity=JSON.parse(await run(node,['-p','JSON.stringify({platform:process.platform,arch:process.arch})'],item.pack));
 if(identity.platform!==runtime.platform||identity.arch!==runtime.arch)throw Error('Packaged Node architecture differs from manifest');
 const engines=await run(node,['--input-type=commonjs','-e',`(async()=>{const sharp=require('sharp'),{createCanvas}=require('@napi-rs/canvas');const canvas=createCanvas(2,3);const input=canvas.toBuffer('image/png');const result=await sharp(input).resize(4,6).png().toBuffer();const info=await sharp(result).metadata();if(info.width!==4||info.height!==6)throw Error('Packaged codec failure');console.log('PASS')})().catch(()=>process.exit(1))`],item.pack);
 if(engines!=='PASS')throw Error('Packaged native image engines did not run');
 verified.push({format:item.format,package:relative(root,item.package).replaceAll('\\','/'),resources:relative(root,item.pack).replaceAll('\\','/'),resourceFiles:actual.files,resourceBytes:actual.bytes,runtime:{node:runtime.node,...identity},nativeImageEngines:'PASS',entries:actual.entries});
}
const report={schema:1,recordedAt:new Date().toISOString(),status:'PASS',target,scope:'Resources extracted from actual candidate packages equal generated pack byte-for-byte; packaged Node and native image codecs run successfully. No installation, end-user launch, OS credential store or signing/notarization certification.',packages:verified};
await writeFile(join(root,'.artifacts/unix-payload-verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,packages:verified.map(({entries,...row})=>row)}));
// Keep only newly created extraction folders as inspectable evidence; no broad
// cleanup or user/install directory mutation is performed by this verifier.
