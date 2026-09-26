import './tokens.css';
import './styles.css';
import './brand.css';
import {connectedTools,processingOptions,readProcessingOptions,syncProcessingOptions} from './processing';
import {capabilities,relevantActions,searchTools} from '../shared/capabilities.mjs';
import {host,onNativeSelection,onNativeNotice,onNativeLaunch,onLicenseUpdated} from './host';
type Selected={id:string;name:string;format:string|null;validated:boolean;bytes:number};
let batchResults:{source:string;state:string;name?:string;warnings?:string[];cleanupPending?:boolean;outputId?:string}[]=[],savedOutput:{name:string;outputId?:string}|null=null;
const root=document.querySelector<HTMLElement>('#app')!;
const quick={active:(window as Window&{__SORA_QUICK_ACTION__?:boolean}).__SORA_QUICK_ACTION__===true};
const state={trialPending:false,replacement:null as any,replacing:false,launchIntent:null as any,supportDeviceId:'',page:'home',query:'',tool:'',files:[] as Selected[],busy:false,processing:false,error:'',notice:'',license:'not-activated',activationAvailable:false,plan:'',expiresAt:null as number|null,devices:[] as {id:string;current:boolean;active:boolean}[],output:'source',startup:false,startupAvailable:false,shellEntry:false,shellEntryAvailable:false,theme:'system',version:'SoraFiles Desktop',platform:'windows'};
const licenseReady=()=>['active','trial'].includes(state.license);
const systemTheme=window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){document.documentElement.dataset.theme=state.theme==='system'?(systemTheme.matches?'dark':'light'):state.theme;}
systemTheme.addEventListener('change',()=>{if(state.theme==='system')applyTheme();});
const planLabel=()=>state.plan.split('-').map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(' ');
const escape=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const paths:Record<string,string>={home:'M3 10 12 3l9 7v10H3V10Zm6 10v-7h6v7',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',lock:'M6 10h12a2 2 0 0 1 2 2v8H4v-8a2 2 0 0 1 2-2Zm2 0V7a4 4 0 0 1 8 0v3M12 14v3',settings:'m12 3 2 3 4-1 1 4 3 3-3 2 1 4-4 1-4 3-2-3-4 1-1-4-3-3 3-2-1-4 4-1 4-3Zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6',update:'M20 8a8 8 0 1 0 0 8M20 3v5h-5',file:'M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6M9 16h6',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',folder:'M3 6h7l2 3h9v11H3V6',arrow:'M5 12h14m-5-5 5 5-5 5',upload:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',close:'m6 6 12 12M6 18 18 6',check:'m5 12 4 4L19 6',image:'M3 3h18v18H3zM3 16l6-6 5 5 3-3 4 4M15 7h.01',compress:'M3 8h5V3m0 5L3 3m18 5h-5V3m0 5 5-5M3 16h5v5m0-5-5 5m18-5h-5v5m0-5 5 5',merge:'M5 3v5l7 6 7-6V3m-7 11v7m-4-4 4 4 4-4',power:'M12 3v9M6 5a9 9 0 1 0 12 0'};
const icon=(name:string,cls='')=>`<svg class="icon ${cls}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]||paths.file}"/></svg>`;
const toolIcon=(id:string)=>id.includes('compress')?'compress':id==='merge-pdf'?'merge':id.includes('image')||id==='remove-background'||id==='heic-to-jpg'?'image':'file';
const common=['compress-pdf','merge-pdf','image-converter','resize-image','remove-background','pdf-ocr'];
function toolButton(tool:any){return `<button class="tool-card" data-tool="${tool.id}"><span class="tool-icon">${icon(toolIcon(tool.id))}</span><span><strong>${escape(tool.name)}</strong><small>${escape(tool.formats.slice(0,3).join(', '))}${tool.formats.length>3?' + more':''}</small></span>${icon('arrow','card-arrow')}</button>`;}
const feedback=()=>`${state.error?`<div role="alert" class="feedback error">${escape(state.error)}</div>`:''}${state.notice?`<div role="status" class="feedback">${escape(state.notice)}</div>`:''}`;
const outputButtons=(id?:string)=>id&&/^[a-f0-9]{32}$/i.test(id)?`<span class="output-actions"><button class="secondary" data-open-output="${id}">Open result</button><button class="text-button" data-reveal-output="${id}">Open containing folder</button></span>`:'';
function processingResult(result:any,sources:string[]){
 if(result.state==='batch'){
  batchResults=result.results.map((row:any)=>({...row,source:sources[row.index]}));
  const count=(status:string)=>batchResults.filter(row=>row.state===status).length;
  state.notice=`${count('completed')} saved, ${count('failed')} failed, ${count('cancelled')} cancelled. Saved outputs are kept.`;
 }else {state.notice=result.state==='cancelled'?'Processing cancelled.':('Saved '+result.name+'. '+(Array.isArray(result.warnings)?result.warnings.join(' '):''));if(result.state==='completed')savedOutput={name:result.name,outputId:result.outputId};}
}
function restoreJob(job:any){
 if(!job||(!job.busy&&!job.result&&!job.error))return;
 if(typeof job.tool==='string'&&capabilities.some(tool=>tool.id===job.tool)){state.tool=job.tool;state.page='workspace';}
 if(!job.busy){if(job.result)processingResult(job.result,job.sources||[]);if(job.error)state.error=job.error;render();return;}
 state.processing=true;state.busy=true;render();
 const poll=async()=>{
  try{
   const snapshot=await host('processingStatus');
   if(snapshot.busy){setTimeout(poll,750);return;}
   state.processing=false;state.busy=false;
   if(snapshot.result)processingResult(snapshot.result,snapshot.sources||[]);if(snapshot.error)state.error=snapshot.error;
   render();document.querySelector('#announcement')!.textContent=state.error||state.notice;
   void host('licenseStatus').then(status=>{Object.assign(state,status);render();}).catch(()=>{});
  }catch{document.querySelector('#pending-action')!.textContent='Reconnecting to the running job…';setTimeout(poll,1500);}
 };
 void poll();
}
function batchFeedback(){return batchResults.length?`<section class="panel" aria-label="Batch results"><h2>Batch results</h2><ul>${batchResults.map(row=>`<li><strong>${escape(row.source)}</strong>: ${row.state==='completed'?'Saved '+escape(row.name):row.state==='failed'?'Could not process this file. Check the file and options.':'Cancelled before saving.'}${row.warnings?.length?' '+escape(row.warnings.join(' ')):''}${row.cleanupPending?' A temporary file may remain in the output folder.':''}${outputButtons(row.outputId)}</li>`).join('')}</ul></section>`:savedOutput?`<section class="panel"><h2>${escape(savedOutput.name)}</h2>${outputButtons(savedOutput.outputId)}</section>`:'';}
function heading(eyebrow:string,title:string,description:string){return `<header class="page-heading"><p class="eyebrow">${eyebrow}</p><h1 tabindex="-1">${title}</h1><p>${description}</p></header>`;}
function selected(){if(!state.files.length)return '';return `<div class="selected"><div class="section-title"><h2>${state.files.length} ${state.files.length===1?'file':'files'} selected</h2><button class="text-button" data-action="clear">Clear selection</button></div><ul>${state.files.map((f,index)=>`<li>${icon(f.format==='PDF'?'file':'image')}<span>${escape(f.name)}<small>${f.format||'Needs inspection'} · ${new Intl.NumberFormat('en',{maximumFractionDigits:1}).format(f.bytes/1024)} KB</small></span>${state.page==='workspace'&&['merge-pdf','jpg-to-pdf','doc-scanner'].includes(state.tool)?`<span class="selection-order"><button class="icon-button" data-move-up="${escape(f.id)}" aria-label="Move ${escape(f.name)} up" ${index===0?'disabled':''}>&uarr;</button><button class="icon-button" data-move-down="${escape(f.id)}" aria-label="Move ${escape(f.name)} down" ${index===state.files.length-1?'disabled':''}>&darr;</button></span>`:''}<button class="icon-button" data-remove="${escape(f.id)}" aria-label="Remove ${escape(f.name)}">${icon('close')}</button></li>`).join('')}</ul></div>`;}
function dropzone(compact=false){return `<div class="dropzone ${compact?'compact':''}" data-dropzone><span class="drop-icon">${icon('upload')}</span><h2>${state.files.length?'Add more files':'Drop your files here'}</h2><p>PDFs, images and documents. Choose what to do next.</p><button class="primary" data-action="select" ${state.busy?'disabled':''}>${icon('folder')}Choose files</button><small>Your originals stay untouched.</small></div>`;}
function home(){const suggestions=state.files.length?relevantActions(state.files,licenseReady()):capabilities.filter(t=>common.includes(t.id));return `${heading('YOUR FILES. YOUR DEVICE.','File tools for your desktop.','Convert, compress and organize files, right where they are.')}${feedback()}${dropzone(state.files.length>0)}${selected()}<section class="tool-section"><div class="section-title"><h2>${state.files.length?'Works with your selection':'Everyday tools'}</h2><button class="text-button" data-page="tools">All ${capabilities.length} tools ${icon('arrow')}</button></div><div class="tool-grid">${suggestions.filter(t=>capabilities.some(tool=>tool.id===t.id)).map(toolButton).join('')||'<p>No quick action matches this selection. Choose a tool to inspect the files.</p>'}</div></section><p class="privacy-note">${icon('lock')}File processing stays on your device.</p>`;}
function tools(){const list=searchTools(state.query);return `${heading('FIND YOUR NEXT STEP','All tools','One place for your PDFs, images and documents.')}<label class="search-box">${icon('search')}<input id="tool-search" type="search" placeholder="Search tools, e.g. merge PDF" value="${escape(state.query)}" aria-label="Search tools" autocomplete="off"><kbd>${state.platform==='macos'?'⌘ K':'Ctrl K'}</kbd></label><div id="tool-results"><p class="result-count">${list.length} ${list.length===1?'tool':'tools'}</p><div class="tool-grid">${list.map(toolButton).join('')}</div>${!list.length?'<div class="empty"><h2>No tools found</h2><p>Try “PDF”, “image” or “compress”.</p><button class="secondary" data-action="reset-search">Clear search</button></div>':''}</div>`;}
function workspace(){
 const tool=capabilities.find(t=>t.id===state.tool)!;
 const output=state.output==='source'?'Beside each original file':state.output==='downloads'?'Your Downloads folder':state.output==='ask'?'Choose a folder each time':'Your chosen folder';
 const picker=state.files.length?`<div class="workspace-file-actions" data-dropzone><button class="secondary" data-action="select">${icon('folder')}Choose files</button><p>Your originals stay untouched.</p></div>`:dropzone(true);
 const action=!licenseReady()?`<div class="action-bar"><div>${icon('lock')}<span>Check your trial or activate a license to process files.</span></div><button class="primary" data-page="license">View license ${icon('arrow')}</button></div>`:connectedTools.has(state.tool)?processingOptions(state.tool):'<section class="panel"><h2>Tool unavailable</h2><p>This tool is not available in this release.</p></section>';
 return `<button class="text-button back" data-page="tools">← All tools</button><header class="page-heading"><h1 tabindex="-1">${escape(tool.name)}</h1><p>Choose ${escape(tool.formats.join(', '))} files to get started.</p></header>${feedback()}${batchFeedback()}${picker}${selected()}${action}<section class="workspace-output" aria-label="Save location">${icon('folder')}<div><strong>Save results: ${output}</strong><p>Existing files are kept. New results get a number if needed.</p></div><button class="text-button" data-page="settings">Change output settings</button></section>`;
}
function activationForm(){return `<section class="panel"><h2>Already have a license?</h2><p>Find your license key in your purchase email. Check your Spam or Junk folder too. Activation uses one device seat. Unused team seats activate without a replacement fee.</p><form id="license-form"><label for="license-key">License key</label><div class="key-field"><input id="license-key" name="license-key" type="password" autocomplete="off" spellcheck="false" required><button type="button" class="text-button" data-action="reveal-key" aria-controls="license-key" aria-pressed="false">Show</button></div><button type="submit" class="secondary" ${state.busy?'disabled':''}>Activate license</button></form></section>`;}
function supportDetails(){return `<section class="panel"><h2>Replacing a device?</h2><p>Verify your purchase email to replace a lost or failed device. A one-time replacement fee applies to an occupied seat.</p><button class="secondary" data-action="replace-device">Replace device</button><button class="text-button" data-action="support-details">Show this device ID</button>${state.supportDeviceId?`<p class="support-device-id"><code>${escape(state.supportDeviceId)}</code></p>`:''}</section>`;}
function license(){if(state.replacing)return replacementPanel();if(['active','trial','needs-verification'].includes(state.license))return activeLicense()+supportDetails();return `${heading('SORAFILES DESKTOP','Your Desktop license','Your seven-day trial starts automatically on first launch.')}${feedback()}<div class="license-grid"><section class="panel"><h2>Setting up your trial</h2><p>Connect to the internet to finish setting up your trial. Your seven days begin the first time you open SoraFiles.</p></section>${activationForm()}</div>${supportDetails()}`;}
function activeLicense(){
 const needsCheck=state.license==='needs-verification',trial=state.license==='trial'||state.activationAvailable;
 const title=needsCheck?(state.trialPending?'Setting up your trial':trial?'Your trial needs a check':'Your license needs a check'):trial?'Your trial is active':'Desktop is activated';
 const expiry=needsCheck&&!state.trialPending?'Check required':state.expiresAt?new Intl.DateTimeFormat('en',{dateStyle:'medium'}).format(state.expiresAt*1000):state.plan.includes('lifetime')?'No expiry':'Check required';
 return `${heading('SORAFILES DESKTOP',title,'Works offline after setup.')}${feedback()}<section class="panel"><h2>${trial?'7-day trial':escape(planLabel())||'License status'}</h2><p>${trial?'Trial ends':state.plan.includes('lifetime')?'License duration':'Paid through'}: ${escape(expiry)}</p>${trial&&needsCheck?state.trialPending?'<p>Connect to the internet to finish setting up your trial. We will retry automatically.</p>':'<p>Your trial may have ended, or this device could not verify it. You can activate a purchased license below.</p>':''}${!trial?'<div class="license-actions"><button class="secondary" data-action="refresh-license">Check license online</button><button class="text-button" data-action="license-devices">Manage devices</button></div>':''}${state.devices.length?'<ul>'+state.devices.map((d,i)=>'<li>'+(d.current?'This device':'Device '+(i+1))+(d.active?'':' — unavailable')+'</li>').join('')+'</ul>':''}${!trial?'<div class="setting-row"><div><strong>Active on this device</strong><p>To move an occupied seat, verify your purchase email and pay the replacement fee. An unused team seat activates for free.</p></div></div>':''}</section>${trial?activationForm():''}`;
}
function replacementPanel(){
 const flow=state.replacement||{stage:'idle'},fee=flow.fee;
 let content='';
 if(flow.stage==='idle')content=`<p>Verify your email to replace this device. We send a code to the email used for your purchase.</p><form id="replacement-start-form">${state.plan&&state.plan!=='trial'?'':`<label for="replacement-key">License key</label><div class="key-field"><input id="replacement-key" type="password" autocomplete="off" required></div>`}<button type="submit" class="primary">Send verification code</button></form>`;
 if(flow.stage==='email')content=`<p>Enter the eight-digit code sent to <strong>${escape(flow.maskedEmail)}</strong>. It expires in 10 minutes.</p><form id="replacement-verify-form"><label for="replacement-code">Email verification code</label><div class="key-field"><input id="replacement-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{8}" maxlength="8" required></div><button type="submit" class="primary">Verify email</button></form><button class="text-button" data-action="replacement-resend">Resend code</button><p class="privacy-note">Wait at least a minute before resending. Only the newest code works.</p>`;
 if(flow.stage==='verified'){
  const devices=(flow.devices||[]).filter((device:any)=>device.active&&!device.current);
  content=`<p>Email verified. Choose the occupied device seat to replace.</p>${devices.length?`<form id="replacement-pay-form"><label for="replacement-device">Device to replace</label><select id="replacement-device" required>${devices.map((device:any,i:number)=>`<option value="${escape(device.id)}">Device ${i+1} · ${escape(device.id.slice(0,8))}</option>`).join('')}</select><p>One-time replacement fee: <strong>${escape(fee.formatted)} USD${fee.perSeat?' per occupied seat':''}</strong>. Your plan stays the same. After payment, the old device stops working when it next checks its license online.</p><button type="submit" class="primary">Pay ${escape(fee.formatted)} and replace</button></form>`:'<p>No occupied device is available to replace. An unused team seat can be activated from the license screen without a replacement fee.</p>'}<button class="text-button" data-action="replacement-resend">Verify email again</button>`;
 }
 if(flow.stage==='payment')content=`<p>${flow.status==='payment-failed'?'Your payment did not complete.':flow.status==='complete'?'Payment confirmed. Check again to finish activating this device.':'Finish payment in your browser, then check payment here.'}</p><p>Replacement fee: <strong>${escape(fee.formatted)} USD</strong>.</p>${flow.checkoutAvailable?'<button class="secondary" data-action="replacement-checkout">Open payment page</button>':''}<button class="primary" data-action="replacement-status">Check payment</button><button class="text-button" data-action="replacement-resend">Verify email again</button>`;
 if(flow.stage==='complete')content='<p>This device is activated. Your replacement is complete.</p>';
 return `${heading('MANAGE DEVICES','Replace a device','Keep your plan and move an occupied device seat.')}${feedback()}<section class="panel">${content}</section><button class="text-button" data-action="replacement-back">Back to license</button>`;
}

function settings(){return `${heading('YOUR PREFERENCES','Settings','Set up files, quick actions and appearance.')}${feedback()}
 <section class="panel settings-panel"><h2>Files & output</h2><p>Choose where new files are saved.</p><label for="output-mode" class="sr-only">Default output location</label><select id="output-mode">${[['source','Next to original files'],['downloads','Downloads'],['custom','Custom folder'],['ask','Ask each time']].map(([value,label])=>`<option value="${value}" ${state.output===value?'selected':''}>${label}</option>`).join('')}</select>${state.output==='custom'?'<button class="secondary" data-action="folder">Choose folder</button>':''}<div class="setting-row"><div><strong>Keep originals safe</strong><p>New results get a numbered name if one already exists.</p></div><span class="quiet-badge">Always on</span></div></section>
 <section class="panel settings-panel"><h2>Quick actions</h2><div class="setting-row"><div><strong>Keep quick actions available after sign-in</strong><p>${state.startupAvailable?'Make SoraFiles ready when you sign in. You can also change this in Windows Startup Apps settings.':'Sign-in startup is not available on this platform yet.'}</p></div><input type="checkbox" id="startup" aria-label="Keep quick actions available after sign-in" ${state.startup?'checked':''} ${state.startupAvailable?'':'disabled'}></div><div class="setting-row"><div><strong>Show SoraFiles actions in the file manager</strong><p>${state.shellEntryAvailable?(state.platform==='windows'?'Choose Edit with SoraFiles for supported files. On Windows 11, look under Show more options.':state.platform==='macos'?'Choose Edit with SoraFiles in Finder Quick Actions. Actions that need options open a small window.':'Choose Edit with SoraFiles in supported file managers. Restart your file manager after changing this setting.'):'File-manager actions are unavailable on this platform.'}</p></div><input type="checkbox" id="shellEntry" aria-label="Show SoraFiles actions in the file manager" ${state.shellEntry?'checked':''} ${state.shellEntryAvailable?'':'disabled'}></div><p>Closing the window keeps quick actions ready. Choose Quit SoraFiles to exit the app.</p></section>
 <section class="panel settings-panel"><h2>Appearance</h2><div class="setting-row"><label for="theme">Theme</label><select id="theme" aria-label="Appearance">${['system','light','dark'].map(value=>`<option value="${value}" ${state.theme===value?'selected':''}>${value==='system'?'Follow system':value[0].toUpperCase()+value.slice(1)}</option>`).join('')}</select></div></section>`;}
function updates(){return `${heading('BUILT BY SORA LABS','Updates & about','A private space for working with your files.')}${feedback()}<section class="panel about-panel"><img src="/icon-192.png" width="64" height="64" alt=""><h2>SoraFiles Desktop</h2><p>${escape(state.version)}</p><p>This release processes your files locally and keeps the web tools free.</p><button class="secondary" data-action="updates">View release notes</button></section>`;}
function renderFull(){root.innerHTML=`<a class="skip-link" href="#main">Skip to content</a><aside class="sidebar"><div class="brand"><img src="/icon-192.png" alt="" width="36" height="36"><div>SoraFiles<span>DESKTOP</span></div></div><nav aria-label="Main navigation">${[['home','Home','home'],['tools','All tools','grid'],['license','License','lock'],['settings','Settings','settings'],['updates','Updates & about','update']].map(([id,name,glyph])=>`<button aria-label="${name}" data-page="${id}" ${state.page===id||state.page==='workspace'&&id==='tools'?'aria-current="page"':''}>${icon(glyph)}<span>${name}</span></button>`).join('')}</nav><div class="sidebar-bottom"><div class="trial-card"><strong>${licenseReady()?state.license==='trial'?'Trial active':'License active':state.license==='needs-verification'?'License needs attention':'Setting up your trial'}</strong><button class="text-button" data-page="license">${licenseReady()?'Manage license':'View license'}</button></div><button class="quit" data-action="quit" aria-label="Quit SoraFiles" title="Quit SoraFiles">${icon('power')}<span>Quit SoraFiles</span></button><small>SoraFiles Desktop</small></div></aside><main id="main" tabindex="-1">${state.page==='native'?nativeActions():state.page==='home'?home():state.page==='tools'?tools():state.page==='workspace'?workspace():state.page==='license'?license():state.page==='settings'?settings():updates()}</main>`;syncBusy();}
function render(){
 // Preserve in-progress options only across renders of the same quick action.
 // Values are kept for this synchronous render, never in persistent app state.
 const previous=quick.active&&root.querySelector<HTMLElement>('.quick-action')?.dataset.tool===state.tool;
 const fields=previous?Array.from(root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('#processing-form input,#processing-form select')).map(input=>({name:input.name,value:input.value,checked:(input as HTMLInputElement).checked})):[];
 const focused=previous?document.activeElement as HTMLInputElement:null;
 const scroll=previous?root.querySelector('.quick-content')?.scrollTop||0:0;
 const details=previous?Array.from(root.querySelectorAll<HTMLDetailsElement>('details')).map(item=>item.open):[];
 applyTheme();document.body.dataset.quickAction=String(quick.active);
 if(quick.active){
  root.innerHTML=quickActionView();
  for(const field of fields){const input=root.querySelector<HTMLInputElement|HTMLSelectElement>('#processing-form [name="'+CSS.escape(field.name)+'"]');if(input){input.value=field.value;if(input instanceof HTMLInputElement)input.checked=field.checked;}}
  const form=root.querySelector<HTMLFormElement>('#processing-form');if(form)syncProcessingOptions(form);
  root.querySelectorAll<HTMLDetailsElement>('details').forEach((item,index)=>{if(index<details.length)item.open=details[index];});
  syncBusy();
  if(focused?.name)root.querySelector<HTMLElement>('#processing-form [name="'+CSS.escape(focused.name)+'"]')?.focus({preventScroll:true});
  const content=root.querySelector('.quick-content');if(content)content.scrollTop=scroll;
 }else renderFull();
}
function quickActionView(){
 const tool=capabilities.find(item=>item.id===state.tool),workspace=state.page==='workspace'&&tool;
 const finished=!!savedOutput||batchResults.length>0;
 const options=workspace&&licenseReady()&&!finished?processingOptions(state.tool):'';
 const selection=state.files.length?`<details class="quick-files" ${state.tool==='merge-pdf'&&!finished?'open':''}><summary>${state.files.length===1?escape(state.files[0].name):state.files.length+' files selected'}</summary>${selected()}</details>`:'';
 const content=!licenseReady()?'<p>Your trial or license needs a check.</p><button class="secondary" data-page="license">View license</button>':workspace?`${selection}${options}`:nativeActions();
 return `<main id="main" class="quick-action" data-tool="${escape(state.tool)}" tabindex="-1"><header class="quick-heading"><img src="/icon-192.png" alt="" width="26" height="26"><h1 tabindex="-1">${escape(workspace?tool.name:'Edit with SoraFiles')}</h1><button class="icon-button" data-action="open-full" aria-label="Open full desktop app" title="Open full desktop app">${icon('arrow')}</button></header><div class="quick-content">${feedback()}${batchFeedback()}${content}</div><footer class="quick-footer"><span>${state.processing?'Processing files…':finished?'Processing finished':state.output==='source'?'Save beside originals':state.output==='downloads'?'Save to Downloads':state.output==='ask'?'Choose a folder when you run':'Use your saved output folder'}</span>${state.processing?'':`<button class="secondary" data-action="close-quick">${finished?'Done':'Cancel'}</button>${options?'<button class="primary" type="submit" form="processing-form">Run</button>':''}`}</footer></main>`;
}
function nativeActions(){return `${heading('YOUR SELECTED FILES','Edit with SoraFiles','Choose an action for this selection.')}${feedback()}${selected()}<section class="panel"><div class="tool-grid">${(state.launchIntent?.actions||[]).map((action:any)=>`<button class="secondary" data-native-action="${escape(action.id)}">${escape(action.label)}</button>`).join('')}</div></section>`;}
function applyNativeAction(action:any){
 if(!action?.tool){if(quick.active){state.page='native';state.tool='';render();}else navigate(action?.id==='activate'?'license':'home');return;}
 if(!connectedTools.has(action.tool)){state.error='This action is not available in this build.';render();return;}
 state.tool=action.tool;state.page='workspace';render();
 for(const [name,value] of Object.entries(action.options||{})){const input=root.querySelector<HTMLInputElement|HTMLSelectElement>('[name="'+CSS.escape(name)+'"]');if(input&&typeof value!=='object')input.value=String(value);}
}
async function loadNativeLaunch(){const data=await host('getState');quick.active=data.quickAction===true;Object.assign(state,data);batchResults=[];savedOutput=null;state.error='';state.notice=data.notice||'';const previous=root.querySelector<HTMLElement>('.quick-action');if(previous)previous.dataset.tool='';if(data.launchIntent?.action)applyNativeAction(data.launchIntent.action);else if(data.launchIntent?.actions){state.page='native';render();}else{render();restoreJob(data.job);}}
function navigate(page:string){if(quick.active&&!['workspace','native'].includes(page)){void host('openFullApp').then(()=>{quick.active=false;navigate(page);}).catch(error=>{state.error=error.message;render();});return;}state.page=page;state.error='';state.notice='';render();root.querySelector<HTMLElement>('h1')?.focus();}
function syncBusy(){
 document.body.dataset.processing=String(state.processing);
 const quickStatus=root.querySelector('.quick-footer>span');if(quickStatus&&state.processing)quickStatus.textContent='Processing files\u2026';
 document.querySelector<HTMLElement>('#pending-action')!.textContent=state.processing?'Processing files…':'Waiting for Desktop…';
 root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('.option-fields input,.option-fields select').forEach(control=>control.disabled=state.busy);
 const cancel=document.querySelector<HTMLButtonElement>('#cancel-processing');if(cancel)cancel.hidden=!state.processing;
 root.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('[data-action]:not([data-action="reveal-key"]),[data-remove],[data-open-output],[data-reveal-output],select,input[type="checkbox"],button[type="submit"]').forEach(control=>control.disabled=state.busy);
 const startup=root.querySelector<HTMLInputElement>('#startup');if(startup)startup.disabled=state.busy||!state.startupAvailable;
 const shellEntry=root.querySelector<HTMLInputElement>('#shellEntry');if(shellEntry)shellEntry.disabled=state.busy||!state.shellEntryAvailable;
 root.querySelectorAll<HTMLButtonElement>('[data-move-up],[data-move-down]').forEach(control=>{const index=state.files.findIndex(file=>file.id===(control.dataset.moveUp||control.dataset.moveDown));control.disabled=state.busy||(control.dataset.moveUp?index<=0:index>=state.files.length-1);});
 const form=root.querySelector<HTMLFormElement>('#processing-form');if(form&&!state.busy)syncProcessingOptions(form);
 root.setAttribute('aria-busy',String(state.busy));
 document.querySelector<HTMLElement>('#pending-action')!.hidden=!state.busy;
}
function restoreFocus(previous:HTMLElement|null){
 const attributes=['id','data-action','data-remove','data-page','data-open-output','data-reveal-output'];
 const attribute=attributes.find(name=>previous?.hasAttribute(name));
 const replacement=attribute?root.querySelector<HTMLElement>(`[${attribute}="${CSS.escape(previous!.getAttribute(attribute)!)}"]`):null;
 (replacement||root.querySelector<HTMLElement>('h1'))?.focus({preventScroll:true});
}
async function perform(run:()=>Promise<void>){
 if(state.busy)return;
 const page=state.page,origin=document.activeElement as HTMLElement;state.busy=true;state.error='';state.notice='';
 root.querySelectorAll('.feedback').forEach(node=>node.remove());syncBusy();
 try{await run();}catch(error){state.error=error instanceof Error?error.message:'This action could not finish. Try again.';}
 finally{
  state.busy=false;
  // Do not replace a different screen the user opened while waiting.
  if(state.page===page){const focused=document.activeElement===document.body?origin:document.activeElement as HTMLElement;render();restoreFocus(focused);}
  syncBusy();document.querySelector('#announcement')!.textContent=state.page===page?'':state.error||state.notice;
 }
}
function acceptFiles(selection:Selected[]|{files:Selected[];rejected:boolean}){
 const files=Array.isArray(selection)?selection:selection.files;
 if(!Array.isArray(selection)&&selection.rejected)state.error='Some files could not be added. Choose readable, non-empty files on this device, up to 512 MB each and 256 files at a time.';
 if(!files.length)return;
 state.files=[...new Map([...state.files,...files].map(f=>[f.id,f])).values()].slice(0,256);
 if(state.page!=='workspace'&&state.page!=='home'){state.page='home';render();}
}
root.addEventListener('click',event=>{const target=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!target)return;if(target.dataset.page){navigate(target.dataset.page);return;}if(target.dataset.tool){state.tool=target.dataset.tool;navigate('workspace');return;}if(target.dataset.remove){const id=target.dataset.remove;void perform(async()=>{await host('releaseSelection',{ids:[id]});state.files=state.files.filter(f=>f.id!==id);});return;}
 if(target.dataset.moveUp||target.dataset.moveDown){
  if(state.busy)return;const id=target.dataset.moveUp||target.dataset.moveDown,index=state.files.findIndex(file=>file.id===id),next=index+(target.dataset.moveUp?-1:1);
  if(index<0||next<0||next>=state.files.length)return;
  [state.files[index],state.files[next]]=[state.files[next],state.files[index]];
  root.querySelector('.selected')!.outerHTML=selected();syncBusy();
  const attribute=target.dataset.moveUp?'data-move-up':'data-move-down';
  const button=root.querySelector<HTMLButtonElement>('['+attribute+'="'+CSS.escape(id!)+'"]');
  (button?.disabled?root.querySelector<HTMLButtonElement>('[data-remove="'+CSS.escape(id!)+'"]'):button)?.focus();
  document.querySelector('#announcement')!.textContent=state.files[next].name+' moved to position '+(next+1)+' of '+state.files.length+'.';return;
 }
 if(target.dataset.openOutput||target.dataset.revealOutput){const reveal=!!target.dataset.revealOutput,id=target.dataset.revealOutput||target.dataset.openOutput;void perform(async()=>{await host(reveal?'revealOutput':'openOutput',{id});state.notice=reveal?'Requested the containing folder.':'Requested the saved file in its default application.';});return;}
 switch(target.dataset.action){case 'replace-device':void perform(async()=>{Object.assign(state,await host('replacementState'));state.replacing=true;});break;case 'replacement-back':state.replacing=false;render();break;case 'replacement-resend':void perform(async()=>{Object.assign(state,await host('replacementEmailStart'));state.notice='A new code has been sent.';});break;case 'replacement-checkout':void perform(async()=>{await host('replacementCheckout');state.notice='Payment page opened in your browser.';});break;case 'replacement-status':void perform(async()=>{Object.assign(state,await host('replacementStatus'));state.notice=state.replacement?.stage==='complete'?'Replacement complete. This device is activated.':'Payment checked.';});break;case 'support-details':void perform(async()=>{const details=await host('supportDetails');if(!/^[A-Za-z0-9_-]{43}$/.test(details.supportDeviceId))throw Error('Device support details unavailable');state.supportDeviceId=details.supportDeviceId;});break;case 'select':void perform(async()=>acceptFiles(await host('selectFiles')));break;case 'clear':void perform(async()=>{await host('releaseSelection',{ids:state.files.map(f=>f.id)});state.files=[];});break;case 'reset-search':state.query='';render();document.querySelector<HTMLInputElement>('#tool-search')?.focus();break;case 'trial':void perform(async()=>{Object.assign(state,await host('startTrial'));state.notice='Trial activated.';});break;case 'refresh-license':void perform(async()=>{Object.assign(state,await host('refreshLicense'));state.notice='License verified.';});break;case 'license-devices':void perform(async()=>{state.devices=(await host('licenseDevices')).devices;});break;case 'folder':void perform(async()=>{const result=await host('chooseFolder');if(result.selected)state.notice='Output folder saved.';});break;case 'updates':void perform(async()=>{const result=await host('checkUpdates');state.notice=result.message;});break;case 'quit':void perform(async()=>{await host('quit');});break;case 'reveal-key':{const input=document.querySelector<HTMLInputElement>('#license-key')!;input.type=input.type==='password'?'text':'password';target.textContent=input.type==='password'?'Show':'Hide';target.setAttribute('aria-pressed',String(input.type==='text'));break;}}
});
root.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-reset-adjustments]');if(!button||state.busy)return;button.closest('details')?.querySelectorAll<HTMLInputElement>('input[name^="adjust-"]').forEach(input=>input.value='0');document.querySelector('#announcement')!.textContent='Colour and detail adjustments reset.';});
root.addEventListener('input',event=>{const input=event.target as HTMLInputElement;if(input.id!=='tool-search')return;state.query=input.value;const position=input.selectionStart;render();const replacement=document.querySelector<HTMLInputElement>('#tool-search')!;replacement.focus();try{replacement.setSelectionRange(position,position);}catch{}});
root.addEventListener('change',event=>{const input=event.target as HTMLInputElement;if(input.name==='mode'&&input.form)syncProcessingOptions(input.form);if(input.id==='output-mode'||input.id==='theme'||input.id==='startup'||input.id==='shellEntry')void perform(async()=>{const settings=await host('saveSettings',{[input.id==='output-mode'?'output':input.id]:input.type==='checkbox'?input.checked:input.value});Object.assign(state,settings);});});
root.addEventListener('submit',event=>{
 const replacementForm=(event.target as HTMLFormElement).id;
 if(replacementForm.startsWith('replacement-')){
  event.preventDefault();if(state.busy)return;
  const key=root.querySelector<HTMLInputElement>('#replacement-key')?.value.trim();
  const code=root.querySelector<HTMLInputElement>('#replacement-code')?.value.trim();
  const oldDeviceId=root.querySelector<HTMLSelectElement>('#replacement-device')?.value;
  root.querySelectorAll<HTMLInputElement>('#replacement-key,#replacement-code').forEach(input=>input.value='');
  void perform(async()=>{if(replacementForm==='replacement-start-form')Object.assign(state,await host('replacementEmailStart',key?{licenseKey:key}:{}));
   else if(replacementForm==='replacement-verify-form')Object.assign(state,await host('replacementEmailVerify',{code}));
   else if(replacementForm==='replacement-pay-form'){Object.assign(state,await host('replacementRequest',{oldDeviceId}));await host('replacementCheckout');state.notice='Finish payment in your browser, then check payment here.';}
  });return;
 }

 if((event.target as HTMLFormElement).id==='processing-form'){
  event.preventDefault();if(state.busy)return;
  const tool=state.tool,selectionIds=state.files.map(file=>file.id);let options;
  try{options=readProcessingOptions(event.target as HTMLFormElement,tool);}catch(error){state.error=(error as Error).message;render();return;}
  if(tool==='protect-pdf')(event.target as HTMLFormElement).querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(input=>input.value='');
  if(!selectionIds.length){state.error='Choose files first.';render();return;}
  if(tool==='merge-pdf'&&selectionIds.length<2){state.error='Choose at least two PDFs to merge.';render();return;}
  const sources=state.files.map(file=>file.name);batchResults=[];savedOutput=null;
  state.processing=true;
  void perform(async()=>{try{const result=await host('processFiles',{tool,selectionIds,options});
   processingResult(result,sources);
  }finally{state.processing=false;}});return;
 }
 if((event.target as HTMLFormElement).id!=='license-form')return;event.preventDefault();const input=document.querySelector<HTMLInputElement>('#license-key')!;const key=input.value.trim();if(!key)return;input.value='';void perform(async()=>{Object.assign(state,await host('activate',{licenseKey:key}));state.notice='License activated.';});});
root.addEventListener('dragover',event=>{event.preventDefault();(event.target as HTMLElement).closest('[data-dropzone]')?.classList.add('dragging');});root.addEventListener('dragleave',event=>(event.target as HTMLElement).closest('[data-dropzone]')?.classList.remove('dragging'));
root.addEventListener('drop',event=>{event.preventDefault();const files=Array.from(event.dataTransfer?.files||[]);if(files.length)void perform(async()=>acceptFiles(await host('dropFiles',{},files)));});
document.addEventListener('keydown',event=>{if((state.platform==='macos'?event.metaKey:event.ctrlKey)&&!event.altKey&&event.key.toLowerCase()==='o'){event.preventDefault();void perform(async()=>acceptFiles(await host('selectFiles')));}if(state.platform==='macos'&&event.metaKey&&event.key===','){event.preventDefault();navigate('settings');}if((state.platform==='macos'?event.metaKey:event.ctrlKey)&&!event.altKey&&event.key.toLowerCase()==='k'){event.preventDefault();navigate('tools');document.querySelector<HTMLInputElement>('#tool-search')?.focus();}if(event.key==='Escape'){if(state.page==='tools'&&state.query){state.query='';render();document.querySelector<HTMLInputElement>('#tool-search')?.focus();}else if(state.page==='workspace')navigate('tools');}if(event.key==='Enter'&&(event.target as HTMLElement).id==='tool-search'){const first=searchTools(state.query)[0];if(first){event.preventDefault();state.tool=first.id;navigate('workspace');}}});
onNativeSelection(selection=>{state.files=[];acceptFiles(selection);render();});
root.addEventListener('click',event=>{
 const action=(event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
 if(!quick.active||state.busy||!['open-full','close-quick'].includes(action||''))return;
 void host(action==='open-full'?'openFullApp':'closeQuickAction').then(()=>{if(action==='open-full'){quick.active=false;render();}}).catch(error=>{state.error=error.message;render();});
});
document.addEventListener('keydown',event=>{if(quick.active&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(!state.busy)void host('closeQuickAction').catch(error=>{state.error=error.message;render();});}},true);
onNativeLaunch(()=>{void loadNativeLaunch().catch(()=>{});});
onLicenseUpdated(status=>{Object.assign(state,{trialPending:false},status);if(!state.busy)render();});
root.addEventListener('click',event=>{const id=(event.target as HTMLElement).closest<HTMLElement>('[data-native-action]')?.dataset.nativeAction;if(!id||state.busy)return;const action=state.launchIntent?.actions?.find((item:any)=>item.id===id);if(!action)return;if(!action.direct){applyNativeAction(action);return;}const sources=state.files.map(file=>file.name);state.tool=action.tool;state.page='workspace';state.processing=true;void perform(async()=>{try{processingResult(await host('processFiles',{tool:action.tool,options:action.options,selectionIds:state.files.map(file=>file.id)}),sources);}finally{state.processing=false;}});});
onNativeNotice(message=>{document.querySelector('#announcement')!.textContent=message;if(state.busy)document.querySelector('#pending-action')!.textContent=message;});
render();void host('getState').then(data=>{quick.active=data.quickAction===true;Object.assign(state,data);if(data.launchIntent?.action)applyNativeAction(data.launchIntent.action);else{if(data.launchIntent?.actions)state.page='native';render();}restoreJob(data.job);void host('licenseStatus').then(status=>{Object.assign(state,status);render();}).catch(()=>{});}).catch(error=>{state.error=error.message;render();});

const cancelProcessing=document.createElement('button');cancelProcessing.id='cancel-processing';cancelProcessing.className='secondary cancel-processing';cancelProcessing.textContent='Cancel processing';cancelProcessing.hidden=true;document.body.append(cancelProcessing);cancelProcessing.addEventListener('click',()=>{cancelProcessing.disabled=true;void host('cancelProcessing').catch(()=>{state.error='Cancellation could not be requested.';}).finally(()=>{cancelProcessing.disabled=false;});});
