// Some recoverable PDF.js warnings indicate omitted content, even with
// stopAtErrors. Never publish those pages as a successful conversion.
let warning=false,oversizedImage=false;
for(const method of ['log','warn','error'])console[method]=(...parts)=>{warning=true;if(parts.some(part=>typeof part==='string'&&part.includes('maximum allowed size')))oversizedImage=true;};
process.once('message',async({bytes,options})=>{
 try{
  const {rasterPdf}=await import('./pdf-raster-render.mjs');
  const pages=await rasterPdf(bytes,options);
  if(warning){process.send({ok:false,code:oversizedImage?'image':'content'},()=>process.exit(1));return;}
  process.send({ok:true,pages},()=>process.exit(0));
 }catch(error){
  const message=String(error?.message||'');const code=message.includes('Page selection')?'selection':message.includes('processing budget')?'budget':message.includes('resolution')?'resolution':message.includes('maximum allowed size')||oversizedImage?'image':'invalid';
  process.send({ok:false,code},()=>process.exit(1));
 }
});
process.once('disconnect',()=>process.exit(1));
