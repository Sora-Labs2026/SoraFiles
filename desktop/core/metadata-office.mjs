import {inflateRawSync} from 'node:zlib';
import {zipSync} from 'fflate';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';

const MAX_INPUT=64*1024*1024,MAX_ENTRY=32*1024*1024,MAX_TOTAL=128*1024*1024,MAX_ENTRIES=4096,MAX_XML=2*1024*1024;
const decoder=new TextDecoder('utf-8',{fatal:true}),encoder=new TextEncoder();
const fail=()=>{throw Error('This Office document could not be cleaned safely');};
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function extraFields(bytes){
 for(let p=0;p<bytes.length;){if(p+4>bytes.length)fail();const id=bytes.readUInt16LE(p),length=bytes.readUInt16LE(p+2);p+=4;if(p+length>bytes.length||[1,0x9901,0x7075].includes(id))fail();p+=length;}
}
// Parse the directory before inflating anything. Never trust ZIP-declared sizes
// as allocation limits: zlib also enforces a hard bound on actual output.
function readArchive(input){
 const bytes=Buffer.from(input);if(bytes.length<22||bytes.length>MAX_INPUT)fail();
 let eocd=-1;for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(bytes.readUInt32LE(p)===0x06054b50&&p+22+bytes.readUInt16LE(p+20)===bytes.length){eocd=p;break;}
 if(eocd<0)fail();
 const count=bytes.readUInt16LE(eocd+10),size=bytes.readUInt32LE(eocd+12),offset=bytes.readUInt32LE(eocd+16);
 if(bytes.readUInt16LE(eocd+4)||bytes.readUInt16LE(eocd+6)||count!==bytes.readUInt16LE(eocd+8)||!count||count>MAX_ENTRIES||offset+size!==eocd)fail();
 const records=[],names=new Set();let p=offset,total=0;
 for(let i=0;i<count;i++){
  if(p+46>eocd||bytes.readUInt32LE(p)!==0x02014b50)fail();
  const flags=bytes.readUInt16LE(p+8),method=bytes.readUInt16LE(p+10),crc=bytes.readUInt32LE(p+16),compressed=bytes.readUInt32LE(p+20),length=bytes.readUInt32LE(p+24),n=bytes.readUInt16LE(p+28),x=bytes.readUInt16LE(p+30),c=bytes.readUInt16LE(p+32),local=bytes.readUInt32LE(p+42),end=p+46+n+x+c;
  if(end>eocd||!n||n>1024||flags&~0x080e||![0,8].includes(method)||method===0&&(flags&6)||bytes.readUInt16LE(p+34)||length>MAX_ENTRY||compressed>MAX_INPUT||local>=offset)fail();
  const rawName=bytes.subarray(p+46,p+46+n);if(!(flags&0x800)&&rawName.some(byte=>byte>127))fail();const name=decoder.decode(rawName),canonical=name.toLowerCase();
  if(/[\\\x00-\x1f\x7f:%?#]/.test(name)||name.startsWith('/')||name.split('/').some((part,index,array)=>part==='.'||part==='..'||!part&&index!==array.length-1)||names.has(canonical)||name.normalize('NFC')!==name)fail();
  const mode=bytes.readUInt32LE(p+38)>>>16;if((mode&0xf000)&&![0x8000,0x4000].includes(mode&0xf000))fail();
  if(name.endsWith('/')&&length)fail();names.add(canonical);total+=length;if(total>MAX_TOTAL)fail();extraFields(bytes.subarray(p+46+n,p+46+n+x));
  records.push({name,rawName,flags,method,crc,compressed,length,local});p=end;
 }
 if(p!==eocd)fail();
 const archive=Object.create(null);let last=0;
 for(const r of records.sort((a,b)=>a.local-b.local)){
  const q=r.local;if(q!==last||q+30>offset||bytes.readUInt32LE(q)!==0x04034b50)fail();
  const n=bytes.readUInt16LE(q+26),x=bytes.readUInt16LE(q+28),start=q+30+n+x,end=start+r.compressed;
  if(end>offset||bytes.readUInt16LE(q+6)!==r.flags||bytes.readUInt16LE(q+8)!==r.method||!bytes.subarray(q+30,q+30+n).equals(r.rawName))fail();
  const localValues=[bytes.readUInt32LE(q+14),bytes.readUInt32LE(q+18),bytes.readUInt32LE(q+22)],values=[r.crc,r.compressed,r.length];
  if(localValues.some((v,i)=>v!==values[i]&&(!(r.flags&8)||v!==0)))fail();extraFields(bytes.subarray(q+30+n,start));last=end;
  if(r.flags&8){if(last+12>offset)fail();if(bytes.readUInt32LE(last)===0x08074b50)last+=4;if(last+12>offset||values.some((v,i)=>bytes.readUInt32LE(last+4*i)!==v))fail();last+=12;}
  const data=r.method===0?bytes.subarray(start,end):inflateRawSync(bytes.subarray(start,end),{maxOutputLength:Math.max(1,r.length),info:true});
  if(r.method===8&&data.engine.bytesWritten!==r.compressed)fail();const content=r.method===0?data:data.buffer;
  if(content.length!==r.length||crc32(content)!==r.crc)fail();archive[r.name]=Uint8Array.from(content);
 }
 if(last!==offset)fail();return archive;
}
function xml(bytes){
 if(!bytes||bytes.length>MAX_XML)fail();const text=decoder.decode(bytes);
 if(/<!DOCTYPE|<!ENTITY/i.test(text)||/\x00/.test(text)||/<\?xml[^>]*encoding\s*=\s*['"](?!utf-8['"]|us-ascii['"])[^'"]+/i.test(text))fail();
 let invalid=false;const doc=new DOMParser({errorHandler:{warning(){invalid=true;},error(){invalid=true;},fatalError(){invalid=true;}}}).parseFromString(text,'application/xml');
 if(invalid||!doc.documentElement)fail();return {text,doc};
}
const CT='http://schemas.openxmlformats.org/package/2006/content-types',REL='http://schemas.openxmlformats.org/package/2006/relationships';
const kinds=[['docx','word/document.xml','application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'],['xlsx','xl/workbook.xml','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'],['pptx','ppt/presentation.xml','application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml']];
function inspectType(archive){
 const {doc}=xml(archive['[Content_Types].xml']);if(doc.documentElement.localName!=='Types'||doc.documentElement.namespaceURI!==CT)fail();
 const overrides=new Map(),defaults=new Map();let matched;
 for(const node of Array.from(doc.documentElement.childNodes).filter(n=>n.nodeType===1)){
  if(node.namespaceURI!==CT||!['Default','Override'].includes(node.localName))fail();const type=node.getAttribute('ContentType');
  if(node.localName==='Override'){const part=node.getAttribute('PartName');if(!part.startsWith('/')||overrides.has(part))fail();overrides.set(part,type);}
  else {const ext=node.getAttribute('Extension').toLowerCase();if(!ext||defaults.has(ext))fail();defaults.set(ext,type);}
 }
 // Some ordinary XLSX writers declare an unused macro-enabled .bin default.
 // Reject dangerous effective types for actual entries, not unused declarations.
 for(const name of Object.keys(archive))if(!name.endsWith('/')){
  const type=overrides.get('/'+name)||defaults.get(name.split('.').pop().toLowerCase())||'';
  if(/macroenabled|vba|digital-signature|activex/i.test(type))fail();
 }
 for(const kind of kinds)if(overrides.get('/'+kind[1])===kind[2]&&archive[kind[1]]){if(matched)fail();matched=kind;}
 if(!matched||kinds.filter(kind=>archive[kind[1]]).length!==1)fail();
 const roots=xml(archive['_rels/.rels']).doc;if(roots.documentElement.namespaceURI!==REL||roots.documentElement.localName!=='Relationships')fail();
 const office=Array.from(roots.getElementsByTagNameNS(REL,'Relationship')).filter(n=>/\/officeDocument$/.test(n.getAttribute('Type')));
 if(office.length!==1||office[0].getAttribute('TargetMode')==='External'||office[0].getAttribute('Target').replace(/^\//,'')!==matched[1])fail();
 // Property locations are deliberately scoped. A relocated part must not be
 // silently left behind while reporting that its private fields were removed.
 const propertyParts={'core-properties':'docProps/core.xml','extended-properties':'docProps/app.xml','custom-properties':'docProps/custom.xml'};
 for(const rel of Array.from(roots.getElementsByTagNameNS(REL,'Relationship'))){
  const name=rel.getAttribute('Type').split('/').pop();
  if(propertyParts[name]&&(rel.getAttribute('TargetMode')==='External'||rel.getAttribute('Target').replace(/^\//,'')!==propertyParts[name]))fail();
 }
 for(const [name,bytes] of Object.entries(archive)){
  if(/(^|\/)(_xmlsignatures|vbaproject\.bin|vbadata\.xml|activex)(\/|$)/i.test(name))fail();
  if(name.endsWith('.rels')){const {doc:relationships}=xml(bytes);if(relationships.documentElement.localName!=='Relationships'||relationships.documentElement.namespaceURI!==REL)fail();for(const rel of Array.from(relationships.getElementsByTagNameNS(REL,'Relationship')))if(/digital-signature|vbaProject|activeX/i.test(rel.getAttribute('Type')))fail();}
 }
 return matched[0];
}
const coreNames=['title','subject','creator','keywords','lastModifiedBy','category','contentStatus','revision','created','modified'];
const coreNamespaces=new Set(['http://purl.org/dc/elements/1.1/','http://schemas.openxmlformats.org/package/2006/metadata/core-properties','http://purl.org/dc/terms/']);
function cleanProperties(bytes,core){
 const {doc}=xml(bytes),root=doc.documentElement,ns=core?'http://schemas.openxmlformats.org/package/2006/metadata/core-properties':'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties';
 if(root.namespaceURI!==ns||root.localName!==(core?'coreProperties':'Properties'))fail();
 const selected=Array.from(doc.getElementsByTagName('*')).filter(node=>(core?coreNamespaces.has(node.namespaceURI)&&coreNames.includes(node.localName):node.namespaceURI===ns&&['Company','Manager','HyperlinkBase'].includes(node.localName)));
 for(const node of selected)node.parentNode?.removeChild(node);
 const result=encoder.encode(new XMLSerializer().serializeToString(doc));xml(result);return result;
}
export function cleanOfficeMetadata(bytes){
 const archive=readArchive(bytes),extension=inspectType(archive);
 if(archive['docProps/core.xml'])archive['docProps/core.xml']=cleanProperties(archive['docProps/core.xml'],true);
 if(archive['docProps/app.xml'])archive['docProps/app.xml']=cleanProperties(archive['docProps/app.xml'],false);
 if(archive['docProps/custom.xml']){const {doc}=xml(archive['docProps/custom.xml']);if(doc.documentElement.localName!=='Properties'||doc.documentElement.namespaceURI!=='http://schemas.openxmlformats.org/officeDocument/2006/custom-properties')fail();archive['docProps/custom.xml']=encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"/>');}
 const output=zipSync(archive,{level:6});if(output.length>MAX_INPUT)fail();return {bytes:output,extension};
}
