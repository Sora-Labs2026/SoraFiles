// Shared range syntax only. The engine checks against the actual PDF page count.
export function parsePageSelection(spec,count){
 if(typeof spec!=='string'||spec.length>4096||!Number.isInteger(count)||count<1||count>1000)throw Error('Invalid page range');
 const pages=new Set();
 for(const part of spec.split(',')){
  const match=/^(\d+)(?:\s*-\s*(\d+))?$/.exec(part.trim());
  if(!match)throw Error('Use page numbers or ascending ranges, such as 1-3, 5.');
  const start=Number(match[1]),end=Number(match[2]||match[1]);
  if(start<1||end<start||end>count)throw Error('Page range is outside the PDF');
  for(let page=start;page<=end;page++)pages.add(page-1);
 }
 return [...pages].sort((a,b)=>a-b);
}
