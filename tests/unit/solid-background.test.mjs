import test from 'node:test';
import assert from 'node:assert/strict';
import { solidPalette, refineSolidStrip } from '../../src/lib/solid-background.ts';

test('solid-color cleanup removes an enclosed background and unmattes a blended edge', () => {
  const source = new Uint8ClampedArray([244,231,209,255, 156,144,206,255, 67,56,202,255]);
  const output = source.slice();
  refineSolidStrip(source,output,{background:[244,231,209],foreground:[[67,56,202]]});
  assert.equal(output[3],0);
  assert.ok(Math.abs(output[7]-127)<3);
  assert.deepEqual([...output.slice(4,7)],[67,56,202]);
  assert.equal(output[11],255);
});

test('cleanup retains unmatched subject colors and existing transparency', () => {
  const source = new Uint8ClampedArray([20,200,40,255,244,231,209,64,67,56,202,0]);
  const output = new Uint8ClampedArray([20,200,40,190,244,231,209,12,67,56,202,0]);
  const expected=output.slice();
  refineSolidStrip(source,output,{background:[244,231,209],foreground:[[67,56,202]]});
  assert.deepEqual(output,expected);
});

test('uniform opaque border is required and subject colors come from a confident mask', () => {
  const w=12,h=12, source=new Uint8ClampedArray(w*h*4),mask=source.slice();
  for(let i=0;i<source.length;i+=4)source.set([244,231,209,255],i);
  for(let y=4;y<8;y++)for(let x=4;x<8;x++){const i=(y*w+x)*4;source.set([67,56,202,255],i);mask[i+3]=255;}
  assert.deepEqual(solidPalette(source,mask,w,h),{background:[244,231,209],foreground:[[67,56,202]]});
  source[3]=0;assert.equal(solidPalette(source,mask,w,h),undefined);source[3]=255;
  for(let x=0;x<w;x++)source[x*4]=20;
  assert.equal(solidPalette(source,mask,w,h),undefined);
});
