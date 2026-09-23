import {open,lstat,realpath,unlink} from 'node:fs/promises';
import {publishStagedOutput} from './publication.mjs';
import {basename,dirname,extname,join,resolve,parse,sep} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {currentOutputPublisher} from './native-publication.mjs';
const suffixes={'watermark-pdf':'-watermarked','sign-pdf':'-signed','jpg-to-pdf':'-images','page-numbers':'-numbered','compress-pdf':'-compressed','compress-image':'-compressed','pdf-ocr':'-ocr','remove-background':'-no-bg','metadata-remover':'-clean','rotate-pdf':'-rotated','resize-image':'-resized','split-pdf':'-split','merge-pdf':'-merged','remove-pages':'-pages-removed'};
export function outputName(source,tool,extension){
 if(/^[a-z]:[^\\/]/i.test(source))throw Error('Drive-relative paths are not allowed');
 const name=basename(source),stem=name.slice(0,name.length-extname(name).length).normalize('NFC');
 if(!/^[a-z0-9]{2,8}$/.test(extension)||!stem||/[\x00-\x1f<>:"/\\|?*]/.test(stem)||/[. ]$/.test(stem)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem))throw Error('Choose a safe output filename');
 return stem+(suffixes[tool]||'')+'.'+extension;
}
async function checkedDirectory(folder){
 const absolute=resolve(folder),root=parse(absolute).root;let cursor=root;
 for(const part of absolute.slice(root.length).split(sep).filter(Boolean)){cursor=join(cursor,part);const info=await lstat(cursor);if(info.isSymbolicLink()||!info.isDirectory())throw Error('Output folder must not contain symbolic links');}
 if(await realpath(absolute)!==absolute)throw Error('Output folder changed');return absolute;
}
// Portable reference writer; the Windows private pipe installs native publication
// and retains input/directory handles in its parent for the duration of each job.
export async function saveOutput({source,folder=dirname(source),tool,extension,bytes,validate,signal}){
 signal?.throwIfAborted();if(!(bytes instanceof Uint8Array)||bytes.length===0||bytes.length>256*1024*1024)throw Error('Invalid output size');
 if(typeof validate!=='function')throw Error('Output validator required');
 const dir=await checkedDirectory(folder),name=outputName(source,tool,extension),temp=join(dir,'.sorafiles-'+randomUUID()+'.tmp');let owned=false;
 try{const handle=await open(temp,'wx',0o600);owned=true;try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
  if(!(await validate(temp)))throw Error('Output validation failed');signal?.throwIfAborted();
  const publish=currentOutputPublisher();
  if(publish){
   // The native parent locks the staged file, verifies these exact validated
   // bytes and renames that same open file without replacing a destination.
   const result=await publish({stage:temp,target:join(dir,name),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
   owned=false;return {path:result.path,bytes:bytes.length};
  }
  const stem=name.slice(0,-extname(name).length),extensionPart=extname(name);
  for(let i=0;i<10000;i++){signal?.throwIfAborted();await checkedDirectory(dir);const target=join(dir,i?`${stem} (${i})${extensionPart}`:name);
   // Hard-link publication is atomic and refuses collisions; rename would replace on POSIX.
   try{const {cleanupPending}=await publishStagedOutput(temp,target);owned=cleanupPending;return {path:target,bytes:bytes.length,...(cleanupPending?{cleanupPending:true}:{})};}catch(e){if(e.code==='EEXIST')continue;throw e;}
  }throw Error('Too many filename conflicts');
 }finally{if(owned)await unlink(temp).catch(()=>{});}
}
