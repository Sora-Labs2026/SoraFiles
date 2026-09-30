// No downloads or user files. Each run creates only synthetic fixtures and uses
// existing hash-pinned assets in a separate system-WebView component/profile.
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';import {spawn} from 'node:child_process';
import {Document,Paragraph,Packer} from 'docx';import * as XLSX from 'xlsx';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
if(process.platform!=='win32')throw Error('This diagnostic requires Windows WebView2');
const root=resolve('.artifacts/office-component');await mkdir(root,{recursive:true});
const malformed=process.argv.includes('--malformed');
const run=await mkdtemp(join(root,'run-')),sdk=resolve('.artifacts/desktop-webview2');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const assets={
 'soffice.js':['5143e5354f470b87f86ba272bcfef857bd13e6f07b59666e48a7ccb89643cd77',858124],
 'soffice.wasm':['9ebd9a487e849a24b9c69f843ebdb451709c27b7722c010e36846433474a5bd4',161667499],
 'soffice.data.js.metadata':['5d9d909d0b9b38443c0f19704032d0fc12d654f6c9c24c2c3b237739c4848ae3',215180],
 'soffice.data':['3dab0a5448e599dccc1b1e69f4f86ea9eb30777c3f1ed7b9c386a5f4163e361c',99520604]
};
const resources=[];
async function resource(url,path,pin){const bytes=await readFile(path);const sha256=hash(bytes);if(pin&&(sha256!==pin[0]||bytes.length!==pin[1]))throw Error('Cached asset integrity failed');resources.push({url,path:resolve(path),sha256});}
for(const [name,pin] of Object.entries(assets))await resource('/engine/'+name,join('.artifacts/desktop-probe-cache',hash('https://cdn.zetaoffice.net/zetaoffice_latest/'+name)),pin);
for(const name of ['index.html','runtime.mjs','worker.mjs','import-policy.mjs'])await resource('/'+name,join('desktop/office-host',name));
for(const name of ['zetaHelper.js','zeta.js'])await resource('/vendor/'+name,join('public/vendor/zetajs/1.2.0',name));
await writeFile(join(run,'input.docx'),await Packer.toBuffer(new Document({sections:[{children:[new Paragraph('SoraFiles Office invoice 4827')]}]})));
if(malformed)await writeFile(join(run,'input.docx'),Buffer.from([0x50,0x4b,3,4,0xff,0,0,0]));
const sheet=XLSX.utils.aoa_to_sheet([['SoraFiles Invoice','Amount'],['Invoice 7631',42]]);sheet.B3={t:'n',f:'B2*2',v:84};sheet['!ref']='A1:B3';
sheet['!cols']=[{wch:28},{wch:14}];
const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Invoice');await writeFile(join(run,'input.xlsx'),XLSX.write(book,{type:'buffer',bookType:'xlsx'}));
for(const ext of ['docx','xlsx'])await resource('/fixture/input.'+ext,join(run,'input.'+ext));
await writeFile(join(run,'resources.json'),JSON.stringify({resources}));
async function execute(program,args,timeout){
 const child=spawn(program,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';
 for(const stream of [child.stdout,child.stderr])stream.on('data',c=>output=(output+c).slice(-4000));
 let expired=false;const timer=setTimeout(()=>{expired=true;const kill=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});kill.on('error',()=>child.kill());},timeout);
 try{const code=await new Promise((done,fail)=>{child.on('exit',done);child.on('error',fail);});if(expired||code!==0)throw Error(`Office component ${expired?'timeout':'exit '+code}: ${output}`);}finally{clearTimeout(timer);}
}
const exe=join(sdk,'OfficeComponentProbe.exe');
await execute('C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe',['/nologo','/platform:x64','/target:winexe','/out:'+exe,'/reference:System.Web.Extensions.dll','/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/reference:'+join(sdk,'Microsoft.Web.WebView2.Core.dll'),'/reference:'+join(sdk,'Microsoft.Web.WebView2.WinForms.dll'),resolve('desktop/office-host/OfficeComponentProbe.cs')],30000);
const originals=await Promise.all(['docx','xlsx'].map(ext=>readFile(join(run,'input.'+ext)).then(hash)));
let failure;
try{await execute(exe,[join(run,'resources.json'),run],200000);}catch(error){failure=error.message;}
let native;try{native=JSON.parse(await readFile(join(run,'native-result.json'),'utf8'));}catch{}
const documents=[];
if(!failure&&native?.status!=='CONVERTED')failure='Native conversion evidence missing';
try{if(!failure)for(const [kind,expected] of [['writer','4827'],['calc','7631']]){
 const data=await readFile(join(run,kind+'.pdf')),task=getDocument({data:Uint8Array.from(data),verbosity:0,isEvalSupported:false});
 try{const pdf=await task.promise;let text='';for(let p=1;p<=pdf.numPages;p++)text+=(await(await pdf.getPage(p)).getTextContent()).items.map(item=>item.str||'').join(' ');
  if(pdf.numPages<1||!text.includes(expected)||(kind==='calc'&&!text.includes('84')))throw Error('Converted PDF lost expected text/formula value');
  documents.push({kind,pages:pdf.numPages,bytes:data.length,sha256:hash(data),expectedText:true});
 }finally{await task.destroy();}
}}catch(error){failure=error.message;}
for(const [i,ext] of ['docx','xlsx'].entries())if(hash(await readFile(join(run,'input.'+ext)))!==originals[i])throw Error('Diagnostic source changed');
const expectedRejection=malformed&&!!failure&&native?.status==='FAILED'&&native.stage==='writer-import'&&native.outputs===0;
const report={recordedAt:new Date().toISOString(),status:malformed?(expectedRejection?'PASS':'FAILED'):failure?'FAILED':'PASS',scenario:malformed?'malformed-docx':'writer-calc',native,documents,failure,evidence:run,scope:'Synthetic Office component with allowlisted local resources and denied external fetch; not a production tool, comprehensive hostile-input test, redistribution clearance or full parity certification'};
await writeFile(join(root,malformed?'malformed.json':'latest.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(report.status!=='PASS')process.exitCode=1;
