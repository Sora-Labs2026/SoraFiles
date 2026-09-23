import {cp,mkdtemp,realpath,writeFile,readFile,readdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';import {generateKeyPairSync} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';import sharp from 'sharp';import {deviceIdentity} from '../shared/entitlement.mjs';import {entitlementClaims,signEntitlement} from '../license-service/signing.mjs';
import {createHash} from 'node:crypto';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as XLSX from 'xlsx';
import {unzipSync,strFromU8} from 'fflate';
import {officeMetadataFixture} from '../tests/fixtures/office-metadata.mjs';
const directory=await mkdtemp(join(await realpath(tmpdir()),'sf-isolated-pack-'));
try{
 const pack=join(directory,'pack');await cp(resolve('.artifacts/desktop-license-host'),pack,{recursive:true});
 const runtime=JSON.parse(await readFile(join(pack,'runtime.json'),'utf8'));
 if(createHash('sha256').update(await readFile(join(pack,runtime.notice.file))).digest('hex')!==runtime.notice.sha256)throw Error('Runtime notice missing or changed');
 const modelManifest=JSON.parse(await readFile(join(pack,'assets/ocr/manifest.json'),'utf8'));
 for(const entry of modelManifest.files.filter(entry=>entry.path.startsWith('licenses/'))){
  const bytes=await readFile(join(pack,'assets/ocr',entry.path));if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('OCR notice missing or changed');
 }
 const packages=JSON.parse(await readFile(join(pack,'processing-pack.json'),'utf8')).packages;
 for(const path of packages){const metadata=JSON.parse(await readFile(join(pack,path),'utf8'));if(metadata.os&&!metadata.os.includes(process.platform))throw Error('Unrelated platform binary in pack');}
 const pair=generateKeyPairSync('ed25519'),devicePair=generateKeyPairSync('ed25519'),device={publicKey:devicePair.publicKey.export({type:'spki',format:'pem'}),privateKey:devicePair.privateKey.export({type:'pkcs8',format:'pem'})};
 const claims=entitlementClaims({license:{ref:'synthetic',plan:'personal-lifetime',status:'active'},deviceId:deviceIdentity(device.publicKey),now:Math.floor(Date.now()/1000)});
 let state={schema:1,device,license:{entitlement:signEntitlement(claims,{privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'}),kid:'test'}),lastTrustedTime:Date.now()}};
 const config={origin:'https://license.sorafiles.com',keys:{test:pair.publicKey.export({type:'spki',format:'pem'})}};
 async function run(tool,source,options){
  const child=spawn(join(pack,process.platform==='win32'?'node.exe':'node'),[join(pack,'desktop/native-host/process-main.mjs')],{cwd:directory,env:Object.fromEntries(Object.entries(process.env).filter(([key])=>['systemroot','windir','temp','tmp','tmpdir'].includes(key.toLowerCase()))),stdio:['pipe','pipe','pipe'],windowsHide:true});
  let result,error,stderr='';child.stderr.on('data',chunk=>{stderr+=chunk.toString().slice(0,2048);});
  const exited=new Promise((done,fail)=>{child.once('error',fail);child.once('exit',code=>done(code));});
  const timeout=setTimeout(()=>child.kill(),180000);
  try{
   const lines=createInterface({input:child.stdout});child.stdin.write(JSON.stringify({type:'process',tool,paths:Array.isArray(source)?source:[source],options,state,config})+'\n');
   for await(const line of lines){const message=JSON.parse(line);if(message.type==='save'){state=message.state;child.stdin.write('{"type":"saved","ok":true}\n');}else if(message.type==='result')result=message.result;else if(message.type==='error')error=message.message;}
   const code=await exited;if(code!==0||!result||error)throw Error('Isolated processing failed: '+(error||stderr||code));return result;
  }finally{clearTimeout(timeout);child.kill();await exited;}
 }
 const doc=await PDFDocument.create();doc.addPage().drawText('SoraFiles invoice 4827',{x:40,y:700,size:28});const source=join(directory,'document.pdf');await writeFile(source,await doc.save());
 const uncompressed=join(directory,'uncompressed.pdf');await writeFile(uncompressed,await doc.save({useObjectStreams:false}));
 const compressed=await run('compress-pdf',uncompressed,{});
 if(compressed.bytes>(await readFile(uncompressed)).length||(await PDFDocument.load(await readFile(compressed.path))).getPageCount()!==1)throw Error('Bundled structural compression failed');
 const damaged=join(directory,'repair.pdf');await writeFile(damaged,Buffer.from((await readFile(uncompressed)).toString('latin1').replace(/startxref\s+\d+/,'startxref\n1'),'latin1'));
 const repaired=await run('repair-pdf',damaged,{});
 if((await PDFDocument.load(await readFile(repaired.path))).getPageCount()!==1)throw Error('Bundled PDF repair failed');
 const pdf=await run('rotate-pdf',source,{rotations:[{pageIndex:0,angle:90}]});if((await PDFDocument.load(await readFile(pdf.path))).getPage(0).getRotation().angle!==90)throw Error('PDF output did not rotate');
 const word=await run('pdf-to-word',source,{direction:'ltr'}),wordArchive=unzipSync(await readFile(word.path));
 if(!strFromU8(wordArchive['word/document.xml']).includes('SoraFiles invoice 4827'))throw Error('Word document lost source text');
 const batch=await run('rotate-pdf',[source,source],{rotations:[{pageIndex:0,angle:90}]});
 if(batch.state!=='batch'||batch.results.length!==2||batch.results.some(row=>row.state!=='completed')||batch.results[0].name===batch.results[1].name)throw Error('Batch output failed');
 for(const row of batch.results)if((await PDFDocument.load(await readFile(join(directory,row.name)))).getPage(0).getRotation().angle!==90)throw Error('Batch output did not rotate');
 const imageSource=join(directory,'image.png');await writeFile(imageSource,await sharp({create:{width:100,height:60,channels:3,background:'#405080'}}).png().toBuffer());
 const scanned=await run('doc-scanner',[imageSource,imageSource],{filter:'grayscale',rotation:90,paper:'a4'});
 if((await PDFDocument.load(await readFile(scanned.path))).getPageCount()!==2)throw Error('Bundled scanner lost selected pages');
 const backgroundSource=join(directory,'background.png');await writeFile(backgroundSource,await sharp(Buffer.from('<svg width="640" height="400"><rect width="640" height="400" fill="#f4e7d1"/><rect x="200" y="76" width="240" height="276" rx="24" fill="#4338ca"/></svg>')).png().toBuffer());
 const cutout=await run('remove-background',backgroundSource,{}),cutoutPixels=await sharp(await readFile(cutout.path)).ensureAlpha().raw().toBuffer();
 if(cutoutPixels[3]>20||cutoutPixels[(200*640+320)*4+3]<235)throw Error('Bundled background model failed');
 if(process.env.SORA_HEIC_TEST_FIXTURE){
  const heic=await readFile(process.env.SORA_HEIC_TEST_FIXTURE);
  if(createHash('sha256').update(heic).digest('hex')!=='7f8b363e4936c0666a25f64f3a92fda10bd8e5453be4592530b65a55dd98f3f2')throw Error('Unexpected HEIC fixture');
  const heicSource=join(directory,'photo.heic');await writeFile(heicSource,heic);const converted=await run('heic-to-jpg',heicSource,{quality:90});
  const metadata=await sharp(await readFile(converted.path)).metadata();if(metadata.format!=='jpeg'||metadata.width!==1280||metadata.height!==854)throw Error('Bundled HEIC decoder failed');
 }
 const metadataSource=join(directory,'metadata.pdf'),metadataDoc=await PDFDocument.create();metadataDoc.addPage();metadataDoc.setAuthor('Synthetic private author');await writeFile(metadataSource,await metadataDoc.save());
 const cleaned=await run('metadata-remover',metadataSource,{});if((await PDFDocument.load(await readFile(cleaned.path),{updateMetadata:false})).getAuthor()!==undefined)throw Error('PDF metadata remained');
 const privateImage=join(directory,'private-image.jpg'),privateBytes=await sharp({create:{width:40,height:30,channels:3,background:'#714392'}}).withExif({IFD0:{Artist:'Synthetic private author'}}).jpeg().toBuffer();await writeFile(privateImage,privateBytes);
 for(const extension of ['docx','xlsx','pptx']){
  const fixture=officeMetadataFixture(extension),source=join(directory,'private-office.'+extension);await writeFile(source,fixture.bytes);
  const result=await run('metadata-remover',source,{}),archive=unzipSync(await readFile(result.path));
  if(!result.path.endsWith('.'+extension)||!Buffer.from(archive[fixture.part]).equals(Buffer.from(fixture.entries[fixture.part])))throw Error('Bundled Office cleanup changed document content or format');
  for(const part of ['core','app','custom'])if(strFromU8(archive[`docProps/${part}.xml`]).includes('Private'))throw Error('Bundled Office cleanup retained private properties');
  if(!(await readFile(source)).equals(Buffer.from(fixture.bytes)))throw Error('Bundled Office cleanup changed the source');
 }
 const imageCleaned=await run('metadata-remover',privateImage,{}),cleanImageBytes=await readFile(imageCleaned.path);
 if((await sharp(cleanImageBytes).metadata()).exif||!(await sharp(cleanImageBytes).raw().toBuffer()).equals(await sharp(privateBytes).raw().toBuffer()))throw Error('Bundled image metadata cleanup changed pixels or retained EXIF');
 const tableSource=join(directory,'table.pdf'),tableDoc=await PDFDocument.create(),tablePage=tableDoc.addPage();
 [['ID','Value'],['00123','=1+1']].forEach((row,index)=>row.forEach((text,column)=>tablePage.drawText(text,{x:40+column*180,y:700-index*24,size:12})));
 await writeFile(tableSource,await tableDoc.save());const spreadsheet=await run('pdf-to-excel',tableSource,{}),workbook=XLSX.read(await readFile(spreadsheet.path),{type:'buffer'}),sheet=workbook.Sheets[workbook.SheetNames[0]];
 if(sheet.A2.v!=='00123'||sheet.B2.v!=='=1+1'||sheet.B2.f)throw Error('Table workbook values changed');
 const image=await run('resize-image',imageSource,{width:50,format:'png'});if((await sharp(await readFile(image.path)).metadata()).width!==50)throw Error('Image output did not resize');
 const adjusted=await run('edit-image',imageSource,{format:'png',adjustments:{brightness:50}}),adjustedPixels=await sharp(await readFile(adjusted.path)).ensureAlpha().raw().toBuffer();
 if(!adjustedPixels.subarray(0,4).equals(Buffer.from([96,112,160,255])))throw Error('Bundled image adjustments changed expected colour');
 const raster=await run('pdf-to-jpg',source,{dpi:72,format:'png',quality:95});const rasterMetadata=await sharp(await readFile(raster.path)).metadata();
 if(rasterMetadata.width!==596||rasterMetadata.height!==842||rasterMetadata.format!=='png')throw Error('PDF image output did not preserve page dimensions');
 const rangeDoc=await PDFDocument.create();for(let n=0;n<3;n++)rangeDoc.addPage([80+n*10,60]);const rangeSource=join(directory,'range.pdf');await writeFile(rangeSource,await rangeDoc.save());
 const rangeResult=await run('pdf-to-jpg',rangeSource,{dpi:72,format:'png',selected:[2,0]}),rangeArchive=unzipSync(await readFile(rangeResult.path));
 if(Object.keys(rangeArchive).join(',')!=='page-0001.png,page-0003.png'||(await sharp(rangeArchive['page-0003.png']).metadata()).width!==100)throw Error('Selected raster ZIP lost original page numbers or order');
 const ocr=await run('pdf-ocr',source,{language:'eng',format:'txt'});if(!(await readFile(ocr.path,'utf8')).includes('4827'))throw Error('Bundled OCR did not recognize the invoice number');
 const protectedResult=await run('protect-pdf',source,{password:'Synthetic-Pack-Password'}),protectedBytes=Uint8Array.from(await readFile(protectedResult.path));
 for(const password of [undefined,'Synthetic-Pack-Password']){
  const task=getDocument({data:protectedBytes.slice(),password,verbosity:0,isEvalSupported:false});
  try{const pdf=await task.promise;if(password===undefined||pdf.numPages!==1)throw Error('Protected output verification failed');}
  catch(error){if(password!==undefined||error.name!=='PasswordException')throw error;}
  finally{await task.destroy();}
 }
 const report={platform:process.platform,arch:process.arch,status:'PASS',checks:['isolated bundled runtime and current-platform dependencies','runtime and OCR license notices verified','private-pipe synthetic entitlement','PDF structure compression decoded','PDF damaged-offset repair decoded','scanner preserves selected page count','background model removes known background and keeps subject alpha','PDF rotation decoded','Word DOCX text verified','PDF metadata properties removed','DOCX XLSX PPTX metadata removed with preserved content and source bytes','PDF tables preserve text cells without formulas','batch PDFs decoded with separate collision-safe names','image resize decoded','shared image adjustment pixels verified','PDF image decoded with page dimensions','OCR with bundled language data recognizes invoice number','protected PDF requires its password'],scope:'No installed-app, OS key-store, remaining engines or live license certification'};
 await writeFile('.artifacts/processing-pack-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{
 // mkdtemp owns this uniquely named fixture directory; no user files enter it.
 await rm(directory,{recursive:true,force:true});
}
