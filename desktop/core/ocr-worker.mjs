import {createWorker} from 'tesseract.js';import {PDFDocument} from 'pdf-lib';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {ocrOptions} from '../shared/ocr-options.mjs';
process.once('message',async({pages,options})=>{
 let worker;
 try{
  const {language,format}=ocrOptions(options);let assets;
  for(const location of ['../../assets/ocr/','../../public/ocr/']){const candidate=new URL(location,import.meta.url);try{await readFile(new URL('manifest.json',candidate));assets=candidate;break;}catch{}}
  if(!assets)throw Error('Language files unavailable');
  const manifest=JSON.parse(await readFile(new URL('manifest.json',assets),'utf8')),name='lang/'+language+'.traineddata.gz';
  const expected=manifest.files.find(file=>file.path===name),model=await readFile(new URL(name,assets));
  if(!expected||model.length!==expected.bytes||createHash('sha256').update(model).digest('hex')!==expected.sha256)throw Error('Language files damaged');
  worker=await createWorker(language,1,{langPath:fileURLToPath(new URL('lang/',assets)),cacheMethod:'none',gzip:true,logger:()=>{},errorHandler:()=>{}});
  await worker.setParameters({user_defined_dpi:'150'});
  let text='',confidence=100,total=0;const combined=format==='pdf'?await PDFDocument.create():null;
  for(const [index,page] of pages.entries()){
   const {data}=await worker.recognize(page.bytes,{pdfTitle:'SoraFiles OCR',pdfTextOnly:false},{text:true,pdf:format==='pdf'});
   text+=(index?'\n\f\n':'')+data.text;confidence=Math.min(confidence,data.confidence);total+=Buffer.byteLength(data.text);
   if(total>8*1024*1024)throw Error('Text output too large');
   if(combined){const doc=await PDFDocument.load(data.pdf,{updateMetadata:false});if(doc.getPageCount()!==1)throw Error('Invalid OCR page');const [copy]=await combined.copyPages(doc,[0]);combined.addPage(copy);}
  }
  const bytes=combined?await combined.save():Buffer.from(text||'No text was recognized.\n');
  if(bytes.length>256*1024*1024)throw Error('Output too large');
  await worker.terminate();worker=null;
  process.send({ok:true,bytes,confidence,pages:pages.length,empty:!text.trim()},()=>process.exit(0));
 }catch{if(worker)await worker.terminate().catch(()=>{});process.send({ok:false},()=>process.exit(1));}
});
process.once('disconnect',()=>process.exit(1));
