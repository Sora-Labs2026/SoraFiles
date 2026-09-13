export const connectedTools=new Set(['merge-pdf','split-pdf','rotate-pdf','remove-pages','page-numbers','watermark-pdf','jpg-to-pdf','image-converter','compress-image','resize-image','edit-image','pdf-to-jpg']);
const number=(label:string,name:string,value:number,min:number,max:number)=>`<label>${label}<input name="${name}" type="number" value="${value}" min="${min}" max="${max}" required></label>`;
const labels:Record<string,string>={jpeg:'JPG',png:'PNG',webp:'WebP',each:'One file per page','odd-even':'Odd and even pages','bottom-center':'Bottom centre','bottom-left':'Bottom left','bottom-right':'Bottom right','top-center':'Top centre',a4:'A4',letter:'US Letter',image:'Fit the image',auto:'Match the image',portrait:'Portrait',landscape:'Landscape',no:'No',yes:'Yes','0':'No rotation','90':'90°','180':'180°','270':'270°','150':'Standard','300':'High'};
const choice=(label:string,name:string,values:string[])=>`<label>${label}<select name="${name}">${values.map(value=>`<option value="${value}">${labels[value]||value}</option>`).join('')}</select></label>`;
export function processingOptions(tool:string){
 let fields='';
 if(tool==='pdf-to-jpg')fields=choice('Image format','format',['jpeg','png'])+choice('Image resolution','dpi',['150','300'])+'<p>Each page becomes an image. Multiple pages are saved together in a ZIP file.</p>';
 if(tool==='merge-pdf')fields='<p>Files are merged in the order shown above. Add them in your preferred order.</p>';
 if(tool==='split-pdf')fields=choice('Split into','mode',['each','odd-even']);
 if(tool==='rotate-pdf')fields=number('Page number','page',1,1,1000)+choice('Rotate clockwise','angle',['90','180','270']);
 if(tool==='remove-pages')fields=number('Page to remove','page',1,1,1000);
 if(tool==='page-numbers')fields=number('Start numbering at','start',1,1,999999)+choice('Position','position',['bottom-center','bottom-left','bottom-right','top-center']);
 if(tool==='watermark-pdf')fields='<label>Watermark text<input name="text" type="text" maxlength="256" required placeholder="e.g. DRAFT"></label>'+number('Text size','size',42,6,144);
 if(tool==='jpg-to-pdf')fields=choice('Page size','paper',['a4','letter','image'])+choice('Orientation','orientation',['auto','portrait','landscape']);
 if(['image-converter','resize-image','edit-image'].includes(tool))fields+=choice('Save as','format',['png','jpeg','webp']);
 if(tool==='compress-image'||tool==='image-converter')fields+=number('JPEG / WebP quality','quality',85,40,100);
 if(tool==='resize-image')fields+=number('Maximum width in pixels','width',1600,1,16000)+'<p>Height adjusts to keep the original proportions. Smaller images stay their original size.</p>';
 if(tool==='edit-image')fields+=choice('Rotate clockwise','rotation',['0','90','180','270'])+choice('Mirror horizontally','flop',['no','yes']);
 return `<form id="processing-form" class="panel processing-options"><h2>Options</h2><div class="option-fields">${fields}</div><button class="primary" type="submit">Process files</button></form>`;
}
export function readProcessingOptions(form:HTMLFormElement,tool:string){
 const fields=new FormData(form),text=(name:string)=>String(fields.get(name)||''),num=(name:string)=>Number(text(name));
 switch(tool){
  case 'pdf-to-jpg':return {format:text('format'),dpi:num('dpi'),quality:95};
  case 'merge-pdf':return {};
  case 'split-pdf':return {mode:text('mode')};
  case 'rotate-pdf':return {rotations:[{pageIndex:num('page')-1,angle:num('angle')}]};
  case 'remove-pages':return {remove:[num('page')-1]};
  case 'page-numbers':return {start:num('start'),position:text('position')};
  case 'watermark-pdf':return {text:text('text'),size:num('size')};
  case 'jpg-to-pdf':return {paper:text('paper'),orientation:text('orientation')};
  case 'image-converter':return {format:text('format'),quality:num('quality')};
  case 'compress-image':return {quality:num('quality')};
  case 'resize-image':return {format:text('format'),width:num('width')};
  case 'edit-image':return {format:text('format'),rotation:num('rotation'),flop:text('flop')==='yes'};
  default:throw Error('This tool is not connected yet');
 }
}
