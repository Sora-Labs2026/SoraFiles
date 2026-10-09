import {host} from './host';
import {syncProcessingOptions} from './processing';
import {t} from './localization';

// Workspace canvas: image preview with a movable crop frame, PDF page grid
// with click-to-select pages, or a thumbnail grid for several files. Previews
// are small data URLs made by the native preview component; the UI never
// reads the files themselves. Captions keep each fixed phrase apart from the
// numbers beside it, so the exact-match catalog can translate every phrase.
type ImagePreview={index:number;kind:'image';src:string;width:number;height:number;sourceWidth:number;sourceHeight:number};
type PdfPreview={index:number;kind:'pdf';pages:number;thumbs:{page:number;src:string;width:number;height:number}[]};
type Preview=ImagePreview|PdfPreview;
type FileItem={id:string;name:string;format:string|null};

export const CROP_TOOLS=new Set(['resize-image','edit-image']);
export const PAGE_TOOLS=new Set(['rotate-pdf','remove-pages','split-pdf','pdf-to-jpg','page-numbers','watermark-pdf']);
const escape=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

const previews=new Map<string,Preview>();
let selectionKey='',loading=false,generation=0,contextKey='';
let crop={x:0,y:0,w:1,h:1},ratio='original';
const pickedPages=new Set<number>();
let onCropChange:()=>void=()=>{};

function resetFor(tool:string){
 const next=selectionKey+'|'+tool;if(next===contextKey)return;contextKey=next;
 crop={x:0,y:0,w:1,h:1};ratio='original';pickedPages.clear();
}
export function loadPreviews(files:FileItem[],tool:string,onReady:()=>void){
 const ids=files.map(file=>file.id),next=ids.join(',');
 if(!ids.length){selectionKey='';previews.clear();loading=false;resetFor(tool);return;}
 if(next!==selectionKey){
  selectionKey=next;previews.clear();loading=true;const run=++generation;
  host('previewSelection',{selectionIds:ids}).then((result:any)=>{
   if(run!==generation)return;
   for(const preview of Array.isArray(result?.previews)?result.previews:[])if(ids[preview.index])previews.set(ids[preview.index],preview);
  }).catch(()=>{}).finally(()=>{if(run!==generation)return;loading=false;resetFor(tool);onReady();});
 }
 resetFor(tool);
}

const singleImage=(files:FileItem[])=>files.length===1?previews.get(files[0].id) as ImagePreview|undefined:undefined;
export function cropImage(files:FileItem[]){const preview=singleImage(files);return preview?.kind==='image'?preview:undefined;}
export const hasCropCanvas=(tool:string,files:FileItem[])=>CROP_TOOLS.has(tool)&&!!cropImage(files);

// Crop in source pixels, or undefined when the whole image is kept.
export function cropPixels(files:FileItem[]){
 const image=cropImage(files);if(!image)return undefined;
 const left=Math.round(crop.x*image.sourceWidth),top=Math.round(crop.y*image.sourceHeight);
 const width=Math.max(1,Math.min(image.sourceWidth-left,Math.round(crop.w*image.sourceWidth)));
 const height=Math.max(1,Math.min(image.sourceHeight-top,Math.round(crop.h*image.sourceHeight)));
 return width===image.sourceWidth&&height===image.sourceHeight?undefined:{left,top,width,height};
}
export function cropSize(files:FileItem[]){
 const image=cropImage(files);if(!image)return null;
 const exact=cropPixels(files);return exact?{width:exact.width,height:exact.height}:{width:image.sourceWidth,height:image.sourceHeight};
}

function cropCaption(image:ImagePreview,files:FileItem[],tool:string){
 const size=cropSize(files)!;
 return `<bdi>${image.sourceWidth} × ${image.sourceHeight} px</bdi>${CROP_TOOLS.has(tool)&&(size.width!==image.sourceWidth||size.height!==image.sourceHeight)?` · <strong><span>${t('Crop')}</span> <bdi>${size.width} × ${size.height} px</bdi></strong>`:''}`;
}
function imageStage(image:ImagePreview,file:FileItem,tool:string,files:FileItem[]){
 const cropping=CROP_TOOLS.has(tool);
 const box=cropping?`<div class="crop-box" tabindex="0" role="group" aria-label="${escape(t('Crop area. Drag to move it, drag a corner to resize, or use the arrow keys.'))}" style="${boxStyle()}">${['tl','tr','br','bl'].map(handle=>`<span class="crop-handle" data-handle="${handle}" aria-hidden="true"></span>`).join('')}</div>`:'';
 return `<div class="canvas-stage"><div class="canvas-frame${cropping?' is-cropping':''}" style="aspect-ratio:${image.width}/${image.height};--ar:${image.width/image.height}"><img src="${image.src}" alt="${escape(t('Preview'))}: ${escape(file.name)}" draggable="false">${box}</div><p class="canvas-caption" data-crop-caption>${cropCaption(image,files,tool)}</p></div>`;
}
function pageGrid(preview:PdfPreview,tool:string){
 const picking=PAGE_TOOLS.has(tool);
 const thumbs=preview.thumbs.map(thumb=>picking
  ?`<button type="button" class="page-thumb" data-page-number="${thumb.page}" aria-pressed="${pickedPages.has(thumb.page)}" aria-label="${escape(t('Page'))} ${thumb.page}"><img src="${thumb.src}" alt="" draggable="false"><span>${thumb.page}</span></button>`
  :`<figure class="page-thumb"><img src="${thumb.src}" alt="${escape(t('Page'))} ${thumb.page}" draggable="false"><figcaption>${thumb.page}</figcaption></figure>`).join('');
 const more=preview.pages>preview.thumbs.length?` · <span>${t('Preview shows the first pages only.')}</span> <bdi>${preview.thumbs.length} / ${preview.pages}</bdi>`:'';
 return `<p class="canvas-caption"><span>${t('Pages')}</span> <bdi>${preview.pages}</bdi>${more}${picking?`<br><span>${t('Click pages to choose them, or type page numbers in the options.')}</span>`:''}</p><div class="page-grid${picking?' is-picking':''}">${thumbs}</div>`;
}
function fileGrid(files:FileItem[]){
 return `<ul class="thumb-grid">${files.slice(0,24).map((file,index)=>{
  const preview=previews.get(file.id);
  const src=preview?.kind==='image'?preview.src:preview?.kind==='pdf'?preview.thumbs[0]?.src:undefined;
  return `<li><figure>${src?`<img src="${src}" alt="" draggable="false">`:`<span class="thumb-empty" aria-hidden="true">${escape(file.format||'File')}</span>`}<figcaption><span class="thumb-order">${index+1}</span><bdi data-user-text>${escape(file.name)}</bdi>${preview?.kind==='pdf'?` · <span>${t('Pages')}</span> <bdi>${preview.pages}</bdi>`:''}</figcaption></figure></li>`;
 }).join('')}</ul>${files.length>24?`<p class="canvas-caption"><span>${t('Preview shows the first 24 files only.')}</span> <bdi>24 / ${files.length}</bdi></p>`:''}`;
}
export function canvasView(tool:string,files:FileItem[]){
 if(!files.length)return '';
 let inner='';
 if(loading)inner=`<div class="canvas-loading" role="status"><span class="canvas-spinner" aria-hidden="true"></span>${t('Loading preview…')}</div>`;
 else if(files.length===1){
  const preview=previews.get(files[0].id);
  inner=preview?.kind==='image'?imageStage(preview,files[0],tool,files):preview?.kind==='pdf'?pageGrid(preview,tool):'';
 }else if(previews.size)inner=fileGrid(files);
 return inner?`<section id="workspace-canvas" class="canvas" aria-label="${escape(t('Preview'))}">${inner}</section>`:'<section id="workspace-canvas" class="canvas" hidden></section>';
}

// ---- Crop frame ----
const boxStyle=()=>`left:${crop.x*100}%;top:${crop.y*100}%;width:${crop.w*100}%;height:${crop.h*100}%`;
function ratioValue(image:ImagePreview){
 if(ratio==='free')return null;if(ratio==='original')return image.sourceWidth/image.sourceHeight;
 const [a,b]=ratio.split(':').map(Number);return a/b;
}
let activeFiles:FileItem[]=[],activeTool='';
function refreshCrop(){
 const box=document.querySelector<HTMLElement>('.crop-box');if(box)box.style.cssText=boxStyle();
 const image=cropImage(activeFiles),caption=document.querySelector<HTMLElement>('[data-crop-caption]');
 if(image&&caption)caption.innerHTML=cropCaption(image,activeFiles,activeTool);
 document.querySelectorAll<HTMLButtonElement>('[data-ratio]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.ratio===ratio)));
 onCropChange();
}
export function setRatio(value:string){
 ratio=value;const image=cropImage(activeFiles);
 const target=image&&ratioValue(image);
 if(image&&target){
  let w=1,h=image.sourceWidth/(image.sourceHeight*target);
  if(h>1){h=1;w=image.sourceHeight*target/image.sourceWidth;}
  crop={x:(1-w)/2,y:(1-h)/2,w,h};
 }
 refreshCrop();
}
export const currentRatio=()=>ratio;
function resizeFrom(handle:string,px:number,py:number,frame:DOMRect){
 const image=cropImage(activeFiles);if(!image)return;
 const minW=Math.min(.25,40/Math.max(1,frame.width)),minH=Math.min(.25,40/Math.max(1,frame.height));
 let left=crop.x,top=crop.y,right=crop.x+crop.w,bottom=crop.y+crop.h;
 if(handle.includes('l'))left=Math.min(right-minW,Math.max(0,px));else right=Math.max(left+minW,Math.min(1,px));
 if(handle.includes('t'))top=Math.min(bottom-minH,Math.max(0,py));else bottom=Math.max(top+minH,Math.min(1,py));
 const target=ratioValue(image);
 if(target){
  const wantedHeight=(right-left)*image.sourceWidth/(target*image.sourceHeight);
  if(handle.includes('t'))top=Math.max(0,bottom-wantedHeight);else bottom=Math.min(1,top+wantedHeight);
  const correctedWidth=(bottom-top)*image.sourceHeight*target/image.sourceWidth;
  if(handle.includes('l'))left=Math.max(0,right-correctedWidth);else right=Math.min(1,left+correctedWidth);
 }
 crop={x:left,y:top,w:right-left,h:bottom-top};refreshCrop();
}
function moveTo(x:number,y:number){crop={...crop,x:Math.min(1-crop.w,Math.max(0,x)),y:Math.min(1-crop.h,Math.max(0,y))};refreshCrop();}

// ---- Page selection ----
function formatPages(pages:number[]){
 const ranges:string[]=[];let start=0,previous=0;
 for(const page of [...pages].sort((a,b)=>a-b)){if(start&&page===previous+1){previous=page;continue;}if(start)ranges.push(start===previous?`${start}`:`${start}-${previous}`);start=previous=page;}
 if(start)ranges.push(start===previous?`${start}`:`${start}-${previous}`);return ranges.join(', ');
}
function syncThumbsFromField(field:HTMLInputElement){
 pickedPages.clear();
 for(const part of field.value.split(',')){const match=/^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part);if(!match)continue;const a=Number(match[1]),b=Number(match[2]||match[1]);for(let page=a;page<=b&&page-a<1000;page++)pickedPages.add(page);}
 document.querySelectorAll<HTMLElement>('.page-thumb[data-page-number]').forEach(thumb=>thumb.setAttribute('aria-pressed',String(pickedPages.has(Number(thumb.dataset.pageNumber)))));
}
function togglePage(page:number){
 if(pickedPages.has(page))pickedPages.delete(page);else pickedPages.add(page);
 document.querySelector<HTMLElement>(`.page-thumb[data-page-number="${page}"]`)?.setAttribute('aria-pressed',String(pickedPages.has(page)));
 const form=document.querySelector<HTMLFormElement>('#processing-form');if(!form)return;
 const mode=form.querySelector<HTMLSelectElement>('select[name="mode"]');
 if(mode&&activeTool==='split-pdf'&&mode.value!=='selected'){mode.value='selected';syncProcessingOptions(form);}
 const field=form.querySelector<HTMLInputElement>('input[name="pages"]:not([disabled])');if(field)field.value=formatPages([...pickedPages]);
}

// Event delegation, installed once for the lifetime of the window.
let bound=false;
export function bindCanvas(root:HTMLElement,context:()=>{tool:string;files:FileItem[]},cropChanged:()=>void){
 onCropChange=cropChanged;
 const sync=()=>{const current=context();activeTool=current.tool;activeFiles=current.files;};
 if(bound)return;bound=true;
 let drag:{mode:'move'|string;startX:number;startY:number;x:number;y:number;pointer:number}|null=null;
 root.addEventListener('pointerdown',event=>{
  const target=event.target as HTMLElement,frame=target.closest<HTMLElement>('.canvas-frame.is-cropping');if(!frame||event.button!==0)return;
  sync();const handle=target.closest<HTMLElement>('[data-handle]')?.dataset.handle;
  if(!handle&&!target.closest('.crop-box'))return;
  event.preventDefault();frame.setPointerCapture(event.pointerId);
  drag={mode:handle||'move',startX:event.clientX,startY:event.clientY,x:crop.x,y:crop.y,pointer:event.pointerId};
  target.closest<HTMLElement>('.crop-box')?.focus({preventScroll:true});
 });
 root.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.pointer)return;
  const frame=root.querySelector<HTMLElement>('.canvas-frame.is-cropping');if(!frame)return;const rect=frame.getBoundingClientRect();
  if(drag.mode==='move')moveTo(drag.x+(event.clientX-drag.startX)/rect.width,drag.y+(event.clientY-drag.startY)/rect.height);
  else resizeFrom(drag.mode,(event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height,rect);
 });
 const end=(event:PointerEvent)=>{if(drag&&event.pointerId===drag.pointer)drag=null;};
 root.addEventListener('pointerup',end);root.addEventListener('pointercancel',end);
 root.addEventListener('keydown',event=>{
  const box=(event.target as HTMLElement).closest('.crop-box');if(!box)return;
  const step=event.shiftKey?.02:.005,moves:Record<string,[number,number]>={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
  const move=moves[event.key];if(!move)return;event.preventDefault();sync();moveTo(crop.x+move[0],crop.y+move[1]);
 });
 root.addEventListener('click',event=>{
  const target=event.target as HTMLElement;
  const ratioButton=target.closest<HTMLButtonElement>('[data-ratio]');if(ratioButton){sync();setRatio(ratioButton.dataset.ratio!);return;}
  const thumb=target.closest<HTMLElement>('.page-thumb[data-page-number]');if(thumb){sync();togglePage(Number(thumb.dataset.pageNumber));}
 });
 root.addEventListener('input',event=>{
  const field=event.target as HTMLInputElement;
  if(field.name==='pages'&&field.closest('#processing-form')){sync();syncThumbsFromField(field);}
 });
}
