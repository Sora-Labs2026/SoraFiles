import {spawn} from 'node:child_process';
import {realpath,writeFile,readFile,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
const binary=resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Supply the packaged native executable');
async function run(args){
 const start=performance.now();const child=spawn(binary,args,{stdio:['ignore','ignore','pipe'],windowsHide:true});
 let stderr='';child.stderr.on('data',chunk=>stderr=(stderr+chunk).slice(-2000));
 const timeout=setTimeout(()=>child.kill(),10000);
 try{return await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal,milliseconds:Math.round(performance.now()-start),...(code===0?{}:{stderr})}));});}
 finally{clearTimeout(timeout);}
}
const reports=[];
for(const count of [1,2]){
 // macOS /var is a symlink to /private/var. Fixtures must use the original
 // location, matching the native boundary that refuses symlink selections.
 const directory=join(await realpath(tmpdir()),'sorafiles-shell-'+randomUUID());await mkdir(directory);
 try{
  const files=[];for(let i=0;i<count;i++){const file=join(directory,`Selected 日本語 space ${i}.png`);await copyFile(resolve('public/icon-192.png'),file);files.push(file);}
  const request=join(directory,'request.json'),response=join(directory,'response.tsv');
  await writeFile(request,JSON.stringify({version:1,files}));
  const result=await run(['--shell-menu',request,response]);
  if(result.code!==0)throw Error('Packaged menu broker failed: '+JSON.stringify(result));
  const menu=await readFile(response,'utf8');
  if(!/^(?:[a-z0-9-]+\t[^\r\n\t]+\n)+$/.test(menu)||/unlock|decrypt|unprotect/i.test(menu))throw Error('Invalid packaged menu response');
  const again=await run(['--shell-menu',request,response]);
  if(again.code===0||(await readFile(response,'utf8'))!==menu)throw Error('Broker overwrote an existing response');
  reports.push({selectionCount:count,...result,actions:menu.trim().split('\n').map(line=>line.split('\t')[0]),existingResponsePreserved:true});
 }finally{await rm(directory,{recursive:true,force:true});}
}
const report={status:'PASS',platform:process.platform,arch:process.arch,scope:'Real packaged broker, Unicode/space paths, one/multiple files, bounded exit, existing response preservation; uses current local entitlement without changing it. No Explorer UI or paid-action execution certification.',cases:reports};
await mkdir('.artifacts',{recursive:true});await writeFile('.artifacts/shell-broker-smoke-'+process.platform+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
