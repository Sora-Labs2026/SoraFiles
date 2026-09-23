import {spawn} from 'node:child_process';import {resolve} from 'node:path';import {mkdir,readFile,rm} from 'node:fs/promises';
import {validateNativeSmokeReport} from './native-smoke-report.mjs';
const binary=resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Native executable path required');
const background=process.argv.includes('--background-job');
const startup=process.argv.includes('--startup-helper');if(startup&&background)throw Error('Choose one diagnostic mode');
const output=resolve('.artifacts/native-smoke-'+(background?'background-':startup?'startup-':'')+process.platform+'-'+process.arch+'.json');await mkdir('.artifacts',{recursive:true});await rm(output,{force:true});
const child=spawn(binary,['--native-smoke',output,...background?['--background-job']:startup?['--startup-helper']:[]],{stdio:['ignore','pipe','pipe'],windowsHide:true});let stderr='';child.stderr.on('data',chunk=>stderr=(stderr+chunk).slice(-4000));child.stdout.resume();
const timer=setTimeout(()=>child.kill(),60000);
try{await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>code===0?resolve():reject(Error('Native smoke did not finish: '+(signal||code)+' '+stderr)));});
 const report=JSON.parse(await readFile(output,'utf8'));validateNativeSmokeReport(report,{background,startup});console.log(JSON.stringify(report));
}finally{clearTimeout(timer);if(child.exitCode===null)child.kill();}
