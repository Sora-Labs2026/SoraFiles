// Measurement-only UX audit of the Desktop interface on the engines it ships
// with: Edge/WebView2 (Windows) and WebKit (macOS WKWebView, Linux WebKitGTK).
// Uses a fake native bridge with real-looking previews. Prints numbers only.
// node desktop/scripts/build-ui.mjs && node desktop/tests/ux-matrix-desktop.mjs
import {chromium,webkit} from 'playwright';import {createServer} from 'node:http';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';import {once} from 'node:events';
import {createCanvas} from '@napi-rs/canvas';

const folder=resolve('.artifacts/desktop-ui');
const server=createServer(async(req,res)=>{try{const path=resolve(folder,'.'+new URL(req.url,'http://x').pathname.replace(/\/$/,'/index.html'));if(!path.startsWith(folder+sep))throw Error('path');res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'}[extname(path)]||'application/octet-stream'});res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
server.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+server.address().port;

// Preview images: a landscape photo-like gradient and an A4 page with text lines.
const photo=(()=>{const c=createCanvas(1600,1000),g=c.getContext('2d'),gr=g.createLinearGradient(0,0,1600,1000);gr.addColorStop(0,'#3b82f6');gr.addColorStop(1,'#f59e0b');g.fillStyle=gr;g.fillRect(0,0,1600,1000);g.fillStyle='#14532d';g.beginPath();g.moveTo(0,1000);g.lineTo(600,500);g.lineTo(1100,850);g.lineTo(1600,600);g.lineTo(1600,1000);g.fill();return 'data:image/jpeg;base64,'+c.toBuffer('image/jpeg',80).toString('base64');})();
const page=(()=>{const c=createCanvas(420,594),g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,420,594);g.fillStyle='#94a3b8';for(let y=60;y<540;y+=22)g.fillRect(40,y,y%88?300:220,8);return 'data:image/png;base64,'+c.toBuffer('image/png').toString('base64');})();

const tools=JSON.parse(await readFile('desktop/shared/tool-metadata.json','utf8'));
const imageFormats=new Set(['JPG','JPEG','PNG','WEBP','HEIC']);
const SIZES={'min-760':[760,600],'laptop125-1093':[1093,614],'default-1180':[1180,900],'hd150-1280':[1280,720],'1440':[1440,900],'1920':[1920,1080]};
const ENGINES={windows:[chromium,{channel:'msedge'}],'macos-linux':[webkit,{}]};

function measure(){
 const vw=innerWidth,vh=innerHeight,out={};
 const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity>0.05&&r.width>0&&r.height>0;};
 const label=el=>{const t=(el.getAttribute('aria-label')||el.textContent||el.getAttribute('title')||el.id||'').trim().replace(/\s+/g,' ').slice(0,36);const c=typeof el.className==='string'&&el.className.trim()?'.'+el.className.trim().split(/\s+/)[0]:'';return `${el.tagName.toLowerCase()}${el.id?'#'+el.id:c}${t?` "${t}"`:''}`;};
 const clipsX=el=>{for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement)if(getComputedStyle(p).overflowX!=='visible')return true;return false;};
 out.overflowX=document.documentElement.scrollWidth-vw;out.overflowY=document.documentElement.scrollHeight-vh;
 const all=[...document.body.querySelectorAll('*')].filter(visible).filter(el=>!el.closest('details:not([open]) > :not(summary)'));
 out.offscreen=all.filter(el=>{const r=el.getBoundingClientRect();return (r.right>vw+2||r.left<-2)&&!clipsX(el);}).slice(0,6).map(label);
 const interactive=all.filter(el=>el.matches('a[href],button,select,textarea,input:not([type=hidden]):not([type=file]),[role=button],[role=tab],summary'));
 out.under24=interactive.filter(el=>!el.matches('input[type=radio],input[type=checkbox]')).map(el=>[el,el.getBoundingClientRect()]).filter(([,r])=>r.width<24||r.height<24).slice(0,8).map(([el,r])=>`${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
 const texts=all.filter(el=>[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1));
 out.tiny=texts.filter(el=>parseFloat(getComputedStyle(el).fontSize)<11).slice(0,6).map(el=>`${label(el)} ${getComputedStyle(el).fontSize}`);
 out.truncated=texts.filter(el=>el.scrollWidth>el.clientWidth+1&&getComputedStyle(el).overflow!=='visible'&&getComputedStyle(el).textOverflow!=='ellipsis').slice(0,6).map(label);
 out.clippedText=texts.filter(el=>{const s=getComputedStyle(el);return el.scrollHeight>el.clientHeight+2&&s.overflowY==='hidden'&&!s.webkitLineClamp;}).slice(0,6).map(label);
 const clipped=(el,x,y)=>{for(let a=el.parentElement;a&&a!==document.body;a=a.parentElement){const o=getComputedStyle(a).overflowY;if(o==='auto'||o==='scroll'||o==='hidden'){const b=a.getBoundingClientRect();if(y<b.top||y>b.bottom||x<b.left||x>b.right)return true;}}return false;};
 const box=document.querySelector('.workspace-grid>.workspace-panel');out.optionsBox=box?{visible:Math.round(box.clientHeight),content:Math.round(box.scrollHeight)}:null;
 out.covered=interactive.filter(el=>{const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;if(x<0||y<0||x>vw||y>vh||clipped(el,x,y))return false;const hit=document.elementFromPoint(x,y);return hit&&hit!==el&&!el.contains(hit)&&!hit.contains(el)&&!(hit.closest('label')&&hit.closest('label').contains(el));}).slice(0,6).map(el=>{const r=el.getBoundingClientRect();return `${label(el)} under ${label(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))}`;});
 const run=[...document.querySelectorAll('main button.primary,main .primary,main button[type=submit],main [data-action="process"]')].find(visible);
 if(run){const r=run.getBoundingClientRect();out.primary={label:label(run),inView:r.top>=0&&r.bottom<=vh,top:Math.round(r.top),disabled:run.disabled===true};}
 const scroller=[...document.querySelectorAll('main,main *')].find(el=>el.scrollHeight>el.clientHeight+4&&['auto','scroll'].includes(getComputedStyle(el).overflowY));
 out.mainScroll=scroller?{el:label(scroller),extra:scroller.scrollHeight-scroller.clientHeight}:null;
 const canvas=[...document.querySelectorAll('.canvas-frame,.canvas-stage,.page-grid,.stage')].find(visible);
 if(canvas){const r=canvas.getBoundingClientRect();out.canvas={w:Math.round(r.width),h:Math.round(r.height),fitsX:r.left>=-1&&r.right<=vw+1,fitsY:r.top>=-1&&r.bottom<=vh+1};}
 return out;
}

const results=[];await mkdir('test-results/ux-matrix',{recursive:true});
const only=process.argv.includes('--engine')?process.argv[process.argv.indexOf('--engine')+1]:null;
for(const [engineName,[engine,launch]] of Object.entries(ENGINES)){
 if(only&&only!==engineName)continue;
 const browser=await engine.launch(launch);
 for(const [sizeName,[w,h]] of Object.entries(SIZES)){
  const context=await browser.newContext({viewport:{width:w,height:h}});const tab=await context.newPage();const errors=[];tab.on('pageerror',e=>errors.push(e.message.slice(0,120)));
  await tab.addInitScript(({photo,page})=>{
   const listeners=[];window.__kind='pdf';
   const files={pdf:[{id:'a'.repeat(32),name:'Quarterly report.pdf',format:'PDF',validated:true,bytes:812345},{id:'b'.repeat(32),name:'Appendix.pdf',format:'PDF',validated:true,bytes:212345}],image:[{id:'c'.repeat(32),name:'Mountain lake.jpg',format:'JPG',validated:true,bytes:4989331}]};
   const reply=m=>{let result,ok=true,error;switch(m.method){
    case 'getState':result={language:'en',locale:'en',platform:'windows',output:'source',theme:'light',startup:false,startupAvailable:true,shellEntry:true,shellEntryAvailable:true,license:'active',plan:'personal-monthly',expiresAt:1900000000,version:'0.1.2'};break;
    case 'licenseStatus':result={license:'active',plan:'personal-monthly',expiresAt:1900000000};break;
    case 'selectFiles':result={files:files[window.__kind],rejected:false};break;
    case 'previewSelection':result={previews:window.__kind==='image'?[{index:0,kind:'image',src:photo,width:1600,height:1000,sourceWidth:4000,sourceHeight:2500}]:[0,1].map(index=>({index,kind:'pdf',pages:6,thumbs:[1,2,3,4,5,6].map(p=>({page:p,src:page,width:420,height:594}))}))};break;
    case 'releaseSelection':result={released:true};break;case 'supportDetails':result={supportDeviceId:'a'.repeat(43)};break;
    case 'ratingStatus':result={rating:{subject:m.params?.subject,count:0,average:null,userRating:null}};break;
    default:ok=false;error='Unavailable';}
    setTimeout(()=>listeners.forEach(fn=>fn({data:{protocol:1,id:m.id,ok,result,error}})),0);};
   window.chrome=window.chrome||{};Object.defineProperty(window.chrome,'webview',{value:{postMessage:reply,addEventListener:(_n,fn)=>listeners.push(fn)}});
  },{photo,page});
  const row={engine:engineName,size:sizeName,screens:{}};
  try{
   await tab.goto(url);await tab.locator('[data-action="select"]').first().waitFor();await tab.waitForTimeout(400);
   row.screens.home=await tab.evaluate(measure);
   for(const kind of ['pdf','image']){
    await tab.evaluate(k=>{window.__kind=k;},kind);
    const pick=tools.filter(t=>kind==='image'?t.inputFormats.some(f=>imageFormats.has(f)):t.inputFormats.includes('PDF'));
    for(const tool of pick){
     await tab.locator('.sidebar [data-page="tools"]').first().click();
     const card=tab.locator(`[data-tool="${tool.id}"]`).first();if(!await card.count()){row.screens[tool.id]={missing:true};continue;}
     await card.click();await tab.waitForTimeout(250);
     const choose=tab.locator('main [data-action="select"]').first();if(await choose.isVisible().catch(()=>false)){await choose.click();}
     await tab.waitForTimeout(700);row.screens[tool.id]=await tab.evaluate(measure);
     const clear=tab.locator('main [data-action="clear"]').first();if(await clear.isVisible().catch(()=>false))await clear.click();
    }
   }
   for(const pageName of ['license','settings']){await tab.locator(`.sidebar [data-page="${pageName}"]`).first().click();await tab.waitForTimeout(400);row.screens[pageName]=await tab.evaluate(measure);}
  }catch(e){row.error=e.message.split('\n')[0].slice(0,160);}
  row.pageErrors=[...new Set(errors)].slice(0,3);results.push(row);
  const bad=Object.entries(row.screens).filter(([,m])=>!m.missing&&(m.overflowX>1||m.offscreen.length||m.under24.length||m.covered.length||m.clippedText.length||(m.primary&&!m.primary.inView)||(m.canvas&&(!m.canvas.fitsX||!m.canvas.fitsY))));
  console.log(`${engineName.padEnd(12)} ${sizeName.padEnd(15)} screens=${Object.keys(row.screens).length} flagged=${bad.length}${row.error?' ERROR '+row.error:''}${row.pageErrors.length?' pageErrors='+row.pageErrors.length:''} ${bad.slice(0,8).map(([n,m])=>`${n}[${[m.overflowX>1&&'ovX',m.offscreen.length&&'off',m.under24.length&&'tap',m.covered.length&&'cov',m.clippedText.length&&'clip',m.primary&&!m.primary.inView&&'btnHidden',m.canvas&&(!m.canvas.fitsX||!m.canvas.fitsY)&&'canvas'].filter(Boolean).join(',')}]`).join(' ')}`);
  await context.close();
 }
 await browser.close();
}
await writeFile('test-results/ux-matrix/desktop.json',JSON.stringify(results,null,1));server.close();
console.log('DESKTOP UX MATRIX written to test-results/ux-matrix/desktop.json');
