import {chromium} from 'playwright';import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';
import {readFile,writeFile,mkdir} from 'node:fs/promises';import assert from 'node:assert/strict';import sharp from 'sharp';
import {processImage} from '../core/images.mjs';import {manualAdjustmentKeys} from '../shared/image-adjustments.mjs';
const compiled=transpileModule(await readFile('src/lib/image/manual-adjustments.ts','utf8'),{compilerOptions:{module:ModuleKind.ES2022,target:ScriptTarget.ES2022}}).outputText;
const width=120,height=80,raw=Buffer.alloc(width*height*4);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;raw[i]=(x*7+y*3)%256;raw[i+1]=(x*2+y*11)%256;raw[i+2]=(x*3+y*5)%256;raw[i+3]=[0,64,128,255][x%4];}
const input=await sharp(raw,{raw:{width,height,channels:4}}).png().toBuffer();
const browser=await chromium.launch({...(process.env.SORA_BROWSER_EXECUTABLE?{executablePath:process.env.SORA_BROWSER_EXECUTABLE}:{channel:process.env.SORA_BROWSER_CHANNEL||'msedge'}),headless:true}),results=[];
try{
 const page=await browser.newPage();await page.route('**/*',route=>route.abort());
 await page.evaluate(async code=>{const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));try{window.adjust=(await import(url)).applyManualAdjustments;}finally{URL.revokeObjectURL(url);}},compiled);
 const cases=[{},...manualAdjustmentKeys.map(key=>({[key]:55})),{exposure:-25,highlights:-40,shadows:35,contrast:15,brightness:-10,blackPoint:20,definition:45,sharpness:30,noiseReduction:25,saturation:-60}];
 for(const adjustments of cases){
  const expected=await page.evaluate(({raw,width,height,adjustments})=>[...window.adjust(new ImageData(new Uint8ClampedArray(raw),width,height),adjustments).data],{raw:[...raw],width,height,adjustments});
  const result=await processImage(input,{action:'edit',format:'png',adjustments}),actual=await sharp(result.bytes).ensureAlpha().raw().toBuffer();
  let sum=0,max=0;for(let i=0;i<actual.length;i++){const delta=Math.abs(actual[i]-expected[i]);sum+=delta;max=Math.max(max,delta);if(i%4===3)assert.equal(actual[i],raw[i]);}
  assert.equal(actual.length,expected.length);assert.equal(max,0,JSON.stringify(adjustments));results.push({adjustments,mae:sum/actual.length,maxDifference:max});
 }
 await mkdir('.artifacts/parity',{recursive:true});const report={status:'PASS',scope:'Actual browser adjustment source versus decoded Desktop PNG, synthetic varied sRGB pixels with transparency, all ten controls and a combined negative/positive case. No resampling, colour-profile, live-preview or full image-editor parity claim.',results};
 await writeFile('.artifacts/parity/image-adjustments.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
