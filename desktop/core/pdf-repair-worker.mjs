import {PDFDocument} from 'pdf-lib';import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {rejectPdfSignatures} from './pdf-safety.mjs';
process.once('message',async({bytes})=>{
 let before,after;
 try{
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>64*1024*1024)throw Error();
  const source=await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false,throwOnInvalidObject:true});
  const count=source.getPageCount();if(count<1||count>100)throw Error();rejectPdfSignatures(source);
  const options={verbosity:0,isEvalSupported:false,useSystemFonts:false,disableFontFace:true,stopAtErrors:true};
  before=getDocument({...options,data:Uint8Array.from(bytes)});const input=await before.promise;if(input.numPages!==count)throw Error();
  const output=await source.save({useObjectStreams:true,addDefaultPage:false,updateFieldAppearances:false});if(!output.length||output.length>64*1024*1024)throw Error();
  after=getDocument({...options,data:output.slice()});const check=await after.promise;if(check.numPages!==count)throw Error();
  let operators=0,characters=0;
  for(let number=1;number<=count;number++){
   const a=await input.getPage(number),b=await check.getPage(number);
   try{
    if(JSON.stringify(a.view)!==JSON.stringify(b.view)||a.rotate!==b.rotate)throw Error();
    const sourceText=await a.getTextContent(),savedText=await b.getTextContent();
    const strings=items=>items.filter(item=>'str' in item).map(item=>({text:item.str,transform:item.transform}));
    const text=strings(sourceText.items);characters+=text.reduce((sum,item)=>sum+item.text.length,0);
    if(characters>4_000_000||JSON.stringify(text)!==JSON.stringify(strings(savedText.items)))throw Error();
    const first=await a.getOperatorList(),second=await b.getOperatorList();operators+=first.fnArray.length;
    if(operators>1_000_000||JSON.stringify(first.fnArray)!==JSON.stringify(second.fnArray))throw Error();
   }finally{a.cleanup();b.cleanup();}
  }
  await before.destroy();before=null;await after.destroy();after=null;process.send({ok:true,bytes:output},()=>process.exit(0));
 }catch{if(before)await before.destroy().catch(()=>{});if(after)await after.destroy().catch(()=>{});process.send({ok:false},()=>process.exit(1));}
});
process.once('disconnect',()=>process.exit(1));
