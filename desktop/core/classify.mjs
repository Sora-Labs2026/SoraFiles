import {open,lstat} from 'node:fs/promises';
import {extname,isAbsolute,resolve} from 'node:path';
const extensions={PDF:['pdf'],JPG:['jpg','jpeg'],PNG:['png'],WebP:['webp'],HEIC:['heic'],HEIF:['heif'],TIFF:['tif','tiff'],PSD:['psd'],DOCX:['docx'],XLSX:['xlsx'],PPTX:['pptx'],GIF:['gif']};
const starts=(bytes,hex)=>bytes.subarray(0,hex.length/2).equals(Buffer.from(hex,'hex'));

// This establishes content type for suggestions, not document validity. Every engine
// must still fully decode with its own resource limits before processing or publication.
export function signatureFormat(head,tail=Buffer.alloc(0)){
 if(head.subarray(0,5).toString()==='%PDF-')return 'PDF';
 if(starts(head,'89504e470d0a1a0a'))return 'PNG';
 if(starts(head,'ffd8ff'))return 'JPG';
 if(['GIF87a','GIF89a'].includes(head.subarray(0,6).toString()))return 'GIF';
 if(head.subarray(0,4).toString()==='RIFF'&&head.subarray(8,12).toString()==='WEBP')return 'WebP';
 if(starts(head,'49492a00')||starts(head,'4d4d002a')||starts(head,'49492b00')||starts(head,'4d4d002b'))return 'TIFF';
 if(starts(head,'384250530001'))return 'PSD';
 if(head.length>=20&&head.subarray(4,8).toString()==='ftyp'){
  const size=head.readUInt32BE(0);if(size<20||size>head.length||size>4096||size%4!==0)return null;
  const brands=[head.subarray(8,12).toString()];for(let i=16;i+4<=size;i+=4)brands.push(head.subarray(i,i+4).toString());
  if(brands.some(b=>['avif','avis'].includes(b)))return null;
  if(brands.some(b=>['heic','heix','hevc','hevx'].includes(b)))return 'HEIC';
  if(brands.some(b=>['mif1','msf1'].includes(b)))return 'HEIF';
 }
 return null;
}
async function officeFormat(handle,size){
 const tail=Buffer.alloc(Math.min(size,65557));await handle.read(tail,0,tail.length,size-tail.length);
 let eocd=-1;for(let i=tail.length-22;i>=0;i--)if(tail.readUInt32LE(i)===0x06054b50&&i+22+tail.readUInt16LE(i+20)===tail.length){eocd=i;break;}
 if(eocd<0)return null;
 const count=tail.readUInt16LE(eocd+10),length=tail.readUInt32LE(eocd+12),offset=tail.readUInt32LE(eocd+16);
 if(tail.readUInt16LE(eocd+4)||tail.readUInt16LE(eocd+6)||!count||count>2048||length>1048576||offset+length>size-tail.length+eocd)return null;
 const directory=Buffer.alloc(length);await handle.read(directory,0,length,offset);const names=new Set();let pos=0,total=0;
 for(let i=0;i<count;i++){
  if(pos+46>length||directory.readUInt32LE(pos)!==0x02014b50)return null;
  const flags=directory.readUInt16LE(pos+8),unpacked=directory.readUInt32LE(pos+24),n=directory.readUInt16LE(pos+28),extra=directory.readUInt16LE(pos+30),comment=directory.readUInt16LE(pos+32);
  if(flags&1||pos+46+n+extra+comment>length)return null;total+=unpacked;if(total>512*1024*1024)return null;
  const name=directory.subarray(pos+46,pos+46+n).toString('utf8');if(name.includes('\\')||name.includes('\0')||name.startsWith('/')||name.split('/').includes('..')||names.has(name))return null;names.add(name);pos+=46+n+extra+comment;
 }
 if(pos!==length||!names.has('[Content_Types].xml'))return null;
 const candidates=[['word/document.xml','DOCX'],['xl/workbook.xml','XLSX'],['ppt/presentation.xml','PPTX']].filter(([name])=>names.has(name));
 return candidates.length===1?candidates[0][1]:null;
}
export async function classifySelection(paths){
 if(!Array.isArray(paths)||paths.length>256)throw Error('Select up to 256 files');
 const files=[];
 for(const file of paths){let handle;
  try{if(typeof file!=='string'||!isAbsolute(file)||file.includes('\0')||file.startsWith('\\\\')||file.startsWith('//'))throw Error('Local absolute path required');
   const path=resolve(file),before=await lstat(path);if(!before.isFile()||before.isSymbolicLink()||!before.size||before.size>512*1024*1024)throw Error('Unsupported file');
   handle=await open(path,'r');const info=await handle.stat();if(info.dev!==before.dev||info.ino!==before.ino||info.size!==before.size)throw Error('Selection changed');
   const head=Buffer.alloc(Math.min(info.size,4096));await handle.read(head,0,head.length,0);
   let format=signatureFormat(head);if(!format&&starts(head,'504b0304'))format=await officeFormat(handle,info.size);
   const after=await handle.stat();if(after.size!==info.size||after.mtimeMs!==info.mtimeMs)throw Error('Selection changed');
   files.push({path,format,validated:!!format,validation:'signature-only',bytes:info.size,extensionMismatch:!!format&&!extensions[format].includes(extname(path).slice(1).toLowerCase())});
  }catch{files.push({path:file,format:null,validated:false,reason:'Open in SoraFiles to inspect this file'});}finally{await handle?.close();}
 }
 return files;
}
