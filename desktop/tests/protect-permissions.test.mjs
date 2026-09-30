import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,PDFName,PDFNumber} from 'pdf-lib';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {protectPdf,protectionOptions} from '../core/protect-pdf.mjs';

const fixture=async()=>{const doc=await PDFDocument.create();doc.addPage([300,400]).drawText('Contract 7',{x:30,y:300,size:14});return doc.save();};
const flags=async bytes=>{const doc=await PDFDocument.load(bytes,{ignoreEncryption:true});return doc.context.lookup(doc.context.trailerInfo.Encrypt).lookup(PDFName.of('P'),PDFNumber).asNumber();};
const permissions=async(bytes,password)=>{const task=getDocument({data:bytes.slice(),password,verbosity:0});try{return await (await task.promise).getPermissions();}finally{await task.destroy();}};

test('restrictions need a separate permissions password',()=>{
 assert.throws(()=>protectionOptions({password:'open-pass',allowPrinting:false}),/permissions password/);
 assert.throws(()=>protectionOptions({password:'open-pass',ownerPassword:'open-pass',allowCopying:false}),/different/);
 assert.throws(()=>protectionOptions({password:'open-pass',allowModifying:'no'}),/permissions/);
 assert.deepEqual(protectionOptions({password:'open-pass'}),{password:'open-pass',ownerPassword:undefined,allowPrinting:true,allowCopying:true,allowModifying:true});
});

test('chosen restrictions are saved in the PDF and both passwords open it',async()=>{
 const input=await fixture();
 const open=await protectPdf(input,{password:'open-pass'});
 assert.equal((await flags(open.bytes))&(4|8|16),4|8|16,'no restrictions by default');
 const locked=await protectPdf(input,{password:'open-pass',ownerPassword:'owner-pass',allowPrinting:false,allowCopying:false,allowModifying:true});
 const p=await flags(locked.bytes);
 assert.deepEqual([Boolean(p&4),Boolean(p&16),Boolean(p&8)],[false,false,true]);
 const viewer=await permissions(locked.bytes,'open-pass');
 assert.ok(Array.isArray(viewer)&&!viewer.includes(4)&&!viewer.includes(16),'a viewer opening with the open password is restricted');
 const ownerTask=getDocument({data:locked.bytes.slice(),password:'owner-pass',verbosity:0});try{assert.equal((await ownerTask.promise).numPages,1,'the permissions password also opens the PDF');}finally{await ownerTask.destroy();}
 await assert.rejects(protectPdf(input,{password:'open-pass',allowPrinting:false}),/permissions password/);
});
