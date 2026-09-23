// Development feasibility probe only. Verified recovered supplier assets stay
// outside the shipped pack. Successful initialization does not prove conversion.
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {resolve,join} from 'node:path';import {spawn} from 'node:child_process';
const assets={
 'soffice.js':['5143e5354f470b87f86ba272bcfef857bd13e6f07b59666e48a7ccb89643cd77',858124],
 'soffice.wasm':['9ebd9a487e849a24b9c69f843ebdb451709c27b7722c010e36846433474a5bd4',161667499],
 'soffice.data.js.metadata':['5d9d909d0b9b38443c0f19704032d0fc12d654f6c9c24c2c3b237739c4848ae3',215180],
 'soffice.data':['3dab0a5448e599dccc1b1e69f4f86ea9eb30777c3f1ed7b9c386a5f4163e361c',99520604]
},hash=bytes=>createHash('sha256').update(bytes).digest('hex'),root=resolve('.artifacts/office-node-probe');await mkdir(root,{recursive:true});
for(const [name,[expected,length]] of Object.entries(assets)){
 const bytes=await readFile(resolve('.artifacts/desktop-probe-cache',hash('https://cdn.zetaoffice.net/zetaoffice_latest/'+name)));
 if(bytes.length!==length||hash(bytes)!==expected)throw Error('Recovered Office asset failed integrity check');await writeFile(join(root,name),bytes);
}
await writeFile(join(root,'package.json'),'{"type":"commonjs"}');
const source=await readFile(join(root,'soffice.js'),'utf8');
const convert=process.argv.includes('--convert');
if(convert){
 const {Document,Paragraph,TextRun,Packer}=await import('docx');
 await writeFile(join(root,'input.docx'),await Packer.toBuffer(new Document({sections:[{children:[new Paragraph({children:[new TextRun('SoraFiles Office invoice 4827')]})]}]})));
}
await writeFile(join(root,'probe.cjs'),`const soraFs=require('node:fs'),soraPath=require('node:path');
global.fetch=()=>Promise.reject(Error('Network disabled in Office probe'));
global.XMLHttpRequest=class {
 open(method,url){if(method!=='GET'||soraPath.resolve(url)!==soraPath.join(__dirname,'soffice.data.js.metadata'))throw Error('Unsupported local metadata request');this.url=url;}
 overrideMimeType(){}
 send(){soraFs.readFile(this.url,'utf8',(error,text)=>{if(error)throw error;this.responseText=text;this.status=200;this.readyState=4;this.onreadystatechange?.();});}
};
var Module={noInitialRun:${!convert},arguments:${JSON.stringify(convert?['--headless','--nologo','--nodefault','--nofirststartwizard','--convert-to','pdf','--outdir','/tmp/out','/tmp/input.docx']:[])},locateFile:name=>{if(!${JSON.stringify(Object.keys(assets))}.includes(name))throw Error('Unknown Office asset');return soraPath.join(__dirname,name);},print:text=>console.log(String(text).slice(0,300)),printErr:text=>console.error(String(text).slice(0,300)),onAbort:reason=>{soraFs.writeSync(2,String(reason).slice(0,800));process.exit(1);},onRuntimeInitialized:()=>{console.log(JSON.stringify({status:'INITIALIZED',hasVirtualFS:typeof FS!=='undefined',hasUno:!!Module.uno,scope:'WASM initialization only; no document conversion'}));
${convert?`FS.writeFile('/tmp/input.docx',soraFs.readFileSync(soraPath.join(__dirname,'input.docx')));FS.mkdir('/tmp/out');setInterval(()=>{try{const bytes=FS.readFile('/tmp/out/input.pdf');if(bytes.length){soraFs.writeFileSync(soraPath.join(__dirname,'output.pdf'),bytes);console.log('CONVERTED');process.exit(0);}}catch{}},250);`:'process.exit(0);'}
}};
${source}`);
const child=spawn(process.execPath,[join(root,'probe.cjs')],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:Object.fromEntries(Object.entries(process.env).filter(([key])=>['systemroot','windir','temp','tmp','tmpdir'].includes(key.toLowerCase())))});
let stdout='',stderr='',timedOut=false;child.stdout.on('data',c=>stdout=(stdout+c).slice(-4096));child.stderr.on('data',c=>stderr=(stderr+c).slice(-4096));
const timer=setTimeout(()=>{timedOut=true;child.kill();},60000);
const code=await new Promise((done,fail)=>{child.once('error',fail);child.once('exit',done);});clearTimeout(timer);
const report={recordedAt:new Date().toISOString(),status:convert?(code===0&&stdout.includes('CONVERTED')?'CONVERTED':'NOT_CONVERTED'):code===0&&stdout.includes('INITIALIZED')?'INITIALIZED':'NOT_INITIALIZED',code,timedOut,totalAssetBytes:Object.values(assets).reduce((sum,row)=>sum+row[1],0),stdout,stderr,scope:'Cached hash-verified Office WASM feasibility probe, local-only metadata shim; optional synthetic headless DOCX test. Not a shipped engine or parity certification'};
await writeFile('.artifacts/office-node-probe.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
