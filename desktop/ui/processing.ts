import {ocrLanguages} from '../shared/ocr-options.mjs';
import {parsePageSelection} from '../shared/pdf-options.mjs';
import {manualAdjustmentKeys} from '../shared/image-adjustments.mjs';
export const connectedTools=new Set(['merge-pdf','split-pdf','rotate-pdf','remove-pages','page-numbers','watermark-pdf','jpg-to-pdf','image-converter','compress-image','resize-image','edit-image','pdf-to-jpg','pdf-ocr','protect-pdf','metadata-remover','pdf-to-excel','pdf-to-word','heic-to-jpg','compress-pdf','repair-pdf','doc-scanner','remove-background']);
const number=(label:string,name:string,value:number,min:number,max:number)=>`<label>${label}<input name="${name}" type="number" value="${value}" min="${min}" max="${max}" required></label>`;
const adjustmentLabels:Record<string,string>={exposure:'Exposure',highlights:'Highlights',shadows:'Shadows',contrast:'Contrast',brightness:'Brightness',blackPoint:'Black point',definition:'Definition',sharpness:'Sharpness',noiseReduction:'Noise reduction',saturation:'Saturation'};
const labels:Record<string,string>={jpeg:'JPG',png:'PNG',webp:'WebP',each:'One file per page','odd-even':'Odd and even pages','bottom-center':'Bottom centre','bottom-left':'Bottom left','bottom-right':'Bottom right','top-center':'Top centre',a4:'A4',letter:'US Letter',image:'Fit the image',auto:'Match the image',portrait:'Portrait',landscape:'Landscape',no:'No',yes:'Yes','0':'No rotation','90':'90°','180':'180°','270':'270°','150':'Standard','300':'High'};
const choice=(label:string,name:string,values:string[])=>`<label>${label}<select name="${name}" aria-label="${label}">${values.map(value=>`<option value="${value}">${labels[value]||value}</option>`).join('')}</select></label>`;
const range=(label:string)=>`<label>${label}<input name="pages" type="text" value="1" maxlength="4096" required aria-describedby="page-range-help"></label><p id="page-range-help">Use page numbers or ranges, for example 1-3, 5. The same selection applies to each PDF. Every chosen page must exist.</p>`;
const optionalRange=()=>'<label>Pages to export<input name="pages" type="text" maxlength="4096" placeholder="All pages" aria-describedby="export-range-help"></label><p id="export-range-help">Leave blank for all pages, or enter ranges such as 1-3, 5. Pages keep their document order. Every selected page must exist in each PDF.</p>';
const overlayRange=(label:string)=>`<label>${label}<input name="pages" type="text" maxlength="4096" placeholder="All pages" aria-describedby="overlay-range-help"></label><p id="overlay-range-help">Leave blank for all pages, or enter ranges such as 1-3, 5. The same selection applies to each PDF; every selected page must exist.</p>`;
const colour=(value:string)=>`<label>Text colour<input name="color" type="color" value="${value}"></label>`;
Object.assign(labels,{enhanced:'Enhanced',original:'Original colours',color:'Colour',grayscale:'Grayscale',bw:'Black and white',contrast:'High contrast',receipt:'Receipt'});
Object.assign(labels,{'top-left':'Top left','top-right':'Top right',number:'1, 2, 3',page:'Page 1, Page 2',total:'Page 1 of 3',roman:'I, II, III'});
labels.ltr='Left to right';labels.rtl='Right to left';
labels.selected='Selected pages in one PDF';labels.every='A fixed number of pages per file';
export function syncProcessingOptions(form:HTMLFormElement){
 const mode=new FormData(form).get('mode');
 form.querySelectorAll<HTMLElement>('[data-split-option]').forEach(group=>{
  const active=group.dataset.splitOption===mode;group.hidden=!active;
  group.querySelectorAll<HTMLInputElement>('input').forEach(input=>input.disabled=!active);
 });
}
export function processingOptions(tool:string){
 let fields='';
 if(tool==='remove-background')fields='<p>Remove the background from still JPG, PNG or WebP images, up to 64 MB and 12 megapixels each. A transparent PNG is saved with existing transparency preserved.</p><p>Review hair, fine edges, glass and low-contrast areas. Manual mask editing is not available yet.</p>';
 if(tool==='doc-scanner')fields='<p>Combine 1 to 20 still JPG, PNG or WebP images in the order shown. Up to 12 megapixels and 64 MB per image, 60 megapixels and 256 MB together. Originals are kept.</p><p>Review faint markings after filtering. Camera capture, perspective cropping and searchable text are not available yet.</p>'+choice('Scan filter','filter',['enhanced','original','color','grayscale','bw','contrast','receipt'])+choice('Rotate clockwise','rotation',['0','90','180','270'])+choice('Page size','paper',['a4','letter','image']);
 if(tool==='repair-pdf')fields='<p>Rewrite readable PDF structure, up to 64 MB and 100 pages. This may fix broken cross-reference information. Missing or truncated data cannot be recovered.</p><p>Encrypted or digitally signed PDFs are not processed. Review every page, attachment and form in the saved copy.</p>';
 if(tool==='compress-pdf')fields='<p>Compress PDF structure without reducing image resolution, up to 64 MB and 1000 pages. Encrypted or digitally signed PDFs are not processed.</p><p>If no smaller result is found, an unchanged copy is saved. Image recompression and target-size controls are not available yet.</p>';
 if(tool==='heic-to-jpg')fields=number('JPG quality','quality',90,40,100)+'<p>Convert the primary photo from each still HEIC file, up to 64 MB and 25 megapixels. Additional images, sequences, HDR/depth data and metadata are not exported. Review orientation and colour before sharing.</p>';
 if(tool==='pdf-to-word')fields='<p>Convert selectable text to an editable Word document, up to 60 pages and 64 MB per PDF. Every page must contain text; scanned and blank pages are not supported yet.</p><p>Source page breaks are kept. Images, forms, annotations and original layout are not copied. Review reading order and tables.</p>'+choice('Text direction','direction',['ltr','rtl']);
 if(tool==='pdf-to-excel')fields='<p>Extract tables from selectable PDF text into an Excel workbook. Each detected table gets its own sheet. Up to 100 pages and 64 MB per PDF.</p><p>Values stay as text to preserve identifiers, dates and number formatting. Review table alignment before using the workbook. Scanned tables and full-page visual sheets are not supported yet.</p>';
 if(tool==='metadata-remover')fields='<p>Clean document properties from DOCX, XLSX and PPTX files, document properties and XMP from unencrypted PDFs, and metadata from still JPG, PNG and WebP images, up to 64 MB each. Encrypted, digitally signed and macro-enabled Office files are not supported.</p><p>Image data is kept when safe. Orientation or colour conversion can require re-encoding; the result explains which was used. Visible content, comments, tracked changes, PDF annotations and attachments can still contain personal details. This tool does not redact content.</p>';
 if(tool==='protect-pdf')fields='<label>Opening password<input name="password" type="password" autocomplete="new-password" maxlength="127" required></label><label>Confirm password<input name="confirmation" type="password" autocomplete="new-password" maxlength="127" required></label><p>Protect each selected PDF with this password. Keep it safe: SoraFiles cannot recover it. Already protected PDFs are not changed.</p>';
 if(tool==='pdf-ocr')fields=`<p>Read text from PDFs and still JPG, PNG or WebP images. PDFs can contain up to 100 pages and 256 MB; images up to 25 megapixels and 64 MB.</p><label>Document language<select name="language">${Object.entries(ocrLanguages).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><label>Save as<select name="format"><option value="txt">Text file</option><option value="pdf">Searchable PDF</option></select></label><p>Choose the language used in the document. Review recognized text for mistakes. Searchable copies contain page images and recognized text; original forms and signatures are not retained.</p>`;
 if(tool==='pdf-to-jpg')fields=choice('Image format','format',['jpeg','png'])+choice('Image resolution','dpi',['150','300'])+number('JPG quality','quality',95,40,100)+optionalRange()+'<p>Each selected page becomes an image. Multiple pages are saved together in a ZIP file using their original page numbers. JPG quality does not affect lossless PNG output.</p>';
 if(tool==='merge-pdf')fields='<p>Files are merged in the order shown above. Use Move up or Move down to change it.</p>';
 if(tool==='split-pdf')fields=choice('Split into','mode',['each','odd-even','selected','every'])+`<div data-split-option="selected" hidden>${range('Pages to extract')}</div><div data-split-option="every" hidden>${number('Pages per file','every',2,1,1000)}</div>`;
 if(tool==='rotate-pdf')fields=range('Pages to rotate')+choice('Rotate clockwise','angle',['90','180','270']);
 if(tool==='remove-pages')fields=range('Pages to remove');
 if(tool==='page-numbers')fields=number('Start numbering at','start',1,1,999999)+choice('Position','position',['bottom-center','bottom-left','bottom-right','top-center','top-left','top-right'])+choice('Number format','format',['number','page','total','roman'])+number('Text size (points)','size',10,6,72)+number('Page margin (points)','margin',24,4,144)+colour('#333b52')+overlayRange('Pages to number')+number('Skip first pages','skip',0,0,999)+'<p>Selected pages are numbered consecutively in document order after skipping the first pages of the PDF. The total format ends with the last number used, which can differ from the PDF page count. Roman numerals support numbers up to 3999. Review the saved copy; live placement preview is not available yet.</p>';
 if(tool==='watermark-pdf')fields='<label>Watermark text<input name="text" type="text" maxlength="256" required placeholder="e.g. DRAFT"></label>'+number('Text size (points)','size',42,6,144)+number('Opacity (%)','opacity',20,1,100)+number('Angle (degrees)','angle',45,-180,180)+number('Minimum page margin (points)','margin',24,0,144)+colour('#667085')+overlayRange('Pages to watermark')+'<p>Text is centred on each selected page. Positive angles rise from left to right; 0 is horizontal. Use a smaller size or shorter text if it does not fit. Review the saved copy; live placement preview is not available yet.</p>';
 if(tool==='jpg-to-pdf')fields=choice('Page size','paper',['a4','letter','image'])+choice('Orientation','orientation',['auto','portrait','landscape']);
 if(['image-converter','resize-image','edit-image'].includes(tool))fields+=choice('Save as','format',['png','jpeg','webp']);
 if(tool==='compress-image'||tool==='image-converter')fields+=number('JPEG / WebP quality','quality',85,40,100);
 if(tool==='resize-image')fields+=number('Maximum width in pixels','width',1600,1,16000)+'<p>Height adjusts to keep the original proportions. Smaller images stay their original size.</p>';
 if(tool==='edit-image')fields+=choice('Rotate clockwise','rotation',['0','90','180','270'])+choice('Mirror horizontally','flop',['no','yes'])+'<details class="image-adjustments"><summary>Colour and detail</summary><p>Zero keeps each adjustment unchanged. Review the saved copy; live preview and interactive cropping are not available yet.</p><div class="option-fields">'+manualAdjustmentKeys.map((key:string)=>number(adjustmentLabels[key],'adjust-'+key,0,['blackPoint','definition','sharpness','noiseReduction'].includes(key)?0:-100,100)).join('')+'</div><button type="button" class="secondary" data-reset-adjustments>Reset colour and detail</button></details>';
 return `<form id="processing-form" class="panel processing-options"><h2>Options</h2><div class="option-fields">${fields}</div><button class="primary" type="submit">Process files</button></form>`;
}
export function readProcessingOptions(form:HTMLFormElement,tool:string){
 const fields=new FormData(form),text=(name:string)=>String(fields.get(name)||''),num=(name:string)=>Number(text(name));
 switch(tool){
  case 'remove-background':return {};
  case 'doc-scanner':return {filter:text('filter'),rotation:num('rotation'),paper:text('paper')};
  case 'repair-pdf':return {};
  case 'compress-pdf':return {};
  case 'heic-to-jpg':return {quality:num('quality')};
  case 'pdf-to-word':return {direction:text('direction')};
  case 'pdf-to-excel':return {};
  case 'metadata-remover':return {};
  case 'protect-pdf':{const password=text('password');if(!password.trim()||password!==text('confirmation')||new TextEncoder().encode(password.normalize('NFKC')).length>127)throw Error('Enter matching passwords up to 127 UTF-8 bytes.');return {password};}
  case 'pdf-ocr':return {language:text('language'),format:text('format')};
  case 'pdf-to-jpg':return {format:text('format'),dpi:num('dpi'),quality:num('quality'),...(text('pages').trim()?{selected:parsePageSelection(text('pages'),1000)}:{})};
  case 'merge-pdf':return {};
  case 'split-pdf':return {mode:text('mode'),...(text('mode')==='selected'?{selected:parsePageSelection(text('pages'),1000)}:text('mode')==='every'?{every:num('every')}:{})};
  case 'rotate-pdf':return {rotations:parsePageSelection(text('pages'),1000).map((pageIndex:number)=>({pageIndex,angle:num('angle')}))};
  case 'remove-pages':return {remove:parsePageSelection(text('pages'),1000)};
  case 'page-numbers':return {start:num('start'),position:text('position'),format:text('format'),size:num('size'),margin:num('margin'),color:text('color'),skip:num('skip'),...(text('pages').trim()?{selected:parsePageSelection(text('pages'),1000)}:{})};
  case 'watermark-pdf':return {text:text('text'),size:num('size'),opacity:num('opacity')/100,angle:num('angle'),margin:num('margin'),color:text('color'),...(text('pages').trim()?{selected:parsePageSelection(text('pages'),1000)}:{})};
  case 'jpg-to-pdf':return {paper:text('paper'),orientation:text('orientation')};
  case 'image-converter':return {format:text('format'),quality:num('quality')};
  case 'compress-image':return {quality:num('quality')};
  case 'resize-image':return {format:text('format'),width:num('width')};
  case 'edit-image':return {format:text('format'),rotation:num('rotation'),flop:text('flop')==='yes',adjustments:Object.fromEntries(manualAdjustmentKeys.map((key:string)=>[key,num('adjust-'+key)]))};
  default:throw Error('This tool is not connected yet');
 }
}
