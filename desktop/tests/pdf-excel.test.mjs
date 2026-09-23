import test from 'node:test';import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';import * as XLSX from 'xlsx';import {unzipSync,strFromU8} from 'fflate';
import {pdfToExcel} from '../core/pdf-excel.mjs';import {protectPdf} from '../core/protect-pdf.mjs';
async function fixture({blank=false}={}){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),page=doc.addPage([600,800]);
 if(!blank){const rows=[['ID','Description','Amount'],['00123','=1+1','$1,250.50'],['00456','@SUM(A1)','25%']];
  rows.forEach((row,index)=>row.forEach((text,column)=>page.drawText(text,{x:[40,200,400][column],y:700-index*25,font,size:12})));
  doc.addPage();
 }
 return doc.save();
}
test('PDF tables produce editable XLSX text cells without formulas or identifier conversion',async()=>{
 const result=await pdfToExcel(await fixture()),workbook=XLSX.read(result.bytes,{type:'array'});assert.deepEqual(workbook.SheetNames,['P1 Table 1']);
 assert.deepEqual(XLSX.utils.sheet_to_json(workbook.Sheets['P1 Table 1'],{header:1}),[['ID','Description','Amount'],['00123','=1+1','$1,250.50'],['00456','@SUM(A1)','25%']]);
 // Inspect the ZIP/XML output separately from the producing library's model.
 const archive=unzipSync(result.bytes),xml=strFromU8(archive['xl/worksheets/sheet1.xml']);
 assert.doesNotMatch(xml,/<f[\s>]|<hyperlink[\s>]/);assert.match(xml,/00123/);assert.match(xml,/=1\+1/);
 assert.equal(Object.keys(archive).some(path=>/vbaProject|externalLinks/i.test(path)),false);
 assert.match(result.warnings[0],/1 page\(s\).*skipped/);
});
test('table extraction refuses scanned/blank, malformed, encrypted and over-budget PDFs and cancellation',async()=>{
 await assert.rejects(pdfToExcel(await fixture({blank:true})),/selectable text/);
 await assert.rejects(pdfToExcel(Buffer.from('%PDF-malformed')));
 const bytes=await fixture(),encrypted=await protectPdf(bytes,{password:'Synthetic-password'});await assert.rejects(pdfToExcel(encrypted.bytes),/unencrypted/);
 const tooMany=await PDFDocument.create();for(let i=0;i<101;i++)tooMany.addPage([100,100]);await assert.rejects(pdfToExcel(await tooMany.save()),/100 pages/);
 await assert.rejects(pdfToExcel(bytes,{signal:AbortSignal.abort()}),{name:'AbortError'});
 const controller=new AbortController(),pending=pdfToExcel(bytes,{signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});
});
