import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';
import {processImage} from '../core/images.mjs';import {imageOptions} from '../core/image-options.mjs';import {fitToBytes} from '../shared/fit-bytes.mjs';

// A detailed photo-like source so quality and size both matter.
async function photo(width=1600,height=1000){
 const raw=Buffer.alloc(width*height*3);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*3,n=(x*7919+y*104729)%251;raw[i]=(x*255/width+n)&255;raw[i+1]=(y*255/height+n*3)&255;raw[i+2]=(x+y+n*5)&255;}
 return sharp(raw,{raw:{width,height,channels:3}}).jpeg({quality:95}).toBuffer();
}

test('fitting lowers quality first, then pixels, and stays close to the largest size that fits',async()=>{
 const encodeAt=async(w,h,q)=>Buffer.alloc(Math.round(w*h*(.05+q/200)));
 const easy=await fitToBytes({width:1000,height:500},encodeAt,500_000);assert.ok(easy.fits&&!easy.scaled&&easy.quality===90);
 const quality=await fitToBytes({width:1000,height:500},encodeAt,150_000);assert.ok(quality.fits&&!quality.scaled&&quality.quality<90&&quality.quality>=40);
 const steep=async(w,h)=>Buffer.alloc(Math.round(1500+(w*h)**1.6/2e6));
 const flat=await fitToBytes({width:3200,height:1800},steep,Math.round(1500+1e6**1.6/2e6),{lossy:false});
 assert.ok(flat.fits&&flat.scaled&&flat.width<=1334&&flat.width>=1200,`width ${flat.width}`);
 assert.equal((await fitToBytes({width:100,height:100},encodeAt,10)).fits,false);
});

test('a JPG resize under 50 KB keeps its pixels when quality is enough, and tags the print resolution',async()=>{
 // Passport photo at 300 DPI: 35 × 45 mm → 413 × 531 px. The source carries private EXIF.
 const source=await sharp(await photo()).withExif({IFD0:{Make:'SecretCam',Artist:'Jane Private'}}).jpeg({quality:95}).toBuffer();
 const result=await processImage(source,{action:'resize',format:'jpeg',quality:90,width:413,height:531,fit:'cover',dpi:300,maxBytes:50_000});
 assert.ok(result.bytes.length<=50_000,`size ${result.bytes.length}`);
 const meta=await sharp(result.bytes).metadata();
 assert.deepEqual([meta.width,meta.height,meta.density],[413,531,300]);
 assert.ok(!/SecretCam|Jane Private/.test(meta.exif?.toString('latin1')??''),'the resolution tag must not bring source metadata along');
 assert.deepEqual(result.warnings,[]);
 // Without a limit the DPI path still strips source metadata.
 for(const format of ['jpeg','png','webp']){
  const tagged=await processImage(source,{action:'resize',format,quality:90,width:400,dpi:300}),info=await sharp(tagged.bytes).metadata();
  assert.equal(info.width,400);if(format!=='webp')assert.equal(info.density,300);
  assert.ok(!/SecretCam|Jane Private/.test(info.exif?.toString('latin1')??''),`${format} kept private EXIF`);
 }
});

test('PNG cannot drop quality, so a tight limit shrinks pixels and says so; an impossible limit is explained',async()=>{
 const source=await sharp(await photo(800,500)).png().toBuffer();
 const fitted=await processImage(source,{action:'compress',maxBytes:60_000});
 const meta=await sharp(fitted.bytes).metadata();
 assert.equal(meta.format,'png');assert.ok(fitted.bytes.length<=60_000&&meta.width<800,`png ${fitted.bytes.length} ${meta.width}`);
 assert.deepEqual(fitted.warnings,['The image was made smaller to fit the size limit.']);
 await assert.rejects(processImage(source,{action:'compress',maxBytes:1000}),error=>/could not get under the size limit/.test(error.message)&&error.smallestBytes>1000);
});

test('print and size options are validated and only accepted where they apply',()=>{
 assert.deepEqual(Object.keys(imageOptions({action:'resize',width:10})).filter(k=>['dpi','maxBytes'].includes(k)),[]);
 assert.equal(imageOptions({action:'resize',width:10,dpi:300,maxBytes:50_000}).dpi,300);
 for(const bad of [{action:'resize',width:10,dpi:20},{action:'resize',width:10,dpi:300.5},{action:'convert',dpi:300},{action:'resize',width:10,maxBytes:999},{action:'edit',maxBytes:50_000},{action:'compress',maxBytes:65*1024*1024}])
  assert.throws(()=>imageOptions(bad));
});
