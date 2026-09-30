import {PDFDict,PDFArray,PDFStream,PDFName} from 'pdf-lib';
export function rejectPdfSignatures(source){
 const seen=new Set(),stack=source.context.enumerateIndirectObjects().map(([,object])=>object);
 while(stack.length){
  const object=stack.pop();if(!object||seen.has(object))continue;seen.add(object);if(seen.size>250000)throw Error('PDF object budget exceeded');
  if(object instanceof PDFStream)stack.push(object.dict);
  else if(object instanceof PDFDict){
   if(object.has(PDFName.of('ByteRange'))||object.get(PDFName.of('Type'))===PDFName.of('Sig'))throw Error('Signed PDFs cannot be rewritten');
   stack.push(...object.values());
  }else if(object instanceof PDFArray)stack.push(...object.asArray());
 }
}
