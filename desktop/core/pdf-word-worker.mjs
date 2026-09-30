import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';import {PDFDocument} from 'pdf-lib';
import {Document,Paragraph,TextRun,Packer} from 'docx';import {unzipSync,strFromU8} from 'fflate';
import {groupTextItems} from '../shared/pdf-text.mjs';
process.once('message',async({bytes,direction})=>{
 let task;
 try{
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>64*1024*1024||!['ltr','rtl'].includes(direction))throw Error();
  await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false});
  task=getDocument({data:bytes.slice(),verbosity:0,isEvalSupported:false,useSystemFonts:false,stopAtErrors:true,disableFontFace:true});
  const source=await task.promise;if(source.numPages<1||source.numPages>60)throw Error();
  const children=[];let totalItems=0,characters=0;
  for(let pageNumber=1;pageNumber<=source.numPages;pageNumber++){
   const page=await source.getPage(pageNumber);
   try{
    const items=(await page.getTextContent()).items.filter(item=>'str' in item);totalItems+=items.length;
    if(items.length>10000||totalItems>100000)throw Error();
    for(const item of items){characters+=item.str.length;if(item.str.length>32767||characters>4_000_000||!item.transform?.every(Number.isFinite))throw Error();}
    const lines=groupTextItems(items);
    // Never silently drop a scanned/blank page from a mixed document.
    if(!lines.some(line=>line.trim()))throw Error();
    for(const [index,line] of lines.entries())children.push(new Paragraph({pageBreakBefore:pageNumber>1&&index===0,bidirectional:direction==='rtl',children:[new TextRun({text:line,rightToLeft:direction==='rtl'})]}));
   }finally{page.cleanup();}
  }
  const output=await Packer.toBuffer(new Document({creator:'SoraFiles',title:'',description:'',sections:[{children}]}));
  if(!output.length||output.length>64*1024*1024)throw Error();
  const archive=unzipSync(output),xml=archive['word/document.xml'];
  if(!xml||!strFromU8(xml).includes('<w:document')||Object.keys(archive).some(name=>/vbaProject|embeddings\//i.test(name)))throw Error();
  const pages=source.numPages;await task.destroy();task=null;
  process.send({ok:true,bytes:output,pages},()=>process.exit(0));
 }catch{if(task)await task.destroy().catch(()=>{});process.send({ok:false},()=>process.exit(1));}
});
process.once('disconnect',()=>process.exit(1));
