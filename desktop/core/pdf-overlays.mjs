import {degrees,StandardFonts,rgb} from 'pdf-lib';
import {loadPdfDocument,savePdfDocument,pdfPageIndices} from './pdf.mjs';
import {visiblePage} from './pdf-geometry.mjs';
import {decodeImage} from './image-decode.mjs';

export async function watermarkPdf(input,{text,selected,size=42,opacity=.2,angle=45,color='#667085',margin=24,signal,onProgress=()=>{}}={}) {
 if(typeof text!=='string'||!text.trim()||text.length>256||/[\x00-\x1f\x7f]/.test(text)||!Number.isFinite(size)||size<6||size>144
  ||!Number.isFinite(opacity)||opacity<=0||opacity>1||!Number.isFinite(angle)||angle< -180||angle>180||!/^#[a-f0-9]{6}$/i.test(color)||!Number.isFinite(margin)||margin<0||margin>144)throw Error('Choose valid watermark options');
 const doc=await loadPdfDocument(input,signal),chosen=pdfPageIndices(selected??doc.getPageIndices(),doc.getPageCount()),font=await doc.embedFont(StandardFonts.Helvetica);
 let width;try{width=font.widthOfTextAtSize(text,size);}catch{throw Error('This watermark font does not support that text');}
 const ascent=font.heightAtSize(size,{descender:false}),descent=font.heightAtSize(size)-ascent;
 const rad=angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad),rotate=(x,y)=>[x*c-y*s,x*s+y*c];
 const corners=[[0,-descent],[width,-descent],[width,ascent],[0,ascent]].map(([x,y])=>rotate(x,y));
 const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const ink=rgb(...[1,3,5].map(at=>parseInt(color.slice(at,at+2),16)/255));
 for(const [i,index] of chosen.entries()) {
  signal?.throwIfAborted();const page=doc.getPage(index),view=visiblePage(page);
  if(maxX-minX+2*margin>view.width||maxY-minY+2*margin>view.height)throw Error('The watermark does not fit. Reduce its size or shorten the text.');
  const origin=view.point((view.width-minX-maxX)/2,(view.height-minY-maxY)/2);
  page.drawText(text,{...origin,size,font,color:ink,opacity,rotate:degrees(view.angle+angle)});
  onProgress({completed:i+1,total:chosen.length,stage:'adding-watermark'});
 }
 return {bytes:await savePdfDocument(doc,doc.getPageCount(),signal),pages:doc.getPageCount(),warnings:['Adding a watermark changes the document and may invalidate an existing digital signature.']};
}

// Places a visible signature image, not a cryptographic certificate. Rectangles
// are normalized top-left coordinates in the preview's rotated visible page.
export async function signPdf(input,image,{placements,signal,onProgress=()=>{}}={}) {
 if(!Array.isArray(placements)||!placements.length||placements.length>1000)throw Error('Place a signature on at least one page');
 const doc=await loadPdfDocument(input,signal);
 for(const p of placements) {
  if(!p||![p.x,p.y,p.width,p.height].every(Number.isFinite)||p.x<0||p.y<0||p.width<=0||p.height<=0||p.x+p.width>1||p.y+p.height>1)throw Error('Keep the signature inside the visible page');
  pdfPageIndices([p.pageIndex],doc.getPageCount());
 }
 const decoded=await decodeImage(image,{signal}),embedded=await doc.embedPng(decoded.bytes);
 for(const [i,p] of placements.entries()) {
  signal?.throwIfAborted();const page=doc.getPage(p.pageIndex),view=visiblePage(page),boxW=p.width*view.width,boxH=p.height*view.height;
  const scale=Math.min(boxW/decoded.width,boxH/decoded.height),width=decoded.width*scale,height=decoded.height*scale;
  if(width<1||height<1)throw Error('Make the signature larger');
  const x=p.x*view.width+(boxW-width)/2,y=view.height-p.y*view.height-(boxH+height)/2;
  page.drawImage(embedded,{...view.point(x,y),width,height,rotate:degrees(view.angle)});
  onProgress({completed:i+1,total:placements.length,stage:'placing-signature'});
 }
 return {bytes:await savePdfDocument(doc,doc.getPageCount(),signal),pages:doc.getPageCount(),warnings:['This adds a visible signature image. It is not a certificate-based digital signature.']};
}
