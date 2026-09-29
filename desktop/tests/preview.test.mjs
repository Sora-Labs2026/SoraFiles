import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {PDFDocument} from 'pdf-lib';
import {previewSelection} from '../core/preview.mjs';

test('previews: bounded image data URLs with source size, PDF page thumbnails, unknown files skipped',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sf-preview-'));
 try{
  const png=join(dir,'photo.png'),pdf=join(dir,'doc.pdf'),text=join(dir,'notes.txt');
  await writeFile(png,await sharp({create:{width:3000,height:1500,channels:4,background:'#33669980'}}).png().toBuffer());
  const doc=await PDFDocument.create();for(let i=0;i<3;i++)doc.addPage([595,842]).drawText(`Page ${i+1}`,{x:50,y:700,size:40});
  await writeFile(pdf,await doc.save());await writeFile(text,'hello');
  const single=await previewSelection([png]);
  const image=single.previews[0];
  assert.equal(image.kind,'image');assert.match(image.src,/^data:image\/webp;base64,/);
  assert.deepEqual([image.width,image.height,image.sourceWidth,image.sourceHeight],[1600,800,3000,1500]);
  const pages=(await previewSelection([pdf])).previews[0];
  assert.equal(pages.kind,'pdf');assert.equal(pages.pages,3);assert.equal(pages.thumbs.length,3);
  assert.deepEqual(pages.thumbs.map(thumb=>thumb.page),[1,2,3]);assert.match(pages.thumbs[0].src,/^data:image\/jpeg;base64,/);
  assert.ok(pages.thumbs[0].width<=200,'thumbnails are small');
  const mixed=await previewSelection([text,png,pdf]);
  assert.deepEqual(mixed.previews.map(preview=>[preview.index,preview.kind]),[[1,'image'],[2,'pdf']]);
  assert.equal(mixed.previews[1].thumbs.length,1,'several files: first page only');
  assert.ok(mixed.previews[0].width<=360,'several files: grid-sized image');
 }finally{await rm(dir,{recursive:true,force:true});}
});
