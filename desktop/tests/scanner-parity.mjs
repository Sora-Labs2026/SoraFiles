// Browser executes the actual Web filter source. Compare its pixels with the
// final Desktop PDF render from identical opaque sRGB input, not just two ports.
import {chromium} from 'playwright';import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';
import {readFile,writeFile,mkdir} from 'node:fs/promises';import assert from 'node:assert/strict';import sharp from 'sharp';
import {scanDocuments} from '../core/scanner.mjs';import {rasterPdf} from '../core/pdf-raster.mjs';
const source=await readFile('src/lib/image/scan-filters.ts','utf8'),compiled=transpileModule(source,{compilerOptions:{module:ModuleKind.ES2022,target:ScriptTarget.ES2022}}).outputText;
const browser=await chromium.launch({...(process.env.SORA_BROWSER_EXECUTABLE?{executablePath:process.env.SORA_BROWSER_EXECUTABLE}:{channel:process.env.SORA_BROWSER_CHANNEL||'msedge'}),headless:true});
const width=240,height=180,pixels=Buffer.alloc(width*height*4);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const at=(y*width+x)*4,mark=x>20&&x<200&&y>30&&y<150&&y%24<4;
 pixels[at]=mark?35:190+Math.round(x/5);pixels[at+1]=mark?25:190+Math.round(x/6);pixels[at+2]=mark?20:180+Math.round(x/7);pixels[at+3]=255;
}
const input=await sharp(pixels,{raw:{width,height,channels:4}}).png().toBuffer(),results=[];
try{
 const page=await browser.newPage();await page.route('**/*',route=>route.abort());
 await page.evaluate(async code=>{const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));try{window.scanFilter=(await import(url)).applyScanFilter;}finally{URL.revokeObjectURL(url);}},compiled);
 for(const filter of ['original','enhanced','color','grayscale','bw','contrast','receipt']){
  const web=await page.evaluate(({rgba,width,height,filter})=>Array.from(window.scanFilter(new ImageData(new Uint8ClampedArray(rgba),width,height),filter).data),{rgba:[...pixels],width,height,filter});
  const result=await scanDocuments([input],{filter,paper:'image'}),[rendered]=await rasterPdf(result.bytes,{dpi:150,format:'png'});
  const desktop=await sharp(rendered.bytes).extract({left:0,top:0,width,height}).ensureAlpha().raw().toBuffer();let error=0,maximum=0;
  for(let i=0;i<web.length;i++){const delta=Math.abs(web[i]-desktop[i]);error+=delta;maximum=Math.max(maximum,delta);}
  const mae=error/web.length;assert.ok(mae<1,filter+' changed browser filter pixels');results.push({filter,mae,maxChannelDifference:maximum});
 }
 await mkdir('.artifacts/parity',{recursive:true});const report={status:'PASS',scope:'Actual Web filter pixels versus decoded Desktop PDF; opaque sRGB fixture, full image, 150 DPI, seven filters. No camera/perspective/format/platform parity claim.',results};await writeFile('.artifacts/parity/scanner-filters.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
