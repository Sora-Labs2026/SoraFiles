import {chromium} from 'playwright';import sharp from 'sharp';import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {removeMetadata} from '../core/metadata.mjs';
const browser=await chromium.launch({...(process.env.SORA_BROWSER_EXECUTABLE?{executablePath:process.env.SORA_BROWSER_EXECUTABLE}:{channel:process.env.SORA_BROWSER_CHANNEL||'msedge'}),headless:true});
try{
 const page=await browser.newPage();await page.route('**/*',route=>route.abort());
 await page.evaluate(async source=>{const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));try{window.strip=(await import(url)).stripImageMeta;}finally{URL.revokeObjectURL(url);}},await readFile('src/lib/metadata-strip.js','utf8'));
 const width=96,height=64,pixels=Buffer.alloc(width*height*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=i%251;pixels[i+1]=(i*7)%256;pixels[i+2]=(i*13)%256;pixels[i+3]=64+(i%192);}
 const results=[];
 for(const format of ['jpeg','png','webp']){
  const input=await sharp(pixels,{raw:{width,height,channels:4}}).withExif({IFD0:{Artist:'Synthetic metadata fixture',ImageDescription:'Project-generated test pixels'}})[format]().toBuffer();
  const web=Buffer.from(await page.evaluate(async bytes=>[...new Uint8Array(await(await window.strip(new Blob([new Uint8Array(bytes)]))).blob.arrayBuffer())],[...input]));
  const desktop=await removeMetadata(input);assert.deepEqual(Buffer.from(desktop.bytes),web);assert.match(desktop.warnings[0],/without re-encoding/);
  const decoded=await sharp(desktop.bytes).ensureAlpha().raw().toBuffer(),original=await sharp(input).ensureAlpha().raw().toBuffer();assert.deepEqual(decoded,original);
  results.push({format,inputBytes:input.length,outputBytes:web.length,webDesktopBytesEqual:true,maxDecodedDifference:0,fixtureSha256:createHash('sha256').update(input).digest('hex')});
 }
 const report={recordedAt:new Date().toISOString(),status:'PASS',scope:'Actual Web stripImageMeta executed in Chrome versus Desktop output, project-generated sRGB JPEG/PNG/WebP without ICC or orientation transforms. Exact output bytes and decoded pixel preservation including alpha; no Office/animated/profile parity claim.',results};
 await mkdir('.artifacts/parity',{recursive:true});await writeFile('.artifacts/parity/metadata.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
