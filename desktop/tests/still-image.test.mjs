import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';
import {decodeStillImage} from '../core/still-image.mjs';
test('still-image decoding keeps lossless WebP RGBA and refuses animated WebP/GIF',async()=>{
 const pixels=Buffer.alloc(48*32*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=40;pixels[i+1]=80;pixels[i+2]=160;pixels[i+3]=(i/4)%2?128:255;}
 const input=await sharp(pixels,{raw:{width:48,height:32,channels:4}}).webp({lossless:true}).toBuffer(),result=await decodeStillImage(input);
 assert.deepEqual(await sharp(result.bytes).ensureAlpha().raw().toBuffer(),pixels);
 const frames=Buffer.from(pixels);for(let i=48*16*4;i<frames.length;i+=4)frames[i]=220;
 const animation=await sharp(frames,{raw:{width:48,height:32,channels:4,pageHeight:16}}).webp({lossless:true,delay:[100,100],loop:0}).toBuffer();
 assert.equal((await sharp(animation,{animated:true}).metadata()).pages,2);await assert.rejects(decodeStillImage(animation));
 await assert.rejects(decodeStillImage(await sharp(input).gif().toBuffer()));
});
