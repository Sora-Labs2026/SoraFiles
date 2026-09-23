import {cp,mkdir,readFile,readdir,copyFile,writeFile,realpath,rm,unlink} from 'node:fs/promises';
import {join,relative,dirname,sep} from 'node:path';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import {existsSync} from 'node:fs';
import {desktopToolIds} from '../shared/tool-policy.mjs';
import {processingTools} from '../native-host/processing-host.mjs';
const root=new URL('../../',import.meta.url),require=createRequire(import.meta.url);
const out=new URL('.artifacts/desktop-license-host/',root);
await import('./sync-pdf-tables.mjs');
await import('./sync-pdf-text.mjs');
await import('./sync-scan-filters.mjs');
await import('./sync-image-adjustments.mjs');
await import('./sync-image-metadata.mjs');
await import('./sync-background-model.mjs');
await import('./sync-heif-decoder.mjs');
const matches=(values,current)=>!values||(!values.includes('!'+current)&&(!values.some(value=>!value.startsWith('!'))||values.includes(current)));
const compatible=metadata=>matches(metadata.os,process.platform)&&matches(metadata.cpu,process.arch);
// Remove only known incompatible package copies from this generated pack. The
// recovered workspace may contain several platforms' optional dependencies.
const previousPath=new URL('processing-pack.json',out);
if(existsSync(previousPath)){
 const generated=await realpath(new URL('node_modules/',out));
 for(const packagePath of JSON.parse(await readFile(previousPath,'utf8')).packages){
  if(!/^node_modules\/(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+(?:\/node_modules\/(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)*\/package\.json$/i.test(packagePath))throw Error('Invalid generated package path');
  const metadataPath=new URL(packagePath,out);if(!existsSync(metadataPath))continue;
  if(!compatible(JSON.parse(await readFile(metadataPath,'utf8')))){
   const target=await realpath(new URL('./',metadataPath));
   if(!target.startsWith(generated+sep))throw Error('Generated package escaped output directory');
   await rm(target,{recursive:true});
  }
 }
}
for(const directory of ['core','shared','native-host']){
 const source=new URL('desktop/'+directory+'/',root),target=new URL('desktop/'+directory+'/',out);await mkdir(target,{recursive:true});
 for(const name of await readdir(source))if(name.endsWith('.mjs')||['heif-decoder.cjs','heif-decoder-LICENSE.txt','heif-decoder-provenance.json'].includes(name))await copyFile(new URL(name,source),new URL(name,target));
}
// Copy only the installed processing dependency closure for the current target.
// Missing platform optional packages are expected; required packages fail builds.
const copied=new Set();
const generatedRoot=await realpath(out);
// npm's nested .bin launchers are installation-time conveniences, not imported
// engine modules. On Unix they are symlinks back into the source installation;
// copying them would make the resource package depend on that checkout.
const npmBinDirectory=path=>relative(fileURLToPath(out),path).split(sep).some((part,index,parts)=>part==='.bin'&&parts[index-1]==='node_modules');
async function removeOldBinDirectories(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=join(directory,entry.name);
  if(npmBinDirectory(path)){
   // This path is an entry discovered beneath the generated package only.
   const parent=await realpath(dirname(path));if(!parent.startsWith(generatedRoot+sep))throw Error('Generated launcher path escaped output');
   if(entry.isSymbolicLink())await unlink(path);
   else {const target=await realpath(path);if(!target.startsWith(generatedRoot+sep))throw Error('Generated launcher target escaped output');await rm(target,{recursive:true,force:true});}
  }else if(entry.isDirectory()&&!entry.isSymbolicLink())await removeOldBinDirectories(path);
 }
}
const previousModules=new URL('node_modules/',out);if(existsSync(previousModules))await removeOldBinDirectories(fileURLToPath(previousModules));
async function include(name,from=require,optional=false){
 // Package dependencies can share names with Node built-ins (string_decoder).
 // The trailing slash requests package search paths instead of a null built-in
 // resolution; readable-stream explicitly requires this userland dependency.
 const packagePath=(from.resolve.paths(name+'/')||[]).map(base=>join(base,name,'package.json')).find(existsSync);
 if(!packagePath){if(optional)return;throw Error('Missing processing dependency: '+name);}
 if(copied.has(packagePath))return;
 const metadata=JSON.parse(await readFile(packagePath,'utf8'));
 if(!compatible(metadata)){if(optional)return;throw Error('Processing dependency does not support current platform: '+name);}
 copied.add(packagePath);
 const source=dirname(packagePath),destination=relative(fileURLToPath(new URL('node_modules/',root)),source);
 if(destination.startsWith('..'))throw Error('Processing dependency outside installed tree');
 await cp(source,join(fileURLToPath(out),'node_modules',destination),{recursive:true,errorOnExist:false,filter:path=>{
  const parts=relative(source,path).split(sep);return !parts.some((part,index)=>part==='.bin'&&parts[index-1]==='node_modules');
 }});
 const resolveFrom=createRequire(packagePath);
 for(const dependency of Object.keys(metadata.dependencies||{}))if(!Object.hasOwn(metadata.optionalDependencies||{},dependency))await include(dependency,resolveFrom);
 for(const dependency of Object.keys(metadata.optionalDependencies||{}))await include(dependency,resolveFrom,true);
}
for(const name of ['pdf-lib','fflate','sharp','pdfjs-dist','@napi-rs/canvas','@xmldom/xmldom','tesseract.js','@pdfsmaller/pdf-encrypt','xlsx','docx','@neslinesli93/qpdf-wasm','onnxruntime-web'])await include(name);
await mkdir(new URL('assets/background/',out),{recursive:true});
await cp(new URL('.artifacts/desktop-background-assets/',root),new URL('assets/background/',out),{recursive:true});
await mkdir(new URL('licenses/',out),{recursive:true});
for(const name of ['background-model-ThirdPartyLicenses.json','background-processing-AGPL-3.0.txt','background-model-NOTICE.txt','ISNET-upstream-Apache-2.0.txt','ISNET-upstream-provenance.json'])await copyFile(new URL('desktop/licenses/'+name,root),new URL('licenses/'+name,out));
await copyFile(new URL('desktop/licenses/qpdf-NOTICE.txt',root),new URL('licenses/qpdf-NOTICE.txt',out));
await copyFile(new URL('node_modules/pdfjs-dist/LICENSE',root),new URL('licenses/qpdf-Apache-2.0.txt',out));
await mkdir(new URL('assets/ocr/lang/',out),{recursive:true});
await copyFile(new URL('public/ocr/manifest.json',root),new URL('assets/ocr/manifest.json',out));
await cp(new URL('public/ocr/licenses/',root),new URL('assets/ocr/licenses/',out),{recursive:true});
for(const name of await readdir(new URL('public/ocr/lang/',root)))if(name.endsWith('.traineddata.gz'))await copyFile(new URL('public/ocr/lang/'+name,root),new URL('assets/ocr/lang/'+name,out));
await writeFile(new URL('processing-pack.json',out),JSON.stringify({platform:process.platform,arch:process.arch,packages:[...copied].map(path=>relative(fileURLToPath(root),path).replaceAll('\\','/')).sort(),scope:`${processingTools.length} initial processing workflows; ${desktopToolIds.length} eligible Desktop tools require release validation`},null,2));
await import('./prune-processing-pack.mjs');
console.log('Prepared on-demand processing dependencies:',copied.size);
