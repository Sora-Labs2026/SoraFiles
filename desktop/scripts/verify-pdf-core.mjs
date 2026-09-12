import {readFile,mkdir,writeFile} from 'node:fs/promises';import {mergePdf,rotatePdf,removePdfPages,splitPdf} from '../core/pdf.mjs';
const root='.artifacts/desktop-pdf-core';await mkdir(root,{recursive:true});const input=new Uint8Array(await readFile('.artifacts/astra-complex/mixed-36.pdf'));
await writeFile(root+'/merged.pdf',(await mergePdf([input,input])).bytes);
await writeFile(root+'/rotated.pdf',(await rotatePdf(input,{rotations:[{pageIndex:0,angle:90},{pageIndex:1,angle:180},{pageIndex:35,angle:-90}]})).bytes);
await writeFile(root+'/removed.pdf',(await removePdfPages(input,{remove:[0,2,35]})).bytes);
for(const [i,result] of (await splitPdf(input,{mode:'every',every:7})).entries())await writeFile(root+'/split-'+i+'.pdf',result.bytes);
console.log('Generated synthetic complex outputs for independent validation');
