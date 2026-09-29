import {spawn} from 'node:child_process';import {resolve} from 'node:path';import {mkdir,readFile,rm} from 'node:fs/promises';
import {validateNativeSmokeReport} from './native-smoke-report.mjs';
const binary=resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Native executable path required');
const background=process.argv.includes('--background-job');
const startup=process.argv.includes('--startup-helper');const race=process.argv.includes('--window-race');if(background+startup+race>1)throw Error('Choose one diagnostic mode');
const output=resolve('.artifacts/native-smoke-'+(background?'background-':startup?'startup-':race?'window-race-':'')+process.platform+'-'+process.arch+'.json');await mkdir('.artifacts',{recursive:true});await rm(output,{force:true});
const forwarded=output.replace(/\.json$/,'.forwarded.json');await rm(forwarded,{force:true});
const child=spawn(binary,['--native-smoke',output,...background?['--background-job']:startup?['--startup-helper']:race?['--window-race']:[]],{stdio:['ignore','pipe','pipe'],windowsHide:true});let stderr='';child.stderr.on('data',chunk=>stderr=(stderr+chunk).slice(-4000));child.stdout.resume();
const timer=setTimeout(()=>child.kill(),60000);
try{await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>code===0?resolve():reject(Error('Native smoke did not finish: '+(signal||code)+' '+stderr)));});
 const report=JSON.parse(await readFile(output,'utf8'));validateNativeSmokeReport(report,{background,startup,race});
 // Forwarded second instances must reach this app, never start a second one.
 if(race&&await readFile(forwarded).then(()=>true,()=>false))throw Error('A forwarded launch started a second app instance');console.log(JSON.stringify(report));
}finally{clearTimeout(timer);if(child.exitCode===null)child.kill();}
