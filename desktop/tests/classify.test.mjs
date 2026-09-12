import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {zipSync,strToU8} from 'fflate';import {signatureFormat,classifySelection} from '../core/classify.mjs';
test('signatures, not filename claims, determine tool suggestions',async()=>{const dir=await mkdtemp(join(tmpdir(),'sorafiles-classify-'));try{
 await writeFile(join(dir,'fake.pdf'),'not a pdf');await writeFile(join(dir,'renamed.jpg'),Buffer.from('89504e470d0a1a0a','hex'));
 const files=await classifySelection([join(dir,'fake.pdf'),join(dir,'renamed.jpg')]);assert.equal(files[0].validated,false);assert.equal(files[1].format,'PNG');assert.equal(files[1].extensionMismatch,true);assert.equal(files[1].validation,'signature-only');
 }finally{await rm(dir,{recursive:true,force:true});}});
test('Office container inspection distinguishes DOCX/XLSX and rejects ambiguous or traversal ZIP entries',async()=>{const dir=await mkdtemp(join(tmpdir(),'sorafiles-office-type-'));try{
 const entry=strToU8('<synthetic/>'),base={'[Content_Types].xml':entry};
 for(const [name,extra,expected] of [['word',{'word/document.xml':entry},'DOCX'],['sheet',{'xl/workbook.xml':entry},'XLSX'],['ambiguous',{'word/document.xml':entry,'xl/workbook.xml':entry},null],['traversal',{'../bad':entry,'word/document.xml':entry},null]]){const file=join(dir,name+'.zip');await writeFile(file,zipSync({...base,...extra}));assert.equal((await classifySelection([file]))[0].format,expected);}
 }finally{await rm(dir,{recursive:true,force:true});}});
test('unrecognized bytes, relative paths and network paths never become automatic actions',async()=>{assert.equal(signatureFormat(Buffer.from('MZfake.exe')),null);const files=await classifySelection(['relative.pdf','\\\\server\\share\\a.pdf']);assert.ok(files.every(f=>!f.validated));});
