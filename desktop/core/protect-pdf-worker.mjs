import {encryptPDF,encodePasswordAES256} from '@pdfsmaller/pdf-encrypt';
import {PDFDocument,PDFName,PDFNumber} from 'pdf-lib';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
// This component only accepts unencrypted source PDFs and returns encrypted
// bytes. Reading its own encrypted result verifies protection; it cannot export
// an unprotected copy of an existing encrypted input.
process.once('message',async({bytes,password})=>{
 try{
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>256*1024*1024||typeof password!=='string'||!password.trim()||/[\u0000-\u001f\u007f]/u.test(password)||Buffer.byteLength(password.normalize('NFKC'))>127)throw Error();
  encodePasswordAES256(password);
  const source=await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false}),pages=source.getPageCount();if(pages<1||pages>1000)throw Error();
  const encrypted=await encryptPDF(bytes,password,{algorithm:'AES-256'});
  if(!encrypted.length||encrypted.length>256*1024*1024)throw Error();
  const parsed=await PDFDocument.load(encrypted,{ignoreEncryption:true,updateMetadata:false});
  const encryption=parsed.context.lookup(parsed.context.trailerInfo.Encrypt);
  if(!parsed.isEncrypted||encryption.lookup(PDFName.of('V'),PDFNumber).asNumber()!==5||encryption.lookup(PDFName.of('R'),PDFNumber).asNumber()!==6||encryption.lookup(PDFName.of('Length'),PDFNumber).asNumber()!==256)throw Error();
  for(const supplied of [undefined,password]){
   const task=getDocument({data:encrypted.slice(),password:supplied,verbosity:0,isEvalSupported:false,useSystemFonts:false,stopAtErrors:true});
   try{const doc=await task.promise;if(supplied===undefined||doc.numPages!==pages)throw Error('Protection validation failed');for(let page=1;page<=pages;page++)await doc.getPage(page);}
   catch(error){if(supplied!==undefined||error.name!=='PasswordException')throw error;}
   finally{await task.destroy();}
  }
  process.send({ok:true,bytes:encrypted,pages},()=>process.exit(0));
 }catch{process.send({ok:false},()=>process.exit(1));}
});
process.once('disconnect',()=>process.exit(1));
