import {readFile,writeFile,mkdir,lstat,unlink,rmdir,rename,link} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {dirname,join,resolve,posix,relative,isAbsolute} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';

const owner='com.soralabs.sorafiles.desktop.shell.v1';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const xml=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const sh=text=>"'"+text.replaceAll("'","'\"'\"'")+"'";
const workflowRoot='Library/Services/Edit with SoraFiles.workflow';
const locations={darwin:[`${workflowRoot}/Contents/Info.plist`,`${workflowRoot}/Contents/document.wflow`],linux:['.local/share/nautilus-python/extensions/sorafiles.py','.local/share/kio/servicemenus/sorafiles.desktop','.local/share/kservices5/ServiceMenus/sorafiles.desktop']};
const stateLocation=platform=>platform==='darwin'?'Library/Application Support/SoraFiles/shell-integration.json':'.local/state/sorafiles/shell-integration.json';

function validate(platform,app){
 if(!locations[platform])throw Error('File-manager integration requires macOS or Linux');
 if(typeof app!=='string'||!posix.isAbsolute(app)||/[\x00-\x1f\x7f]/.test(app))throw Error('An absolute Unix executable path without control characters is required');
}

export async function renderUnixShellAssets({platform,app}){
 validate(platform,app);
 if(platform==='linux'){
  const template=await readFile(new URL('../shell/linux/sorafiles.py.in',import.meta.url),'utf8');
  // Desktop Entry Exec quoting is separate from shell quoting. Literal percent
  // must be doubled so a path containing %F cannot become a field code.
  const executable='"'+app.replaceAll('\\','\\\\\\\\').replaceAll('"','\\\\\\"').replaceAll('`','\\\\`').replaceAll('$','\\\\$').replaceAll('%','%%')+'"';
  const menu=`[Desktop Entry]\nType=Service\nX-KDE-ServiceTypes=KonqPopupMenu/Plugin\nMimeType=application/octet-stream;\nX-KDE-Protocols=file\nActions=SoraFilesEdit;\n\n[Desktop Action SoraFilesEdit]\nName=Edit with SoraFiles\nIcon=document-edit\nExec=${executable} --edit -- %F\n`;
  return new Map([[locations.linux[0],template.replace('__SORAFILES_APP_JSON__',JSON.stringify(app))],[locations.linux[1],menu],[locations.linux[2],menu]]);
 }
 const command=`exec ${sh(app)} --edit -- "$@"`;
 const info=`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${owner}</string><key>CFBundleName</key><string>Edit with SoraFiles</string><key>NSServices</key><array><dict><key>NSMenuItem</key><dict><key>default</key><string>Edit with SoraFiles</string></dict><key>NSMessage</key><string>runWorkflowAsService</string><key>NSRequiredContext</key><dict/><key>NSSendFileTypes</key><array><string>public.item</string></array></dict></array></dict></plist>\n`;
 const workflow=`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>AMApplicationBuild</key><string>523</string><key>AMApplicationVersion</key><string>2.10</string><key>AMDocumentVersion</key><string>2</string><key>actions</key><array><dict><key>action</key><dict><key>AMActionVersion</key><string>2.0.3</string><key>AMParameterProperties</key><dict><key>COMMAND_STRING</key><dict/><key>inputMethod</key><dict/><key>shell</key><dict/></dict><key>AMProvides</key><dict><key>Container</key><string>List</string><key>Types</key><array><string>com.apple.cocoa.string</string></array></dict><key>AMAccepts</key><dict><key>Container</key><string>List</string><key>Types</key><array><string>com.apple.cocoa.path</string></array></dict><key>ActionBundlePath</key><string>/System/Library/Automator/Run Shell Script.action</string><key>ActionName</key><string>Run Shell Script</string><key>ActionParameters</key><dict><key>COMMAND_STRING</key><string>${xml(command)}</string><key>inputMethod</key><integer>1</integer><key>shell</key><string>/bin/sh</string></dict><key>BundleIdentifier</key><string>com.apple.RunShellScript</string><key>UUID</key><string>7E99A6E2-705D-4A97-AF40-5378CB66B274</string></dict><key>isViewVisible</key><false/></dict></array><key>connectors</key><dict/><key>workflowMetaData</key><dict><key>serviceInputTypeIdentifier</key><string>com.apple.Automator.fileSystemObject</string><key>serviceOutputTypeIdentifier</key><string>com.apple.Automator.nothing</string><key>serviceProcessesInput</key><integer>0</integer><key>workflowTypeIdentifier</key><string>com.apple.Automator.servicesMenu</string></dict></dict></plist>\n`;
 return new Map([[locations.darwin[0],info],[locations.darwin[1],workflow]]);
}

async function optionalStat(path){try{return await lstat(path);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function safePath(home,path){
 const base=resolve(home),target=resolve(home,path),rel=relative(base,target);
 if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('Integration path escapes the home directory');
 for(let current=target;;current=dirname(current)){
  const info=await optionalStat(current);
  if(info?.isSymbolicLink())throw Error('Integration paths must not contain symbolic links');
  if(current!==target&&info&&!info.isDirectory())throw Error('Integration parent is not a directory');
  if(current===base)break;
 }
 return target;
}
async function readSmall(path){const info=await optionalStat(path);if(!info)return null;if(!info.isFile()||info.size>131072)throw Error('Unexpected integration file');return readFile(path);}
async function atomicWrite(path,bytes,{exists,mode=0o644}){
 const temporary=path+'.sorafiles-'+randomUUID();
 try{
  await writeFile(temporary,bytes,{flag:'wx',mode});
  if(exists)await rename(temporary,path);
  else await link(temporary,path); // Do not replace a file created after preflight.
 }finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
}

// The native caller owns preference default/migration. This helper performs only
// the requested transition and never installs anything at module import time.
export async function setUnixShellIntegration({platform=process.platform,app,enabled,home=homedir()}){
 validate(platform,app);if(typeof enabled!=='boolean')throw Error('enabled must be boolean');
 const assets=await renderUnixShellAssets({platform,app});
 const statePath=await safePath(home,stateLocation(platform));
 const stateBytes=await readSmall(statePath);
 let previous=null;
 if(stateBytes){
  previous=JSON.parse(stateBytes);
  if(previous.owner!==owner||previous.app!==app||previous.platform!==platform||!previous.files||Object.keys(previous.files).length!==assets.size||[...assets.keys()].some(path=>!/^([a-f0-9]{64})$/.test(previous.files[path]??'')))throw Error('Integration belongs to another installation or has an invalid ownership record');
 }
 const oldFiles=new Map();
 for(const [path] of assets){
  const absolute=await safePath(home,path),bytes=await readSmall(absolute);oldFiles.set(absolute,bytes);
  if(bytes&&(!previous||hash(bytes)!==previous.files[path]))throw Error('An existing file-manager integration was modified; it has been preserved');
 }
 if(!enabled&&!previous)return {enabled:false,changed:false};
 const installed={owner,app,platform,files:Object.fromEntries([...assets].map(([path,content])=>[path,hash(content)]))};
 const changes=[];
 try{
  for(const [path,content] of assets){
   const absolute=await safePath(home,path),old=oldFiles.get(absolute);
   if(enabled){
    await mkdir(dirname(absolute),{recursive:true});await safePath(home,path);
    if(old?.equals(Buffer.from(content)))continue;
    await atomicWrite(absolute,content,{exists:!!old});changes.push(absolute);
   }else if(old){await unlink(absolute);changes.push(absolute);}
  }
  if(enabled){await mkdir(dirname(statePath),{recursive:true});await safePath(home,stateLocation(platform));await atomicWrite(statePath,JSON.stringify(installed,null,2)+'\n',{exists:!!stateBytes,mode:0o600});}
  else await unlink(statePath);
 }catch(error){
  // Roll back only files changed by this call. Never recursively delete a tree.
  for(const absolute of changes.reverse()){
   const old=oldFiles.get(absolute);
   if(old)await atomicWrite(absolute,old,{exists:!!(await optionalStat(absolute))});else await unlink(absolute).catch(()=>{});
  }
  throw error;
 }
 if(!enabled&&platform==='darwin')for(const path of [`${workflowRoot}/Contents`,workflowRoot])await rmdir(await safePath(home,path)).catch(error=>{if(!['ENOTEMPTY','ENOENT'].includes(error.code))throw error;});
 return {enabled,changed:changes.length>0,requiresFileManagerRestart:true};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [operation,app,...extra]=process.argv.slice(2);
 if(extra.length||!['enable','disable'].includes(operation)){console.error('Usage: unix-shell-integration.mjs enable|disable /absolute/app/executable');process.exitCode=2;}
 else try{console.log(JSON.stringify(await setUnixShellIntegration({app,enabled:operation==='enable'})));}catch(error){console.error(error.message);process.exitCode=1;}
}
