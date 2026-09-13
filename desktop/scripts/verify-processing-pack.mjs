import {cp,mkdtemp,realpath,writeFile,readFile,readdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';import {generateKeyPairSync} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';import sharp from 'sharp';import {deviceIdentity} from '../shared/entitlement.mjs';import {entitlementClaims,signEntitlement} from '../license-service/signing.mjs';
const directory=await mkdtemp(join(await realpath(tmpdir()),'sf-isolated-pack-'));
try{
 const pack=join(directory,'pack');await cp(resolve('.artifacts/desktop-license-host'),pack,{recursive:true});
 const pair=generateKeyPairSync('ed25519'),devicePair=generateKeyPairSync('ed25519'),device={publicKey:devicePair.publicKey.export({type:'spki',format:'pem'}),privateKey:devicePair.privateKey.export({type:'pkcs8',format:'pem'})};
 const claims=entitlementClaims({license:{ref:'synthetic',plan:'personal-lifetime',status:'active'},deviceId:deviceIdentity(device.publicKey),now:Math.floor(Date.now()/1000)});
 let state={schema:1,device,license:{entitlement:signEntitlement(claims,{privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'}),kid:'test'}),lastTrustedTime:Date.now()}};
 const config={origin:'https://license.sorafiles.com',keys:{test:pair.publicKey.export({type:'spki',format:'pem'})}};
 async function run(tool,source,options){
  const child=spawn(join(pack,process.platform==='win32'?'node.exe':'node'),[join(pack,'desktop/native-host/process-main.mjs')],{cwd:directory,env:Object.fromEntries(Object.entries(process.env).filter(([key])=>['systemroot','windir','temp','tmp','tmpdir'].includes(key.toLowerCase()))),stdio:['pipe','pipe','pipe'],windowsHide:true});
  let result,error,stderr='';child.stderr.on('data',chunk=>{stderr+=chunk.toString().slice(0,2048);});
  const exited=new Promise((done,fail)=>{child.once('error',fail);child.once('exit',code=>done(code));});
  const timeout=setTimeout(()=>child.kill(),30000);
  try{
   const lines=createInterface({input:child.stdout});child.stdin.write(JSON.stringify({type:'process',tool,paths:[source],options,state,config})+'\n');
   for await(const line of lines){const message=JSON.parse(line);if(message.type==='save'){state=message.state;child.stdin.write('{"type":"saved","ok":true}\n');}else if(message.type==='result')result=message.result;else if(message.type==='error')error=message.message;}
   const code=await exited;if(code!==0||!result||error)throw Error('Isolated processing failed: '+(error||stderr||code));return result;
  }finally{clearTimeout(timeout);child.kill();await exited;}
 }
 const doc=await PDFDocument.create();doc.addPage();const source=join(directory,'document.pdf');await writeFile(source,await doc.save());
 const pdf=await run('rotate-pdf',source,{rotations:[{pageIndex:0,angle:90}]});if((await PDFDocument.load(await readFile(pdf.path))).getPage(0).getRotation().angle!==90)throw Error('PDF output did not rotate');
 const imageSource=join(directory,'image.png');await writeFile(imageSource,await sharp({create:{width:100,height:60,channels:3,background:'#405080'}}).png().toBuffer());
 const image=await run('resize-image',imageSource,{width:50,format:'png'});if((await sharp(await readFile(image.path)).metadata()).width!==50)throw Error('Image output did not resize');
 const raster=await run('pdf-to-jpg',source,{dpi:72,format:'png',quality:95});const rasterMetadata=await sharp(await readFile(raster.path)).metadata();
 if(rasterMetadata.width!==596||rasterMetadata.height!==842||rasterMetadata.format!=='png')throw Error('PDF image output did not preserve page dimensions');
 const report={platform:process.platform,arch:process.arch,status:'PASS',checks:['isolated bundled runtime and dependencies','private-pipe synthetic entitlement','PDF rotation decoded','image resize decoded','PDF image decoded with page dimensions'],scope:'No installed-app, OS key-store, remaining engines or live license certification'};
 await writeFile('.artifacts/processing-pack-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{
 // mkdtemp owns this uniquely named fixture directory; no user files enter it.
 await rm(directory,{recursive:true,force:true});
}
