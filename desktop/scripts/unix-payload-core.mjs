import {lstat,readdir,readFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,relative,resolve,sep} from 'node:path';

// Shared with synthetic tests; the CLI supplies only fresh extracted packages.
export async function inventoryResources(root){
 root=resolve(root);const entries=[];let directories=0,totalBytes=0;
 async function visit(path,depth){
  if(depth>32)throw Error('Resource directory depth exceeds limit');
  const info=await lstat(path);
  if(info.isSymbolicLink())throw Error('Resource links are not allowed');
  if(info.isDirectory()){
   if(++directories>10000)throw Error('Resource directory count exceeds limit');
   for(const name of await readdir(path))await visit(join(path,name),depth+1);
  }else if(info.isFile()){
   if(entries.length>=20000||info.size>512*1024*1024||(totalBytes+=info.size)>2*1024*1024*1024)throw Error('Resource inventory exceeds limit');
   const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);
   entries.push({path:relative(root,path).split(sep).join('/'),bytes:info.size,sha256:hash.digest('hex'),executable:!!(info.mode&0o111)});
  }else throw Error('Unexpected resource file type');
 }
 if(!(await lstat(root)).isDirectory())throw Error('Resource root must be an ordinary directory');
 await visit(root,0);entries.sort((a,b)=>a.path.localeCompare(b.path));
 return {entries,files:entries.length,bytes:totalBytes};
}

export function compareResources(expected,actual){
 if(expected.files!==actual.files)throw Error('Packaged resource count differs from generated pack');
 const files=new Map(actual.entries.map(entry=>[entry.path,entry]));
 for(const entry of expected.entries){
  const packaged=files.get(entry.path);
  if(!packaged||packaged.bytes!==entry.bytes||packaged.sha256!==entry.sha256)throw Error('Packaged resource differs: '+entry.path);
 }
 if(!files.get('node')?.executable)throw Error('Packaged Node runtime is not executable');
}

export async function findResourceTree(root){
 root=resolve(root);const matches=[];let inspected=0;
 async function visit(path,depth){
  if(depth>20||++inspected>30000)throw Error('Package scan exceeds limit');
  const info=await lstat(path);
  if(info.isSymbolicLink())return; // AppImage system-library links are expected.
  if(!info.isDirectory())return;
  for(const entry of await readdir(path,{withFileTypes:true})){
   const child=join(path,entry.name);
   if(entry.name==='license-host'){
    if(!entry.isDirectory()||entry.isSymbolicLink())throw Error('Packaged license-host must be an ordinary directory');
    matches.push(child);
   }else if(entry.isDirectory())await visit(child,depth+1);
  }
 }
 await visit(root,0);
 if(matches.length!==1)throw Error('Expected exactly one packaged license-host directory');
 return matches[0];
}

export async function readRuntimeManifest(root,{platform,arch}){
 const path=join(root,'runtime.json');if((await lstat(path)).size>65536)throw Error('Runtime manifest exceeds limit');
 const runtime=JSON.parse(await readFile(path,'utf8'));
 if(runtime.platform!==platform||runtime.arch!==arch||!/^v\d+\.\d+\.\d+$/.test(runtime.node))throw Error('Packaged runtime manifest does not match target');
 return runtime;
}
