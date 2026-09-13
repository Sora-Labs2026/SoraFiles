// Headless extraction of the production pdf-lib page operations. No DOM, network,
// download clicks or filesystem writes. The trusted job host owns input/output handles.
import {PDFDocument,degrees,StandardFonts,rgb} from 'pdf-lib';
import {visiblePage} from './pdf-geometry.mjs';
const MAX_BYTES=256*1024*1024,MAX_PAGES=1000;
const check=signal=>signal?.throwIfAborted();
async function load(bytes,signal){check(signal);if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>MAX_BYTES)throw Error('Choose a PDF up to 256 MB');const doc=await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false});if(doc.getPageCount()<1||doc.getPageCount()>MAX_PAGES)throw Error('PDF must contain 1 to 1000 pages');check(signal);return doc;}
function indices(value,count,{allowEmpty=false}={}){if(!Array.isArray(value)||value.length>MAX_PAGES||value.some(n=>!Number.isInteger(n)||n<0||n>=count))throw Error('Invalid page selection');const unique=[...new Set(value)];if(!unique.length&&!allowEmpty)throw Error('Select at least one page');return unique;}
export function parsePageSelection(spec,count){if(typeof spec!=='string'||spec.length>4096||!Number.isInteger(count)||count<1||count>MAX_PAGES)throw Error('Invalid page range');const pages=new Set();for(const part of spec.split(',')){const match=/^(\d+)(?:\s*-\s*(\d+))?$/.exec(part.trim());if(!match)throw Error('Use page numbers or ascending ranges');const start=Number(match[1]),end=Number(match[2]||match[1]);if(start<1||end<start||end>count)throw Error('Page range is outside the PDF');for(let page=start;page<=end;page++)pages.add(page-1);}return [...pages].sort((a,b)=>a-b);}
async function save(doc,expected,signal){check(signal);const bytes=await doc.save({useObjectStreams:true,addDefaultPage:false});check(signal);if(bytes.length>MAX_BYTES)throw Error('Output exceeds the current desktop limit');const verified=await PDFDocument.load(bytes,{updateMetadata:false});if(verified.getPageCount()!==expected)throw Error('Output page count changed');return bytes;}
export async function mergePdf(inputs,{pages,signal,onProgress=()=>{}}={}){
 if(!Array.isArray(inputs)||inputs.length<2||inputs.length>256||inputs.reduce((n,b)=>n+(b?.length||0),0)>MAX_BYTES)throw Error('Select 2 to 256 PDFs totaling at most 256 MB');
 const sources=[];let total=0;for(const bytes of inputs){const source=await load(bytes,signal);total+=source.getPageCount();if(total>MAX_PAGES)throw Error('Merge supports up to 1000 pages');sources.push(source);}
 const selection=pages??sources.flatMap((source,fileIndex)=>source.getPageIndices().map(pageIndex=>({fileIndex,pageIndex,rotation:0})));
 if(!Array.isArray(selection)||!selection.length||selection.length>MAX_PAGES)throw Error('Keep 1 to 1000 pages');const out=await PDFDocument.create();
 for(const [index,model] of selection.entries()){
  check(signal);if(!Number.isInteger(model.fileIndex)||!sources[model.fileIndex])throw Error('Unknown source PDF');indices([model.pageIndex],sources[model.fileIndex].getPageCount());const rotation=model.rotation??0;if(!Number.isInteger(rotation)||rotation%90!==0)throw Error('Use quarter-turn rotations');
  const [page]=await out.copyPages(sources[model.fileIndex],[model.pageIndex]);if(rotation)page.setRotation(degrees(((page.getRotation().angle+rotation)%360+360)%360));out.addPage(page);onProgress({completed:index+1,total:selection.length,stage:'copying-pages'});
 }
 return {bytes:await save(out,selection.length,signal),pages:selection.length,warnings:['Merging rewrites the PDF. Digital signatures and document-level features may not survive.']};
}
export async function rotatePdf(input,{rotations,signal,onProgress=()=>{}}={}){
 const doc=await load(input,signal);if(!Array.isArray(rotations)||!rotations.length||rotations.length>doc.getPageCount())throw Error('Choose pages to rotate');const seen=new Set();
 for(const [index,item] of rotations.entries()){check(signal);indices([item.pageIndex],doc.getPageCount());if(seen.has(item.pageIndex)||!Number.isInteger(item.angle)||item.angle%90!==0||item.angle%360===0)throw Error('Choose one nonzero quarter-turn per page');seen.add(item.pageIndex);const page=doc.getPage(item.pageIndex);page.setRotation(degrees(((page.getRotation().angle+item.angle)%360+360)%360));onProgress({completed:index+1,total:rotations.length,stage:'rotating-pages'});}
 return {bytes:await save(doc,doc.getPageCount(),signal),pages:doc.getPageCount()};
}
export async function removePdfPages(input,{remove,signal}={}){const doc=await load(input,signal),selected=indices(remove,doc.getPageCount()).sort((a,b)=>b-a);if(selected.length===doc.getPageCount())throw Error('Keep at least one page');for(const page of selected){check(signal);doc.removePage(page);}return {bytes:await save(doc,doc.getPageCount(),signal),pages:doc.getPageCount()};}
export async function numberPdfPages(input,{selected,start=1,skip=0,format='number',position='bottom-center',size=10,margin=24,color='#333b52',signal,onProgress=()=>{}}={}){
 if(!Number.isSafeInteger(start)||start<1||start>999999||!Number.isSafeInteger(skip)||skip<0||skip>999
  ||!['number','page','total','roman'].includes(format)||!['top-left','top-center','top-right','bottom-left','bottom-center','bottom-right'].includes(position)
  ||!Number.isFinite(size)||size<6||size>72||!Number.isFinite(margin)||margin<4||margin>144||typeof color!=='string'||!/^#[a-f0-9]{6}$/i.test(color))throw Error('Choose valid page numbering options');
 const doc=await load(input,signal),pages=doc.getPages(),chosen=indices(selected??doc.getPageIndices(),pages.length).filter(index=>index>=skip).sort((a,b)=>a-b);
 if(!chosen.length)throw Error('Select at least one page to number');
 const last=start+chosen.length-1;if(last>999999||(format==='roman'&&last>3999))throw Error('Numbering exceeds the selected format');
 const roman=value=>{let text='';for(const [amount,glyph] of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']])while(value>=amount){text+=glyph;value-=amount;}return text;};
 const font=await doc.embedFont(StandardFonts.Helvetica),ink=rgb(...[1,3,5].map(at=>parseInt(color.slice(at,at+2),16)/255));
 for(const [numbered,index] of chosen.entries()){
  check(signal);const page=pages[index],view=visiblePage(page),{width:w,height:h,angle}=view,number=start+numbered;
  const label=format==='page'?`Page ${number}`:format==='total'?`Page ${number} of ${last}`:format==='roman'?roman(number):String(number),textWidth=font.widthOfTextAtSize(label,size);
  if(textWidth+2*margin>w||size*1.25+2*margin>h)throw Error('Page numbers do not fit. Reduce the font size or margin.');
  const x=position.endsWith('left')?margin:position.endsWith('right')?w-margin-textWidth:(w-textWidth)/2,y=position.startsWith('top')?h-margin-size:margin+size*.25;
  page.drawText(label,{...view.point(x,y),rotate:degrees(angle),size,font,color:ink});
  onProgress({completed:numbered+1,total:chosen.length,stage:'numbering-pages'});
 }
 return {bytes:await save(doc,pages.length,signal),pages:pages.length,numbered:chosen.length};
}
export async function splitPdf(input,{mode='each',selected,every,groups,signal,onProgress=()=>{}}={}){
 const source=await load(input,signal),count=source.getPageCount();let selections;
 if(mode==='each')selections=indices(selected??source.getPageIndices(),count).map(page=>[page]);
 else if(mode==='selected')selections=[indices(selected,count)];
 else if(mode==='groups'){if(!Array.isArray(groups)||!groups.length||groups.length>MAX_PAGES)throw Error('Enter page groups');selections=groups.map(group=>indices(group,count));}
 else if(mode==='every'){if(!Number.isInteger(every)||every<1||every>count)throw Error('Choose a valid number of pages per file');selections=[];for(let start=0;start<count;start+=every)selections.push(Array.from({length:Math.min(every,count-start)},(_,i)=>start+i));}
 else if(mode==='odd-even')selections=[source.getPageIndices().filter(p=>p%2===0),source.getPageIndices().filter(p=>p%2===1)].filter(p=>p.length);
 else throw Error('Unknown split mode');
 if(selections.reduce((sum,group)=>sum+group.length,0)>MAX_PAGES)throw Error('Split output exceeds 1000 pages');
 const results=[];let bytesTotal=0;for(const [index,group] of selections.entries()){check(signal);const doc=await PDFDocument.create();for(const page of await doc.copyPages(source,group))doc.addPage(page);const bytes=await save(doc,group.length,signal);bytesTotal+=bytes.length;if(bytesTotal>MAX_BYTES)throw Error('Split output exceeds 256 MB');results.push({bytes,pages:group.length,sourcePages:group.map(p=>p+1),suffix:group.length===1?'-page-'+String(group[0]+1).padStart(3,'0'):'-group-'+String(index+1).padStart(2,'0')});onProgress({completed:index+1,total:selections.length,stage:'extracting-pages'});}
 return results;
}
// Common bounded I/O for the remaining headless PDF engines.
export {load as loadPdfDocument,save as savePdfDocument,indices as pdfPageIndices};
