// Isolate resampling from model inference before choosing a Desktop path.
import {chromium} from 'playwright';import {createCanvas,loadImage} from '@napi-rs/canvas';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const browser=await chromium.launch({...(process.env.SORA_BROWSER_EXECUTABLE?{executablePath:process.env.SORA_BROWSER_EXECUTABLE}:{channel:process.env.SORA_BROWSER_CHANNEL||'msedge'}),headless:true});
const results=[];
try{
 const page=await browser.newPage();await page.route('**/*',route=>route.abort());
 for(const name of ['product','hair','soft-alpha']){
  const input=await readFile('.artifacts/astra-complex/'+name+'.png'),source=await loadImage(input);
  const width=1024,height=640,top=192,canvas=createCanvas(1024,1024),context=canvas.getContext('2d');
  context.fillStyle='white';context.fillRect(0,0,1024,1024);context.drawImage(source,0,top,width,height);
  const desktop=context.getImageData(0,0,1024,1024).data;
  const result=await page.evaluate(async({bytes,width,height,top,native,name})=>{
   const image=await createImageBitmap(new Blob([new Uint8Array(bytes)])),canvas=new OffscreenCanvas(1024,1024),ctx=canvas.getContext('2d');
   ctx.fillStyle='white';ctx.fillRect(0,0,1024,1024);ctx.drawImage(image,0,top,width,height);image.close();const web=ctx.getImageData(0,0,1024,1024).data,desktop=atob(native);
   let sum=0,max=0;for(let i=0;i<web.length;i++){const delta=Math.abs(web[i]-desktop.charCodeAt(i));sum+=delta;max=Math.max(max,delta);}
   return {fixture:name,rgbaMAE:sum/web.length,maxDifference:max};
  },{bytes:[...input],width,height,top,native:Buffer.from(desktop).toString('base64'),name});
  results.push(result);console.log(JSON.stringify(result));
 }
 await mkdir('.artifacts/parity',{recursive:true});await writeFile('.artifacts/parity/background-canvas.json',JSON.stringify({scope:'Browser Canvas and installed native Canvas letterbox, fixed synthetic 1600x1000 fixtures; preprocessing only',results},null,2));
}finally{await browser.close();}
