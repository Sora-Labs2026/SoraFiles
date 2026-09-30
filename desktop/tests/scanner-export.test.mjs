import test from 'node:test';import assert from 'node:assert/strict';
import sharp from 'sharp';import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';import {unzipSync} from 'fflate';
import {runProcessing} from '../native-host/processing-host.mjs';import {processingFixture} from './processing-fixture.mjs';
import {localFixture} from './local-fixture.mjs';import {join,extname} from 'node:path';import {readFile,writeFile,rm} from 'node:fs/promises';
import {scanExport} from '../core/scanner-jobs.mjs';

const page=(text,background='#ffffff')=>sharp(Buffer.from(`<svg width="900" height="300"><rect width="900" height="300" fill="${background}"/><text x="40" y="170" font-family="Arial" font-size="72" fill="#111111">${text}</text></svg>`)).png().toBuffer();
const scan=async(dir,options,count=2)=>{
 const paths=[];for(let i=0;i<count;i++){const path=join(dir,`page${i+1}.png`);await writeFile(path,await page(i?'RECEIPT 2026':'INVOICE 4827'));paths.push(path);}
 const result=await runProcessing({...processingFixture(),tool:'doc-scanner',paths,options:{filter:'original',paper:'image',rotation:0,...options},saveState:async()=>{}});
 assert.equal(result.state,'completed');return result;
};

test('scanner export options are validated like the website',()=>{
 assert.deepEqual(scanExport({}),{format:'pdf',searchable:false,language:'eng'});
 for(const bad of [{format:'gif'},{format:'jpg',searchable:true},{searchable:'yes'},{searchable:true,language:'xx'}])assert.throws(()=>scanExport(bad),/valid scan options/);
});

test('scans export as images: one page as an image, several pages as a ZIP',async()=>{
 const dir=await localFixture('sf-scan-export-');try{
  const single=await scan(dir,{format:'png'},1);assert.equal(extname(single.path),'.png');
  assert.equal((await sharp(await readFile(single.path)).metadata()).format,'png');
  const many=await scan(dir,{format:'jpg'},2);assert.equal(extname(many.path),'.zip');
  const entries=unzipSync(await readFile(many.path));assert.deepEqual(Object.keys(entries).sort(),['scan-01.jpg','scan-02.jpg']);
  assert.equal((await sharp(Buffer.from(entries['scan-02.jpg'])).metadata()).format,'jpeg');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('a searchable scan is a PDF whose text can be found',async()=>{
 const dir=await localFixture('sf-scan-ocr-');try{
  const result=await scan(dir,{format:'pdf',searchable:true,language:'eng'},2);assert.equal(extname(result.path),'.pdf');
  const task=getDocument({data:Uint8Array.from(await readFile(result.path)),verbosity:0,isEvalSupported:false});
  try{const pdf=await task.promise;assert.equal(pdf.numPages,2);
   const text=[];for(let n=1;n<=2;n++)text.push((await (await pdf.getPage(n)).getTextContent()).items.map(item=>item.str).join(' '));
   assert.match(text[0],/INVOICE\s*4827/i);assert.match(text[1],/RECEIPT\s*2026/i);
  }finally{await task.destroy();}
 }finally{await rm(dir,{recursive:true,force:true});}
});
