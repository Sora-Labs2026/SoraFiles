import {cp,mkdir,readFile,readdir,copyFile,writeFile} from 'node:fs/promises';
import {join,relative,dirname} from 'node:path';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import {existsSync} from 'node:fs';
const root=new URL('../../',import.meta.url),require=createRequire(import.meta.url);
const out=new URL('.artifacts/desktop-license-host/',root);
for(const directory of ['core','shared','native-host']){
 const source=new URL('desktop/'+directory+'/',root),target=new URL('desktop/'+directory+'/',out);await mkdir(target,{recursive:true});
 for(const name of await readdir(source))if(name.endsWith('.mjs'))await copyFile(new URL(name,source),new URL(name,target));
}
// Copy only the installed processing dependency closure for the current target.
// Missing platform optional packages are expected; required packages fail builds.
const copied=new Set();
async function include(name,from=require,optional=false){
 const packagePath=(from.resolve.paths(name)||[]).map(base=>join(base,name,'package.json')).find(existsSync);
 if(!packagePath){if(optional)return;throw Error('Missing processing dependency: '+name);}
 if(copied.has(packagePath))return;
 const metadata=JSON.parse(await readFile(packagePath,'utf8'));copied.add(packagePath);
 const source=dirname(packagePath),destination=relative(fileURLToPath(new URL('node_modules/',root)),source);
 if(destination.startsWith('..'))throw Error('Processing dependency outside installed tree');
 await cp(source,join(fileURLToPath(out),'node_modules',destination),{recursive:true,errorOnExist:false});
 const resolveFrom=createRequire(packagePath);
 for(const dependency of Object.keys(metadata.dependencies||{}))if(!Object.hasOwn(metadata.optionalDependencies||{},dependency))await include(dependency,resolveFrom);
 for(const dependency of Object.keys(metadata.optionalDependencies||{}))await include(dependency,resolveFrom,true);
}
for(const name of ['pdf-lib','fflate','sharp','pdfjs-dist','@napi-rs/canvas'])await include(name);
await writeFile(new URL('processing-pack.json',out),JSON.stringify({platform:process.platform,arch:process.arch,packages:[...copied].map(path=>relative(fileURLToPath(root),path).replaceAll('\\','/')).sort(),scope:'Thirteen initial processing workflows; full 26-tool release validation pending'},null,2));
console.log('Prepared on-demand processing dependencies:',copied.size);
