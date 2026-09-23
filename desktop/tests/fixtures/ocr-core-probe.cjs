// Runs in a separate bundled Node process. Only the copied runtime pack and
// synthetic fixture are available; no repository dependency resolution is used.
const {createRequire}=require('node:module');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {gunzipSync}=require('node:zlib');
const [pack,variant,image]=process.argv.slice(2);
const fromPack=createRequire(join(pack,'package.json'));
(async()=>{
 const core=await fromPack('tesseract.js-core/'+variant)({print:()=>{},printErr:()=>{}});
 core.FS.writeFile('/eng.traineddata',gunzipSync(readFileSync(join(pack,'assets/ocr/lang/eng.traineddata.gz'))));
 core.FS.writeFile('/input',readFileSync(image));
 const api=new core.TessBaseAPI();
 try{
  if(api.Init('/','eng',1,'')!==0)throw Error('Core initialization failed');
  api.SetVariable('user_defined_dpi','150');
  if(api.SetImageFile(1,0)!==0)throw Error('Image decode failed');
  api.Recognize(null);
  const text=api.GetUTF8Text();
  if(!/invoice\s+4827/i.test(text))throw Error('Known text was not recognized');
  console.log(JSON.stringify({variant,status:'PASS',recognizedInvoice:true}));
 }finally{api.End();core.destroy(api);}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
