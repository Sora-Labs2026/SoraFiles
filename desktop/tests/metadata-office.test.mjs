import test from 'node:test';import assert from 'node:assert/strict';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {Document,Paragraph,Packer} from 'docx';import * as XLSX from 'xlsx';
import {DOMParser} from '@xmldom/xmldom';
import {cleanOfficeMetadata} from '../core/metadata-office.mjs';
import {removeMetadata} from '../core/metadata.mjs';
import {officeMetadataFixture} from './fixtures/office-metadata.mjs';
import {stripOpenXmlMeta} from '../../src/lib/metadata-strip.js';
const parsed=bytes=>new DOMParser().parseFromString(strFromU8(bytes),'application/xml');
const pack=entries=>zipSync(entries,{level:6});

test('Office cleanup matches Web property scope and preserves every non-property entry for DOCX/XLSX/PPTX',async()=>{
 for(const extension of ['docx','xlsx','pptx']){
  const fixture=officeMetadataFixture(extension),original=Buffer.from(fixture.bytes);
  const result=await removeMetadata(fixture.bytes),actual=unzipSync(result.bytes);
  const web=unzipSync(new Uint8Array(await(await stripOpenXmlMeta(new File([fixture.bytes],'fixture.'+extension))).blob.arrayBuffer()));
  assert.equal(result.extension,extension);assert.match(result.warnings[0],/tracked changes/);
  assert.deepEqual(Object.keys(actual).sort(),Object.keys(fixture.entries).sort());
  for(const [name,bytes] of Object.entries(fixture.entries)){
   if(!name.startsWith('docProps/'))assert.deepEqual(actual[name],bytes,name);
   // Standard fixtures also match Web's resulting metadata DOM content.
   else {assert.doesNotMatch(strFromU8(actual[name]),/Private/);assert.equal(parsed(actual[name]).documentElement.toString(),parsed(web[name]).documentElement.toString());}
  }
  assert.deepEqual(Buffer.from(fixture.bytes),original);
 }
});

test('real generated Word and spreadsheet documents retain readable text, values and formulas',async()=>{
 const word=await Packer.toBuffer(new Document({creator:'Private author',title:'Private title',sections:[{children:[new Paragraph('Keep invoice 00123')]}]}));
 const cleaned=await removeMetadata(word),before=unzipSync(word),after=unzipSync(cleaned.bytes);
 assert.deepEqual(after['word/document.xml'],before['word/document.xml']);assert.match(strFromU8(after['word/document.xml']),/Keep invoice 00123/);
 assert.doesNotMatch(strFromU8(after['docProps/core.xml']),/Private/);
 const sheet=XLSX.utils.aoa_to_sheet([['Code','Amount'],['00123',15]]);sheet.C2={t:'n',f:'B2*2',v:30};sheet['!ref']='A1:C2';
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Invoice');book.Props={Author:'Private author',Company:'Private company'};
 const bytes=XLSX.write(book,{type:'buffer',bookType:'xlsx'}),output=await removeMetadata(bytes),read=XLSX.read(output.bytes,{type:'array'});
 assert.equal(read.Sheets.Invoice.A2.v,'00123');assert.equal(read.Sheets.Invoice.B2.v,15);assert.equal(read.Sheets.Invoice.C2.f,'B2*2');assert.notEqual(read.Props.Author,'Private author');
});

test('namespace aliases and nested property elements are removed without touching document contents',()=>{
 const {entries,part}=officeMetadataFixture('docx');
 entries['docProps/core.xml']=strToU8('<p:coreProperties xmlns:p="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:a="http://purl.org/dc/elements/1.1/"><a:creator><![CDATA[Private author]]></a:creator><a:title><a:title>Private nested</a:title></a:title><p:lastModifiedBy/></p:coreProperties>');
 const output=unzipSync(cleanOfficeMetadata(pack(entries)).bytes);assert.doesNotMatch(strFromU8(output['docProps/core.xml']),/Private|creator|lastModifiedBy|<a:title/);assert.deepEqual(output[part],entries[part]);
});

test('encrypted, signed, macro and ambiguous or relocated Office packages fail closed',()=>{
 const base=officeMetadataFixture('docx').entries;
 for(const extra of [{'_xmlsignatures/sig1.xml':strToU8('<signature/>')},{'word/vbaProject.bin':new Uint8Array([1])},{'word/activeX/activeX1.bin':new Uint8Array([1])},{'ppt/presentation.xml':strToU8('<presentation/>')}])assert.throws(()=>cleanOfficeMetadata(pack({...base,...extra})));
 for(const transform of [s=>s.replace('wordprocessingml.document.main+xml','ms-word.document.macroEnabled.main+xml'),s=>s.replace('ContentType="application/vnd.openxmlformats-package.core-properties+xml"','ContentType="application/vnd.openxmlformats-package.digital-signature-xmlsignature+xml"')])assert.throws(()=>cleanOfficeMetadata(pack({...base,'[Content_Types].xml':strToU8(transform(strFromU8(base['[Content_Types].xml'])))})));
 assert.throws(()=>cleanOfficeMetadata(pack({...base,'_rels/.rels':strToU8(strFromU8(base['_rels/.rels']).replace('Target="docProps/core.xml"','Target="private/core.xml"'))})));
 const encrypted=Buffer.from(pack(base));encrypted.writeUInt16LE(encrypted.readUInt16LE(6)|1,6);assert.throws(()=>cleanOfficeMetadata(encrypted));
});

test('ZIP traversal, case duplicates, corruption, inconsistent sizes and decompression bombs are rejected',()=>{
 const base=officeMetadataFixture('xlsx').entries;
 for(const path of ['../outside','/absolute','dir\\file','C:/drive','xl/./sheet','xl/%2e%2e/escape','DOCPROPS/CORE.XML'])assert.throws(()=>cleanOfficeMetadata(pack({...base,[path]:strToU8('bad')})),path);
 const valid=Buffer.from(pack(base));
 for(const cut of [0,4,valid.length-1,valid.length-22])assert.throws(()=>cleanOfficeMetadata(valid.subarray(0,cut)));
 const end=valid.length-22,central=valid.readUInt32LE(end+16);
 for(const change of [b=>b[central+16]^=1,b=>b.writeUInt32LE(0x7fffffff,central+24),b=>b.writeUInt32LE(0x7fffffff,end+16),b=>b.writeUInt16LE(5000,end+10),b=>b[30]^=1]){const b=Buffer.from(valid);change(b);assert.throws(()=>cleanOfficeMetadata(b));}
 const bomb=Buffer.from(pack({...base,'large.bin':new Uint8Array(33*1024*1024)}));assert.throws(()=>cleanOfficeMetadata(bomb));
 // Lie consistently in both headers: actual inflation must still be bounded.
 const lied=Buffer.from(pack({...base,'large.bin':new Uint8Array(1024*1024)}));let at=lied.readUInt32LE(lied.length-6);
 while(lied.readUInt32LE(at)===0x02014b50){const n=lied.readUInt16LE(at+28);if(lied.subarray(at+46,at+46+n).toString()==='large.bin'){const local=lied.readUInt32LE(at+42);lied.writeUInt32LE(4,at+24);lied.writeUInt32LE(4,local+22);break;}at+=46+n+lied.readUInt16LE(at+30)+lied.readUInt16LE(at+32);}
 assert.throws(()=>cleanOfficeMetadata(lied));
});

test('malformed XML and DTD/entity declarations are refused without external access',()=>{
 const base=officeMetadataFixture('pptx').entries;
 for(const xml of ['<broken>','<!DOCTYPE x [<!ENTITY e SYSTEM "https://invalid.example/secret">]><x>&e;</x>','<?xml version="1.0" encoding="UTF-16"?><x/>'])assert.throws(()=>cleanOfficeMetadata(pack({...base,'docProps/core.xml':strToU8(xml)})));
 assert.throws(()=>cleanOfficeMetadata(pack({...base,'docProps/core.xml':new Uint8Array([0xff,0xff])})));
});
