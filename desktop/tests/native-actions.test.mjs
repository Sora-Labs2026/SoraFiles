import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolveNativeActions,resolveNativeActionRequest,implementedNativeToolIds} from '../shared/native-actions.mjs';
import {capabilities,relevantActions,quickActionMenu} from '../shared/capabilities.mjs';

const file=(format,extra={})=>({path:`C:\\Selected files\\写真.${format.toLowerCase()}`,format,validated:true,bytes:1000,...extra});
const context=(files,extra={})=>({files,authorized:true,platform:'windows',...extra});
const actions=(files,extra)=>resolveNativeActions(context(files,extra));
const ids=(files,extra)=>actions(files,extra).map(action=>action.id);

test('one JPG offers every connected relevant workflow and explicit conversion choices',()=>{
 const menu=actions([file('JPG')]);
 assert.deepEqual(menu.map(item=>item.id),['convert-to-png','convert-to-webp','jpg-to-pdf','compress-image','resize-image','edit-image','remove-background','metadata-remover','pdf-ocr','doc-scanner','open']);
 assert.equal(menu.find(item=>item.id==='convert-to-png').direct,true);
 assert.deepEqual(menu.find(item=>item.id==='convert-to-png').options,{format:'png',quality:85});
 for(const id of ['convert-to-webp','jpg-to-pdf'])assert.equal(menu.find(item=>item.id===id).direct,true);
 for(const id of ['resize-image','edit-image','pdf-ocr','doc-scanner'])assert.equal(menu.find(item=>item.id===id).requiresUI,true);
 assert.equal(menu.at(-1).label,'More options');
 assert.ok(!JSON.stringify(menu).includes('crop'));
});

test('selection-wide compatibility preserves mixed operations without silently discarding files',()=>{
 const images=[file('JPG'),file('PNG')],menu=actions(images);
 assert.ok(menu.find(item=>item.id==='jpg-to-pdf').combine);
 assert.ok(menu.find(item=>item.id==='compress-image').batch);
 assert.deepEqual(ids([file('PDF'),file('PNG')]),['metadata-remover','pdf-ocr','open']);
 assert.deepEqual(ids([file('DOCX'),file('XLSX'),file('PDF')]),['metadata-remover','open']);
 assert.deepEqual(ids([file('JPG'),file('PSD')]),['open']);
 assert.deepEqual(ids([file('JPG'),file('PNG',{validated:false})]),['open']);
});

test('one and multiple PDFs keep page, password, order and text choices interactive',()=>{
 assert.ok(!ids([file('PDF')]).includes('merge-pdf'));
 const menu=actions([file('PDF'),file('PDF')]);
 assert.equal(menu[0].id,'merge-pdf');assert.equal(menu[0].direct,false);assert.equal(menu[0].combine,true);
 assert.equal(menu.find(item=>item.id==='compress-pdf').direct,true);
 for(const id of ['split-pdf','rotate-pdf','protect-pdf','pdf-to-jpg','pdf-to-word','page-numbers','watermark-pdf'])assert.equal(menu.find(item=>item.id===id).requiresUI,true);
 assert.ok(!menu.some(item=>item.id==='sign-pdf'));
});

test('only engine-supported formats are advertised and known animation is refused',()=>{
 for(const format of ['BMP','AVIF','SVG','PSD','ICO','JP2'])assert.deepEqual(ids([file(format)]),['open']);
 for(const format of ['HEIC','HEIF'])assert.deepEqual(ids([file(format)]),['heic-to-jpg','open']);
 for(const format of ['GIF','TIFF']){
  assert.deepEqual(ids([file(format)]),['convert-to-png','convert-to-webp','convert-to-jpg','open']);
  assert.deepEqual(ids([file(format,{pages:2})]),['open']);
 }
 for(const format of ['PNG','WebP','GIF'])assert.deepEqual(ids([file(format,{animated:true})]),['open']);
 assert.deepEqual(ids([file('PDF',{encrypted:true})]),['open']);
});

test('engine inventory, platform and capability restrictions all fail closed',()=>{
 assert.deepEqual(ids([file('JPG')],{installedTools:[]}),['open']);
 assert.deepEqual(ids([file('JPG')],{installedTools:['compress-image']}),['compress-image','open']);
 assert.deepEqual(ids([file('JPG')],{platform:'unknown'}),['open']);
 for(const platform of ['windows','macos','linux'])assert.ok(ids([file('JPG')],{platform}).includes('convert-to-png'));
 const narrowed=capabilities.map(item=>({...item,platforms:['linux']}));
 assert.deepEqual(ids([file('JPG')],{capabilities:narrowed}),['open']);
 assert.ok(ids([file('JPG')],{capabilities:narrowed,platform:'linux'}).includes('compress-image'));
 assert.deepEqual(ids([file('JPG')],{capabilities:capabilities.map(item=>({...item,available:false}))}),['open']);
});

test('license display state never grants processing and action IDs are re-resolved',()=>{
 for(const authorized of [undefined,false,'active',{licensed:true}]){
  const input=context([file('JPG')],{authorized});
  assert.deepEqual(resolveNativeActions(input).map(item=>item.id),['activate']);
  assert.throws(()=>resolveNativeActionRequest('compress-image',input),/not available/);
 }
 const input=context([file('JPG')]);
 const request=resolveNativeActionRequest('convert-to-png',input);
 assert.equal(request.tool,'image-converter');assert.equal(request.direct,true);
 assert.deepEqual(request.selection,input.files);assert.notEqual(request.selection,input.files);
 assert.ok(request.validation.includes('verify-current-entitlement'));
 request.options.format='jpeg';assert.equal(resolveNativeActionRequest('convert-to-png',input).options.format,'png');
 for(const id of ['unlock-pdf','decrypt-pdf','remove-pdf-password','unprotect-pdf','strip-pdf-security','__proto__','image-converter'])assert.throws(()=>resolveNativeActionRequest(id,input));
 assert.throws(()=>resolveNativeActionRequest('convert-to-png',context([file('PDF')])));
});

test('counts and known engine resource limits narrow the entire selection',()=>{
 assert.deepEqual(resolveNativeActions(context([])),[]);
 assert.deepEqual(ids(Array.from({length:257},()=>file('PDF'))),['open']);
 assert.ok(!ids(Array.from({length:21},()=>file('PNG'))).includes('doc-scanner'));
 assert.ok(!ids([file('PNG',{bytes:65*1024*1024})]).includes('compress-image'));
 assert.ok(!ids([file('PNG',{pixels:13_000_000})]).includes('remove-background'));
 assert.ok(ids([file('PNG',{pixels:13_000_000})]).includes('resize-image'));
 assert.ok(!ids([file('PDF',{bytes:140*1024*1024}),file('PDF',{bytes:140*1024*1024})]).includes('merge-pdf'));
 assert.ok(!ids([file('PDF',{pages:601}),file('PDF',{pages:400})]).includes('merge-pdf'));
 assert.ok(!ids([file('PDF',{pages:61})]).includes('pdf-to-word'));
 assert.ok(ids([file('PDF',{bytes:65*1024*1024})]).includes('pdf-to-jpg'));
 assert.ok(!ids([file('PDF',{bytes:257*1024*1024})]).includes('rotate-pdf'));
 assert.ok(!ids(Array.from({length:6},()=>file('PNG',{pixels:11_000_000}))).includes('doc-scanner'));
 for(const extra of [{pages:0},{pixels:NaN},{bytes:0}])assert.deepEqual(ids([file('PNG',extra)]),['open']);
 for(const extra of [{signed:true},{macros:true},{encrypted:true}])assert.deepEqual(ids([file('DOCX',extra)]),['open']);
 assert.ok(!ids([file('PDF',{signed:true})]).includes('compress-pdf'));
 const restricted=capabilities.map(item=>({...item,batch:false}));
 assert.deepEqual(ids([file('JPG'),file('PNG')],{capabilities:restricted}),['jpg-to-pdf','doc-scanner','open']);
});

test('asking for an output folder keeps selections preloaded and prevents unattended execution',()=>{
 const input=context([file('PNG')],{outputMode:'ask'}),menu=resolveNativeActions(input);
 assert.ok(menu.every(action=>!action.direct&&action.requiresUI));
 const request=resolveNativeActionRequest('compress-image',input);
 assert.deepEqual(request.options,{quality:85});assert.equal(request.tool,'compress-image');
 request.selection[0].format='PDF';assert.equal(input.files[0].format,'PNG');
});

test('normal app suggestions and native menu share the same compatibility decision',()=>{
 for(const files of [[file('JPG')],[file('HEIC')],[file('PDF'),file('PNG')],[file('PSD')]]){
  const native=quickActionMenu(files,true),app=relevantActions(files,true);
  assert.deepEqual(new Set(native.map(action=>action.tool||action.id)),new Set(app.map(action=>action.id)));
 }
 assert.equal(implementedNativeToolIds.length,22);
});

test('menu lookup bundles no heavy engine, Node runtime or network code',async()=>{
 const result=await build({entryPoints:['desktop/shared/native-actions.mjs'],bundle:true,write:false,platform:'browser',format:'esm',metafile:true});
 assert.deepEqual(Object.keys(result.metafile.inputs).sort(),['desktop/shared/native-actions.mjs','desktop/shared/tool-metadata.json','desktop/shared/tool-policy.mjs']);
 assert.ok(result.outputFiles[0].contents.length<25000);
});

test('real app form defaults and resolved direct actions publish identical image/PDF results through the licensed host',async()=>{
 const [{chromium},{default:sharp},{PDFDocument},{runProcessing},{processingFixture},{localFixture},fs,path]=await Promise.all([
  import('playwright'),import('sharp'),import('pdf-lib'),import('../native-host/processing-host.mjs'),import('./processing-fixture.mjs'),import('./local-fixture.mjs'),import('node:fs/promises'),import('node:path')]);
 const dir=await localFixture('sf-native-parity-');let browser;
 try{
  const bundle=await build({entryPoints:['desktop/ui/processing.ts'],bundle:true,write:false,format:'iife',globalName:'processing',platform:'browser'});
  browser=await chromium.launch({...process.env.SORA_BROWSER_EXECUTABLE?{executablePath:process.env.SORA_BROWSER_EXECUTABLE}:{channel:process.env.SORA_BROWSER_CHANNEL||'msedge'},headless:true});
  const page=await browser.newPage({viewport:{width:1180,height:900}});await page.setContent('<main></main>');await page.addScriptTag({content:bundle.outputFiles[0].text});
  const image=await sharp({create:{width:47,height:31,channels:4,background:{r:30,g:100,b:190,alpha:.4}}}).withMetadata().png().toBuffer();
  const doc=await PDFDocument.create();doc.addPage([345,567]).drawText('Parity receipt 00123');doc.setAuthor('Private author');
  const pdf=Buffer.from(await doc.save({useObjectStreams:false}));
  const pngPath=path.join(dir,'写真 with spaces.png'),pdfPath=path.join(dir,'Résumé original.pdf');await fs.writeFile(pngPath,image);await fs.writeFile(pdfPath,pdf);
  for(const [actionId,format,source,original] of [['convert-to-png','WebP',path.join(dir,'透明.webp'),null],['compress-image','PNG',pngPath,image],['metadata-remover','PNG',pngPath,image],['compress-pdf','PDF',pdfPath,pdf]]){
   if(!original)await fs.writeFile(source,await sharp(image).webp({lossless:true}).toBuffer());
   const before=await fs.readFile(source),request=resolveNativeActionRequest(actionId,context([file(format,{path:source,bytes:before.length})]));
   const appOptions=await page.evaluate(tool=>{document.querySelector('main').innerHTML=processing.processingOptions(tool);return processing.readProcessingOptions(document.querySelector('form'),tool);},request.tool);
   assert.deepEqual(request.options,appOptions,`${actionId} must use the app defaults`);
   const fixture=processingFixture(),base={...fixture,paths:[source],saveState:async()=>{}};
   const fromApp=await runProcessing({...base,tool:request.tool,options:appOptions});
   const fromMenu=await runProcessing({...base,tool:request.tool,options:request.options});
   assert.equal(fromApp.state,'completed');assert.equal(fromMenu.state,'completed');
   assert.equal(path.dirname(fromMenu.path),dir);assert.notEqual(fromMenu.path,fromApp.path);
   assert.match(path.basename(fromMenu.path),/\([1-9]\d*\)\.[a-z]+$/);
   const appBytes=await fs.readFile(fromApp.path),menuBytes=await fs.readFile(fromMenu.path);
   if(format==='PDF'){
    // qpdf deliberately creates a new document ID for each save. Everything
    // outside that bounded trailer field must match for identical settings.
    const normalized=bytes=>bytes.toString('latin1').replace(/\/ID\s*\[\s*<[0-9a-f]+>\s*<[0-9a-f]+>\s*\]/gi,'/ID [generated]');
    assert.deepEqual(normalized(appBytes),normalized(menuBytes),`${actionId} PDF content differs`);
   }else assert.deepEqual(appBytes,menuBytes,`${actionId} output differs`);
   assert.deepEqual(await fs.readFile(source),before);
   if(format!=='PDF'){
    const info=await sharp(await fs.readFile(fromMenu.path)).metadata();assert.equal(info.width,47);assert.equal(info.height,31);assert.equal(info.hasAlpha,true);
    if(actionId==='metadata-remover')assert.equal(info.exif,undefined);
   }else{const result=await PDFDocument.load(await fs.readFile(fromMenu.path));assert.equal(result.getPageCount(),1);assert.deepEqual(result.getPage(0).getSize(),{width:345,height:567});}
   fixture.state.license.entitlement+='tampered';const entries=await fs.readdir(dir);
   await assert.rejects(runProcessing({...base,tool:request.tool,options:request.options}),/license/);assert.deepEqual(await fs.readdir(dir),entries);
  }
  const secondDoc=await PDFDocument.create();secondDoc.addPage([500,400]).drawText('Second selected document');
  const secondPath=path.join(dir,'Second document.pdf');await fs.writeFile(secondPath,await secondDoc.save());
  // Interactive requests preload the selection and the ordinary form. Confirm
  // its accepted defaults preserve the chosen order through the same engine.
  const selection=[file('PDF',{path:secondPath}),file('PDF',{path:pdfPath})],merge=resolveNativeActionRequest('merge-pdf',context(selection));
  assert.equal(merge.requiresUI,true);assert.equal(merge.direct,false);
  const appOptions=await page.evaluate(()=>{document.querySelector('main').innerHTML=processing.processingOptions('merge-pdf');return processing.readProcessingOptions(document.querySelector('form'),'merge-pdf');});
  assert.deepEqual(appOptions,merge.options);
  const base={...processingFixture(),paths:merge.selection.map(file=>file.path),saveState:async()=>{}};
  const app=await runProcessing({...base,tool:'merge-pdf',options:appOptions}),menu=await runProcessing({...base,tool:merge.tool,options:merge.options});
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const inspect=async output=>{const task=getDocument({data:new Uint8Array(await fs.readFile(output)),useSystemFonts:true,isEvalSupported:false});try{const pdf=await task.promise,rows=[];for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);rows.push({view:page.view,text:(await page.getTextContent()).items.map(item=>item.str).join('')});}return rows;}finally{await task.destroy();}};
  const appPages=await inspect(app.path),menuPages=await inspect(menu.path);assert.deepEqual(menuPages,appPages);
  assert.deepEqual(menuPages,[{view:[0,0,500,400],text:'Second selected document'},{view:[0,0,345,567],text:'Parity receipt 00123'}]);
 }finally{await browser?.close();await fs.rm(dir,{recursive:true,force:true});}
});

test('resolved multi-file action keeps the existing host batch failures and output naming behavior',async()=>{
 const [{default:sharp},{runProcessing},{processingFixture},{localFixture},fs,path]=await Promise.all([
  import('sharp'),import('../native-host/processing-host.mjs'),import('./processing-fixture.mjs'),import('./local-fixture.mjs'),import('node:fs/promises'),import('node:path')]);
 const dir=await localFixture('sf-native-batch-parity-');
 try{
  const input=await sharp({create:{width:30,height:20,channels:3,background:'#334455'}}).jpeg().toBuffer();
  const paths=['one photo.jpg','invalid.jpg','写真.jpg'].map(name=>path.join(dir,name));
  for(const [i,p] of paths.entries())await fs.writeFile(p,i===1?Buffer.from('not an image'):input);
  // Classification may have happened before a file changes; the actual engine
  // must revalidate bytes and report the same failure from either entry point.
  const request=resolveNativeActionRequest('convert-to-png',context(paths.map(p=>file('JPG',{path:p}))));
  const base={...processingFixture(),paths,saveState:async()=>{}};
  const app=await runProcessing({...base,tool:'image-converter',options:{format:'png',quality:85}});
  const menu=await runProcessing({...base,tool:request.tool,options:request.options});
  assert.deepEqual(app.results.map(row=>row.state),['completed','failed','completed']);assert.deepEqual(menu.results.map(row=>row.state),app.results.map(row=>row.state));
  for(const i of [0,2]){assert.notEqual(menu.results[i].name,app.results[i].name);assert.deepEqual(await fs.readFile(path.join(dir,menu.results[i].name)),await fs.readFile(path.join(dir,app.results[i].name)));assert.deepEqual(await fs.readFile(paths[i]),input);}
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('direct image-to-PDF action publishes a real ordered PDF through the licensed host',async()=>{
 const [{default:sharp},{PDFDocument},{runProcessing},{rasterPdf},{processingFixture},{localFixture},fs,path]=await Promise.all([
  import('sharp'),import('pdf-lib'),import('../native-host/processing-host.mjs'),import('../core/pdf-raster.mjs'),import('./processing-fixture.mjs'),import('./local-fixture.mjs'),import('node:fs/promises'),import('node:path')]);
 const dir=await localFixture('sf-native-direct-pdf-');
 try{
  const originals=[await sharp({create:{width:20,height:40,channels:3,background:'#ff0000'}}).png().toBuffer(),await sharp({create:{width:40,height:20,channels:3,background:'#0000ff'}}).png().toBuffer()];
  const paths=[path.join(dir,'first portrait.png'),path.join(dir,'second landscape.png')];
  for(const [index,source] of paths.entries())await fs.writeFile(source,originals[index]);
  const request=resolveNativeActionRequest('jpg-to-pdf',context(paths.map((source,index)=>file('PNG',{path:source,bytes:originals[index].length}))));
  assert.equal(request.direct,true);assert.equal(request.requiresUI,false);assert.deepEqual(request.options,{paper:'a4',orientation:'auto'});
  const fixture=processingFixture(),run=()=>runProcessing({...fixture,tool:request.tool,paths:request.selection.map(item=>item.path),options:request.options,saveState:async()=>{}});
  const result=await run();assert.equal(result.state,'completed');assert.equal(path.dirname(result.path),dir);
  const bytes=await fs.readFile(result.path),pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),2);
  const pages=pdf.getPages();assert.ok(pages[0].getWidth()<pages[0].getHeight());assert.ok(pages[1].getWidth()>pages[1].getHeight());
  const rendered=await rasterPdf(new Uint8Array(bytes),{dpi:72,format:'png'});
  for(const [index,page] of rendered.entries()){
   const pixel=await sharp(page.bytes).extract({left:Math.floor(page.width/2),top:Math.floor(page.height/2),width:1,height:1}).removeAlpha().raw().toBuffer();
   assert.deepEqual([...pixel],index?[0,0,255]:[255,0,0]);assert.deepEqual(await fs.readFile(paths[index]),originals[index]);
  }
  assert.notEqual((await run()).path,result.path);
  fixture.state.license.entitlement+='tampered';const entries=await fs.readdir(dir);await assert.rejects(run(),/license/);assert.deepEqual(await fs.readdir(dir),entries);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
