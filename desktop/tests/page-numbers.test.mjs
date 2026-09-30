import test from 'node:test';import assert from 'node:assert/strict';
import {PDFDocument,degrees} from 'pdf-lib';import {getDocument,Util} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {numberPdfPages} from '../core/pdf.mjs';
async function source(){const doc=await PDFDocument.create();for(const angle of [0,90,180,270]){const page=doc.addPage([500,700]);page.setCropBox(20,30,450,630);page.setRotation(degrees(angle));}return doc.save();}
async function inspect(bytes,run){const task=getDocument({data:bytes.slice(),useSystemFonts:true,isEvalSupported:false});try{await run(await task.promise);}finally{await task.destroy();}}
test('numbered text stays horizontal in the visible margins at all four page rotations',async()=>{
 const input=await source();
 for(const position of ['bottom-left','bottom-center','bottom-right','top-left','top-center','top-right']){
  const result=await numberPdfPages(input,{position,format:'total',start:7});
  await inspect(result.bytes,async doc=>{assert.equal(doc.numPages,4);for(let i=1;i<=4;i++){
   const page=await doc.getPage(i),viewport=page.getViewport({scale:1}),content=await page.getTextContent();
   const text=content.items.find(item=>item.str===`Page ${i+6} of 10`);assert.ok(text,`missing label at ${position}/${i}`);
   const matrix=Util.transform(viewport.transform,text.transform),x=matrix[4],y=matrix[5];
   assert.ok(matrix[0]>0&&Math.abs(matrix[1])<.01,'text reads horizontally');
   assert.ok(x>=23.5&&x+text.width<=viewport.width-23.5);
   assert.ok(position.startsWith('top')?y<40:y>viewport.height-40);
   // PDF.js and pdf-lib differ slightly in standard-font kerning metrics.
   if(position.endsWith('center'))assert.ok(Math.abs(x+text.width/2-viewport.width/2)<.5,JSON.stringify({position,i,x,textWidth:text.width,viewport:viewport.width}));
  }});
 }
});
test('selected pages number consecutively and skip leaves earlier pages untouched',async()=>{
 const result=await numberPdfPages(await source(),{selected:[3,0,2],skip:1,start:9,format:'roman'});
 assert.equal(result.numbered,2);
 await inspect(result.bytes,async doc=>{const labels=[];for(let i=1;i<=4;i++)labels.push((await (await doc.getPage(i)).getTextContent()).items.map(item=>item.str).filter(Boolean).join(''));assert.deepEqual(labels,['','','IX','X']);});
});
test('invalid options, out-of-page labels and cancelled jobs produce no output',async()=>{
 const input=await source();
 for(const options of [{start:0},{start:999999},{format:'roman',start:3999},{selected:[]},{skip:4},{size:Infinity},{position:'elsewhere'},{color:'red'},{selected:[10]},{margin:144,size:72,format:'total'}])await assert.rejects(numberPdfPages(input,options));
 const controller=new AbortController();await assert.rejects(numberPdfPages(input,{signal:controller.signal,onProgress:()=>controller.abort()}),{name:'AbortError'});
});
