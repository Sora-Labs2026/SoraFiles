import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';import {PDFDocument} from 'pdf-lib';import * as XLSX from 'xlsx';
import {extractTablesFromTextItems} from '../shared/pdf-tables.mjs';
process.once('message',async({bytes})=>{
 let task;
 try{
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>64*1024*1024)throw Error();
  // Refuse all encrypted input, including owner-password-only PDFs.
  await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false});
  task=getDocument({data:bytes.slice(),verbosity:0,isEvalSupported:false,useSystemFonts:false,stopAtErrors:true,disableFontFace:true});
  const doc=await task.promise;if(doc.numPages<1||doc.numPages>100)throw Error();
  const workbook=XLSX.utils.book_new(),expected=[];let skipped=0,totalItems=0,cells=0,characters=0;
  for(let pageNumber=1;pageNumber<=doc.numPages;pageNumber++){
   const page=await doc.getPage(pageNumber);
   try{
    const items=(await page.getTextContent()).items.filter(item=>'str' in item);totalItems+=items.length;
    if(items.length>10000||totalItems>100000)throw Error();
    for(const item of items){characters+=item.str.length;if(item.str.length>32767||characters>4_000_000||!item.transform?.every(Number.isFinite))throw Error();}
    const tables=extractTablesFromTextItems(items,{preserveText:true});if(!tables.length)skipped++;
    for(const [index,table] of tables.entries()){
     cells+=table.rows.reduce((sum,row)=>sum+row.length,0);if(cells>100000||expected.length>=100)throw Error();
     if(table.rows.some(row=>row.some(value=>typeof value!=='string'||value.length>32767)))throw Error();
     const sheet=XLSX.utils.aoa_to_sheet(table.rows);
     // Every cell is text, including leading =, +, - and @ characters. Never
     // infer formulas, hyperlinks, dates, currencies or numeric identifiers.
     for(const [address,cell] of Object.entries(sheet))if(!address.startsWith('!')&&(cell.t!=='s'||cell.f||cell.l))throw Error();
     sheet['!cols']=Array.from({length:table.columnCount},(_,column)=>({wch:Math.min(48,Math.max(10,...table.rows.map(row=>(row[column]||'').length+2)))}));
     const name=`P${pageNumber} Table ${index+1}`;XLSX.utils.book_append_sheet(workbook,sheet,name);expected.push({name,rows:table.rows});
    }
   }finally{page.cleanup();}
  }
  if(!expected.length)throw Error();
  const output=XLSX.write(workbook,{type:'buffer',bookType:'xlsx',compression:true});if(!output.length||output.length>64*1024*1024)throw Error();
  const check=XLSX.read(output,{type:'buffer',cellFormula:true});if(check.SheetNames.length!==expected.length)throw Error();
  for(const entry of expected){const sheet=check.Sheets[entry.name];if(JSON.stringify(XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:''}))!==JSON.stringify(entry.rows))throw Error();for(const [address,cell] of Object.entries(sheet))if(!address.startsWith('!')&&(cell.t!=='s'||cell.f||cell.l))throw Error();}
  await task.destroy();task=null;process.send({ok:true,bytes:output,tables:expected.length,skipped},()=>process.exit(0));
 }catch{if(task)await task.destroy().catch(()=>{});process.send({ok:false},()=>process.exit(1));}
});
process.once('disconnect',()=>process.exit(1));
