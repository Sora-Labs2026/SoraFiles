import './tokens.css';
import './styles.css';
import './brand.css';
import './layout.css';
import {languages,setLocale,locale,t,localizeUi} from './localization';
import {toolCategories} from './tool-categories';
import {confirmDisableQuickAction} from './startup-confirmation';
import prototypeToolIcons from './tool-icons.json';
import {connectedTools,processingOptions,readProcessingOptions,syncProcessingOptions,syncPercentRange} from './processing';
import {capabilities,relevantActions,searchTools} from '../shared/capabilities.mjs';
import {CROP_TOOLS,bindCanvas,canvasView,cropPixels,cropSize,hasCropCanvas,loadPreviews} from './canvas';
import {eligibleForRatingPrompt,readPromptState,recordDismissed,recordRated,recordShown,recordSuccess} from '../shared/rating-prompt.mjs';
import {host,onNativeSelection,onNativeNotice,onNativeLaunch,onLicenseUpdated} from './host';
type Selected={id:string;name:string;format:string|null;validated:boolean;bytes:number};
let batchResults:{source:string;state:string;name?:string;warnings?:string[];cleanupPending?:boolean;outputId?:string}[]=[],savedOutput:{name:string;outputId?:string}|null=null;
const root=document.querySelector<HTMLElement>('#app')!;
const quick={active:(window as Window&{__SORA_QUICK_ACTION__?:boolean}).__SORA_QUICK_ACTION__===true};
let toolCategory='all';
let resendTimer:ReturnType<typeof setTimeout>|undefined;
const state={language:'system',locale:(window as Window&{__SORA_LOCALE__?:string}).__SORA_LOCALE__||'en',trialPending:false,replacement:null as any,replacing:false,launchIntent:null as any,supportDeviceId:'',page:'home',query:'',tool:'',files:[] as Selected[],busy:false,processing:false,error:'',notice:'',license:'not-activated',activationAvailable:false,plan:'',expiresAt:null as number|null,devices:[] as {id:string;current:boolean;active:boolean}[],output:'source',startup:false,startupAvailable:false,shellEntry:false,shellEntryAvailable:false,theme:'system',version:'SoraFiles Desktop',platform:'windows'};
const licenseReady=()=>['active','trial'].includes(state.license);
const systemTheme=window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){document.documentElement.dataset.theme=state.theme==='system'?(systemTheme.matches?'dark':'light'):state.theme;}
systemTheme.addEventListener('change',()=>{if(state.theme==='system')applyTheme();});
const planLabel=()=>state.plan.split('-').map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(' ');
const escape=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const paths:Record<string,string>={home:'M3 10 12 3l9 7v10H3V10Zm6 10v-7h6v7',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',lock:'M6 10h12a2 2 0 0 1 2 2v8H4v-8a2 2 0 0 1 2-2Zm2 0V7a4 4 0 0 1 8 0v3M12 14v3',settings:'m12 3 2 3 4-1 1 4 3 3-3 2 1 4-4 1-4 3-2-3-4 1-1-4-3-3 3-2-1-4 4-1 4-3Zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6',update:'M20 8a8 8 0 1 0 0 8M20 3v5h-5',file:'M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6M9 16h6',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',folder:'M3 6h7l2 3h9v11H3V6',arrow:'M5 12h14m-5-5 5 5-5 5',upload:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',close:'m6 6 12 12M6 18 18 6',check:'m5 12 4 4L19 6',image:'M3 3h18v18H3zM3 16l6-6 5 5 3-3 4 4M15 7h.01',compress:'M3 8h5V3m0 5L3 3m18 5h-5V3m0 5 5-5M3 16h5v5m0-5-5 5m18-5h-5v5m0-5 5 5',merge:'M5 3v5l7 6 7-6V3m-7 11v7m-4-4 4 4 4-4',power:'M12 3v9M6 5a9 9 0 1 0 12 0'};
const icon=(name:string,cls='')=>`<svg class="icon ${cls}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]||paths.file}"/></svg>`;
const toolGlyph=(id:string)=>(prototypeToolIcons as Record<string,string>)[id]??icon('file');
const common=['compress-pdf','merge-pdf','image-converter','resize-image','remove-background','pdf-ocr'];
function toolButton(tool:any){return `<button class="tool-card" data-tool="${tool.id}"><span class="tool-icon">${toolGlyph(tool.id)}</span><span><strong>${escape(tool.name)}</strong><small>${escape(tool.formats.slice(0,3).join(', '))}${tool.formats.length>3?' + more':''}</small></span>${icon('arrow','card-arrow')}</button>`;}
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
function batchFeedback(){return batchResults.length?`<section class="panel" aria-label="Batch results"><h2>Batch results</h2><ul>${batchResults.map(row=>`<li><strong data-user-text>${escape(row.source)}</strong>: ${row.state==='completed'?t('Saved')+' <bdi data-user-text>'+escape(row.name)+'</bdi>':row.state==='failed'?'Could not process this file. Check the file and options.':'Cancelled before saving.'}${row.warnings?.length?' '+escape(row.warnings.join(' ')):''}${row.cleanupPending?' A temporary file may remain in the output folder.':''}${outputButtons(row.outputId)}</li>`).join('')}</ul></section>`:savedOutput?`<section class="panel"><h2 data-user-text>${escape(savedOutput.name)}</h2>${outputButtons(savedOutput.outputId)}</section>`:'';}
function heading(eyebrow:string,title:string,description:string){return `<header class="page-heading"><p class="eyebrow">${eyebrow}</p><h1 tabindex="-1">${title}</h1><p>${description}</p></header>`;}
function selectedSummary(){return locale()==='en'?state.files.length+' '+(state.files.length===1?'file':'files')+' selected':t('Selected files')+': '+state.files.length;}
function selected(){if(!state.files.length)return '';return `<div class="selected"><div class="section-title"><h2>${selectedSummary()}</h2><button class="text-button" data-action="clear">Clear selection</button></div><ul>${state.files.map((f,index)=>`<li>${icon(f.format==='PDF'?'file':'image')}<span><bdi data-user-text>${escape(f.name)}</bdi><small>${f.format||'Needs inspection'} · ${new Intl.NumberFormat(locale(),{maximumFractionDigits:1}).format(f.bytes/1024)} KB</small></span>${state.page==='workspace'&&['merge-pdf','jpg-to-pdf','doc-scanner'].includes(state.tool)?`<span class="selection-order"><button class="icon-button" data-user-text data-move-up="${escape(f.id)}" aria-label="${t('Move up')}: ${escape(f.name)}" ${index===0?'disabled':''}>&uarr;</button><button class="icon-button" data-user-text data-move-down="${escape(f.id)}" aria-label="${t('Move down')}: ${escape(f.name)}" ${index===state.files.length-1?'disabled':''}>&darr;</button></span>`:''}<button class="icon-button" data-user-text data-remove="${escape(f.id)}" aria-label="${t('Remove')}: ${escape(f.name)}">${icon('close')}</button></li>`).join('')}</ul></div>`;}
function dropzone(compact=false){return `<div class="dropzone ${compact?'compact':''}" data-dropzone><span class="drop-icon">${icon('upload')}</span><h2>${state.files.length?'Add more files':'Drop your files here'}</h2><p>PDFs, images and documents. Choose what to do next.</p><button class="primary" data-action="select" ${state.busy?'disabled':''}>${icon('folder')}Choose files</button><small>Your originals stay untouched.</small></div>`;}
function home(){const suggestions=state.files.length?relevantActions(state.files,licenseReady()):capabilities.filter(t=>common.includes(t.id));return `${heading('YOUR FILES. YOUR DEVICE.','File tools for your desktop.','Convert, compress and organize files, right where they are.')}${feedback()}${dropzone(state.files.length>0)}${selected()}<section class="tool-section"><div class="section-title"><h2>${state.files.length?'Works with your selection':'Everyday tools'}</h2><button class="text-button" data-page="tools">${t('All tools')} (${capabilities.length}) ${icon('arrow')}</button></div><div class="tool-grid">${suggestions.filter(t=>capabilities.some(tool=>tool.id===t.id)).map(toolButton).join('')||'<p>No quick action matches this selection. Choose a tool to inspect the files.</p>'}</div></section><p class="privacy-note">${icon('lock')}File processing stays on your device.</p>`;}
function filteredTools(){const category=toolCategories.find(group=>group.id===toolCategory);const query=state.query.trim().toLocaleLowerCase(locale());const matches=capabilities.filter(tool=>!query||t(tool.name).toLocaleLowerCase(locale()).includes(query)||searchTools(state.query).some(match=>match.id===tool.id));return matches.filter(tool=>!category||(category.tools as readonly string[]).includes(tool.id));}
function tools(){
 const list=filteredTools();
 const groups=toolCategories.map(group=>{const items=list.filter(tool=>(group.tools as readonly string[]).includes(tool.id));return items.length?`<section class="tool-category" aria-labelledby="category-${group.id}"><div class="category-heading"><h2 id="category-${group.id}">${group.label}</h2><span>${t('Tools')}: ${items.length}</span></div><div class="tool-grid">${items.map(toolButton).join('')}</div></section>`:'';}).join('');
 return `${heading('FIND YOUR NEXT STEP','All tools','One place for your PDFs, images and documents.')}<label class="search-box">${icon('search')}<input id="tool-search" type="search" placeholder="Search tools, e.g. merge PDF" value="${escape(state.query)}" aria-label="Search tools" autocomplete="off"><kbd>${state.platform==='macos'?'⌘ K':'Ctrl K'}</kbd></label><div class="category-filters" role="group" aria-label="Tool categories">${[{id:'all',label:'All'},...toolCategories].map(group=>`<button data-category="${group.id}" aria-pressed="${toolCategory===group.id}">${group.label}</button>`).join('')}</div><div id="tool-results"><p class="result-count" role="status">${t('Tools')}: ${list.length}</p>${groups}${!list.length?'<div class="empty"><h2>No tools found</h2><p>Try another category or search.</p><button class="secondary" data-action="reset-search">Clear search</button></div>':''}</div>`;
}
// ---- Star ratings: the same shared aggregate as sorafiles.com ----
const toolRatings:Record<string,{count:number;average:number|null;userRating:number|null}|null>={};
const PROMPT_KEY='sf-rating-prompts';
let promptState=readPromptState((()=>{try{return localStorage.getItem(PROMPT_KEY);}catch{return null;}})());
const savePromptState=()=>{try{localStorage.setItem(PROMPT_KEY,JSON.stringify(promptState));}catch{}};
let ratingPrompt:{tool:string;status:string;done:boolean}|null=null,promptsThisSession=0;
function ratingSummary(tool:string){
 const rating=toolRatings[tool];if(!rating?.count||rating.average===null)return '';
 const average=rating.average.toFixed(1),count=new Intl.NumberFormat(state.locale).format(rating.count),unit=t(rating.count===1?'rating':'ratings');
 return `<p class="tool-rating" aria-label="${average} ${t('out of 5')} · ${count} ${unit}"><span aria-hidden="true">★</span> ${average} <span class="tool-rating-count">· ${count} ${unit}</span></p>`;
}
// Rating is secondary: failures are silent here and never touch processing.
function loadToolRating(tool:string){
 if(!tool||tool in toolRatings||!licenseReady())return;
 toolRatings[tool]=null;
 void host('ratingStatus',{subject:tool}).then((result:any)=>{toolRatings[tool]=result.rating;const current=result.rating?.userRating;if(current){promptState=recordRated(promptState,tool,current);savePromptState();}
  if(state.page==='workspace'&&state.tool===tool){const heading=root.querySelector('.workspace-heading h1');heading?.parentElement?.querySelector('.tool-rating')?.remove();heading?.insertAdjacentHTML('afterend',ratingSummary(tool));}}).catch(()=>{delete toolRatings[tool];});
}
function ratingPromptView(){
 if(!ratingPrompt||ratingPrompt.tool!==state.tool||quick.active)return '';
 const stars=[1,2,3,4,5].map(n=>`<label class="rating-star"><input type="radio" name="rating-prompt" value="${n}" aria-label="${escape(t(n===1?'1 star':n+' stars'))}"${ratingPrompt!.done?' disabled':''}><span aria-hidden="true">★</span></label>`).join('');
 return `<section class="rating-prompt" aria-labelledby="rating-prompt-title"><div class="rating-prompt-copy"><h2 id="rating-prompt-title">${t('Enjoying this tool?')}</h2><p>${t('Leave a quick rating')}</p></div><fieldset class="rating-stars"><legend class="sr-only">${t('Your rating')}. ${t('Use the arrow keys to choose, then press Enter.')}</legend>${stars}</fieldset>${ratingPrompt.done?'':`<button class="text-button" data-action="rating-dismiss">${t('Not now')}</button>`}<p class="rating-prompt-status" role="status" aria-live="polite">${escape(ratingPrompt.status)}</p></section>`;
}
function afterSuccessfulRun(tool:string){
 promptState=recordSuccess(promptState,tool);
 if(!quick.active&&eligibleForRatingPrompt(tool,promptState,{sessionShown:promptsThisSession})){
  promptState=recordShown(promptState);promptsThisSession++;ratingPrompt={tool,status:'',done:false};
 }
 savePromptState();
}
function workspace(){
 const tool=capabilities.find(t=>t.id===state.tool)!;
 const output=state.output==='source'?'Beside each original file':state.output==='downloads'?'Your Downloads folder':state.output==='ask'?'Choose a folder each time':'Your chosen folder';
 const picker=state.files.length?`<div class="workspace-file-actions" data-dropzone><button class="secondary" data-action="select">${icon('folder')}Choose files</button><p>Your originals stay untouched.</p></div>`:dropzone(true);
 const action=!licenseReady()?`<div class="action-bar"><div>${icon('lock')}<span>Check your trial or activate a license to process files.</span></div><button class="primary" data-page="license">View license ${icon('arrow')}</button></div>`:connectedTools.has(state.tool)?processingOptions(state.tool):'<section class="panel"><h2>Tool unavailable</h2><p>This tool is not available in this release.</p></section>';
 const saveLocation=`<section class="workspace-output" aria-label="Save location">${icon('folder')}<div><strong>${t('Save results')}: ${t(output)}</strong><p>Existing files are kept. New results get a number if needed.</p></div><button class="text-button" data-page="settings">Change output settings</button></section>`;
 const head=`<button class="text-button back" data-page="tools">← All tools</button><header class="page-heading workspace-heading"><h1 tabindex="-1">${escape(tool.name)}</h1>${ratingSummary(state.tool)}<p>${state.files.length?'':t('Choose files to get started.')+' '}<span translate="no">${escape(tool.formats.join(', '))}</span></p></header>`;
 // Before files: one calm column. With files: the selection is the main area and
 // options sit in one predictable side panel with a single primary action.
 if(!state.files.length)return `${head}${feedback()}${batchFeedback()}${picker}${saveLocation}`;
 return `${head}${feedback()}<div class="workspace-grid"><section class="workspace-main" aria-label="Selected files">${ratingPromptView()}${batchFeedback()}${canvasView(state.tool,state.files)}${selected()}${picker}</section><aside class="workspace-panel" aria-label="Options">${action}${saveLocation}</aside></div>`;
}
function activationForm(){return `<section class="panel"><h2>Already have a license?</h2><p>Find your license key in your purchase email. Check your Spam or Junk folder too. Activation uses one device seat. Unused team seats activate at no extra charge.</p><form id="license-form"><label for="license-key">License key</label><div class="key-field"><input id="license-key" name="license-key" type="password" autocomplete="off" spellcheck="false" required><button type="button" class="text-button" data-action="reveal-key" aria-controls="license-key" aria-pressed="false">Show</button></div><button type="submit" class="secondary" ${state.busy?'disabled':''}>Activate license</button></form></section>`;}
function supportDetails(){return `<section class="panel"><h2>Free up a device seat</h2><p>Verify your purchase email and pay the one-time fee to revoke a device. Once confirmed, that device needs a fresh online activation with the same or a new license key to process files again.</p><div class="support-actions"><button class="secondary" data-action="replace-device">Revoke Device</button><button class="text-button" data-action="support-details">Show this device ID</button></div>${state.supportDeviceId?`<p class="support-device-id"><code>${escape(state.supportDeviceId)}</code></p>`:''}</section>`;}
function license(){if(state.replacing)return replacementPanel();if(state.license==='revoked')return `${heading('SORAFILES DESKTOP','Device revoked','Activate a license to use SoraFiles on this device again.')}${feedback()}<section class="panel"><h2>Activation required</h2><p>This device is no longer bound to a license. Enter the same or a new license key below. Connect to the internet so SoraFiles can verify the license and bind it to this device.</p></section>${activationForm()}${supportDetails()}`;if(['active','trial','needs-verification'].includes(state.license))return activeLicense()+supportDetails();return `${heading('SORAFILES DESKTOP','Your Desktop license','Your seven-day trial starts automatically on first launch.')}${feedback()}<div class="license-grid"><section class="panel"><h2>Setting up your trial</h2><p>Connect to the internet to finish setting up your trial. Your seven days begin the first time you open SoraFiles.</p></section>${activationForm()}</div>${supportDetails()}`;}
function activeLicense(){
 const needsCheck=state.license==='needs-verification',trial=state.license==='trial'||state.activationAvailable;
 const title=needsCheck?(state.trialPending?'Setting up your trial':trial?'Your trial needs a check':'Your license needs a check'):trial?'Your trial is active':'Desktop is activated';
 const expiry=needsCheck&&!state.trialPending?'Check required':state.expiresAt?new Intl.DateTimeFormat(locale(),{dateStyle:'medium'}).format(state.expiresAt*1000):state.plan.includes('lifetime')?'No expiry':'Check required';
return `${heading('SORAFILES DESKTOP',title,'Works offline after setup.')}${feedback()}<section class="panel"><h2>${trial?'7-day trial':escape(planLabel())||'License status'}</h2><p>${trial?'Trial ends':state.plan.includes('lifetime')?'License duration':'Paid through'}: ${escape(expiry)}</p>${trial&&needsCheck?state.trialPending?'<p>Connect to the internet to finish setting up your trial. We will retry automatically.</p>':'<p>Your trial may have ended, or this device could not verify it. You can activate a purchased license below.</p>':''}${!trial?'<div class="license-actions"><button class="secondary" data-action="refresh-license">Check license online</button><button class="text-button" data-action="license-devices">Manage devices</button></div>':''}${state.devices.length?'<ul>'+state.devices.map((d,i)=>'<li>'+(d.current?'This device':'Device '+(i+1))+(d.active?'':' — unavailable')+'</li>').join('')+'</ul>':''}${!trial?'<div class="setting-row"><div><strong>Active on this device</strong><p>To free an occupied seat, verify your purchase email and pay the revocation fee. An unused team seat activates for free.</p></div></div>':''}</section>${trial?activationForm():''}`;
}
function replacementPanel(){
 const flow=state.replacement||{stage:'idle'},fee=flow.fee;
 let content='';
 // Nothing here sends email by itself. A code is requested only when the person
 // types the purchase email and presses Send code (or Resend after a real send).
 if(flow.stage==='idle')content=`<p>Enter the email address you used to buy SoraFiles. We check it against your purchase and send a code only if it matches.</p>${flow.expired?'<p class="privacy-note">Your previous code expired. Send a new code to continue.</p>':''}<form id="replacement-start-form" novalidate><label for="replacement-email">Email used for purchase</label><div class="key-field"><input id="replacement-email" type="email" inputmode="email" autocomplete="email" maxlength="254" value="${escape(flow.email||'')}" required></div>${state.plan&&state.plan!=='trial'?'':`<label for="replacement-key">License key</label><div class="key-field"><input id="replacement-key" type="password" autocomplete="off" required></div>`}<button type="submit" class="primary">Send code</button></form>`;
 if(flow.stage==='email'){
  const wait=Math.max(0,(flow.resendAfter||0)*1000-Date.now());
  if(wait>0){clearTimeout(resendTimer);resendTimer=setTimeout(()=>{if(state.replacing&&state.replacement?.stage==='email')render();},Math.min(wait+100,120000));}
  content=`<p>Enter the eight-digit code sent to <strong data-user-text>${escape(flow.maskedEmail)}</strong>. It expires in 10 minutes. Check your Spam or Junk folder if it has not arrived.</p><form id="replacement-verify-form"><label for="replacement-code">Email verification code</label><div class="key-field"><input id="replacement-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{8}" maxlength="8" required></div><button type="submit" class="primary">Verify email</button></form><div class="support-actions"><button class="text-button" data-action="replacement-resend"${wait>0?' disabled':''}>Resend code</button><button class="text-button" data-action="replacement-change-email">Use a different email</button></div><p class="privacy-note">${wait>0?'You can resend the code after one minute.':'Only the newest code works.'}</p>`;
 }
 if(flow.stage==='verified'){
  const devices=(flow.devices||[]).filter((device:any)=>device.active);
  const unusedTeamSeat=String(flow.plan||'').startsWith('team-')&&devices.length<5;
  content=(unusedTeamSeat?'<p class="privacy-note">Your Team license has an unused seat. To add a device, activate it with your license key. No fee applies.</p>':'')+(devices.length?`<p>Email verified. Choose the device to revoke.</p><form id="replacement-pay-form"><label for="replacement-device">Device to revoke</label><select id="replacement-device" required>${devices.map((device:any,i:number)=>`<option value="${escape(device.id)}">${device.current?'This device':'Device '+(i+1)} · ${escape(device.id.slice(0,8))}</option>`).join('')}</select><p>One-time revocation fee: <strong>${escape(fee.formatted)} USD${fee.perSeat?' per occupied seat':''}</strong>. After payment is confirmed, the server unbinds this device from your license and frees the seat. Your plan stays the same.</p><p>The revoked device cannot process files until you enter the same or a new license key and activate it online. You can also use the freed seat to activate your license on another device.</p><button type="submit" class="primary">Pay ${escape(fee.formatted)} and revoke</button></form>`:'<p>No occupied device is available to revoke. Return to License to check your activation.</p>')+'<button class="text-button" data-action="replacement-change-email">Start again with a different email</button>';
 }
 if(flow.stage==='payment')content=`<p>${flow.status==='payment-failed'?'Your payment did not complete.':flow.status==='payment-confirmed'?'Payment confirmed. The server is revoking the selected device.':'Finish payment in your browser. The selected device will be revoked after payment is confirmed.'}</p><p>Revocation fee: <strong>${escape(fee.formatted)} USD</strong>.</p>${flow.checkoutAvailable?'<button class="secondary" data-action="replacement-checkout">Open payment page</button>':''}<button class="primary" data-action="replacement-status">Check payment</button>${flow.status==='payment-confirmed'?'':'<p class="privacy-note">Nothing is charged unless you complete payment. Changed your mind or chose the wrong device?</p><button class="text-button" data-action="replacement-cancel">Cancel revocation</button>'}`;
 if(flow.stage==='complete')content='<p>The selected device has been revoked and its license seat is free.</p><p>To process files on that device again, enter the same or a new license key and activate it online. You can also activate the same license on another device. Every activation is verified online and binds the license to that device.</p>';
 return `${heading('MANAGE DEVICES','Revoke Device','Free an occupied device seat and keep your plan.')}${feedback()}<section class="panel">${content}</section><button class="text-button" data-action="replacement-back">Back to license</button>`;
}

function startupDescription(){return state.platform==='windows'?'Start a lightweight SoraFiles helper when you sign in to Windows so Edit with SoraFiles is ready without opening the app. You can also change this in Windows Startup Apps settings.':'Start a lightweight SoraFiles helper when you sign in so Edit with SoraFiles is ready without opening the app.';}
function languageSettings(){return `<section class="panel settings-panel"><h2>Language</h2><p>Choose the language for SoraFiles and file-manager actions.</p><div class="setting-row"><label for="language">App language</label><select id="language"><option value="system" ${state.language==='system'?'selected':''}>${state.platform==='windows'?'Use Windows language':state.platform==='macos'?'Use macOS language':'Use system language'} (default)</option>${languages.map(([code,name])=>`<option value="${code}" lang="${code}" translate="no" ${state.language===code?'selected':''}>${name}</option>`).join('')}</select></div><p>Unsupported system languages use English.</p></section>`;}
function settings(){return `${heading('YOUR PREFERENCES','Settings','Set up files, quick actions and appearance.')}${feedback()}
 <section class="panel settings-panel"><h2>Files & output</h2><p>Choose where new files are saved.</p><label for="output-mode" class="sr-only">Default output location</label><select id="output-mode">${[['source','Next to original files'],['downloads','Downloads'],['custom','Custom folder'],['ask','Ask each time']].map(([value,label])=>`<option value="${value}" ${state.output===value?'selected':''}>${label}</option>`).join('')}</select>${state.output==='custom'?'<button class="secondary" data-action="folder">Choose folder</button>':''}<div class="setting-row"><div><strong>Keep originals safe</strong><p>New results get a numbered name if one already exists.</p></div><span class="quiet-badge">Always on</span></div></section>
 <section class="panel settings-panel"><h2>Quick actions</h2>
 <div class="setting-row"><div><strong>Show Edit with SoraFiles in right-click menus</strong><p id="shell-description">${state.shellEntryAvailable?(state.platform==='windows'?'Add file actions for supported files. On Windows 11, look under Show more options.':state.platform==='macos'?'Add file actions to Finder Quick Actions. Actions that need options open a small window.':'Add file actions to supported file managers. Restart your file manager after changing this setting.'):'File-manager actions are unavailable on this platform.'}</p></div><input type="checkbox" id="shellEntry" aria-label="Show Edit with SoraFiles in right-click menus" aria-describedby="shell-description" ${state.shellEntry?'checked':''} ${state.shellEntryAvailable?'':'disabled'}></div>
 <div class="setting-row"><div><strong>Keep quick actions ready after sign-in</strong><p id="startup-description">${state.startupAvailable?startupDescription():'Sign-in startup is not available on this platform yet.'}</p></div><input type="checkbox" id="startup" aria-label="Keep quick actions ready after sign-in" aria-describedby="startup-description" ${state.startup?'checked':''} ${state.startupAvailable?'':'disabled'}></div>
 <div class="settings-note"><strong>Closing the window</strong><p>The helper keeps running in the background. Choose Quit SoraFiles to exit completely.</p></div></section>
 ${languageSettings()}
 <section class="panel settings-panel"><h2>Appearance</h2><div class="setting-row"><label for="theme">Theme</label><select id="theme" aria-label="Appearance">${['system','light','dark'].map(value=>`<option value="${value}" ${state.theme===value?'selected':''}>${value==='system'?'Follow system':value[0].toUpperCase()+value.slice(1)}</option>`).join('')}</select></div></section>`;}
function updates(){return `${heading('BUILT BY SORA LABS','Updates & about','A private space for working with your files.')}${feedback()}<section class="panel about-panel"><img src="/icon-192.png" width="64" height="64" alt=""><h2>SoraFiles Desktop</h2><p>${escape(state.version)}</p><p>This release processes your files locally and keeps the web tools free.</p><button class="secondary" data-action="updates">View release notes</button></section>`;}
function renderFull(){root.innerHTML=`<a class="skip-link" href="#main">Skip to content</a><aside class="sidebar"><div class="brand"><img src="/icon-192.png" alt="" width="36" height="36"><div>SoraFiles<span>DESKTOP</span></div></div><nav aria-label="Main navigation">${[['home','Home','home'],['tools','All tools','grid'],['license','License','lock'],['settings','Settings','settings'],['updates','Updates & about','update']].map(([id,name,glyph])=>`<button aria-label="${name}" data-page="${id}" ${state.page===id||state.page==='workspace'&&id==='tools'?'aria-current="page"':''}>${icon(glyph)}<span>${name}</span></button>`).join('')}</nav><div class="sidebar-bottom"><button class="quit" data-action="quit" aria-label="Quit SoraFiles" title="Quit SoraFiles">${icon('power')}<span>Quit SoraFiles</span></button><small>SoraFiles Desktop</small></div></aside><main id="main" tabindex="-1">${state.page==='native'?nativeActions():state.page==='home'?home():state.page==='tools'?tools():state.page==='workspace'?workspace():state.page==='license'?license():state.page==='settings'?settings():updates()}</main>`;syncBusy();}
function render(){
 setLocale(state.locale);
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
 }else{
  renderFull();
  if(state.page==='workspace'){loadPreviews(state.files,state.tool,refreshCanvas);applyCanvasToForm();loadToolRating(state.tool);}
 }
 localizeUi(root);
 const pending=document.querySelector<HTMLElement>('#pending-action');if(pending)localizeUi(pending);
 const cancel=document.querySelector<HTMLElement>('#cancel-processing');if(cancel)cancel.textContent=t('Cancel processing');
}
// Previews arrive after the page is drawn: replace only the canvas so options
// the person already changed are kept.
function refreshCanvas(){
 if(quick.active||state.page!=='workspace')return;
 const canvas=root.querySelector('#workspace-canvas');
 if(canvas){canvas.outerHTML=canvasView(state.tool,state.files);localizeUi(root.querySelector<HTMLElement>('#workspace-canvas')!);}
 applyCanvasToForm();
}
function applyCanvasToForm(){
 const cropping=hasCropCanvas(state.tool,state.files);
 root.querySelectorAll<HTMLElement>('#processing-form [data-crop-only]').forEach(group=>group.hidden=!cropping);
 if(cropping)fitSizeToCrop();
}
// Like the website: choosing a crop sets the output size to the cropped area.
function fitSizeToCrop(){
 const size=cropSize(state.files),form=root.querySelector<HTMLFormElement>('#processing-form');
 if(!size||!form||state.tool!=='resize-image')return;
 const width=form.querySelector<HTMLInputElement>('input[name="width"]'),height=form.querySelector<HTMLInputElement>('input[name="height"]');
 if(width&&height){width.value=String(size.width);height.value=String(size.height);}
}
function quickActionView(){
 const tool=capabilities.find(item=>item.id===state.tool),workspace=state.page==='workspace'&&tool;
 const finished=!!savedOutput||batchResults.length>0;
 const options=workspace&&licenseReady()&&!finished?processingOptions(state.tool):'';
 const selection=state.files.length?`<details class="quick-files" ${state.tool==='merge-pdf'&&!finished?'open':''}><summary>${state.files.length===1?'<bdi data-user-text>'+escape(state.files[0].name)+'</bdi>':selectedSummary()}</summary>${selected()}</details>`:'';
 const content=!licenseReady()?'<p>Your trial or license needs a check.</p><button class="secondary" data-page="license">View license</button>':workspace?`${selection}${options}`:nativeActions();
 return `<main id="main" class="quick-action" data-tool="${escape(state.tool)}" tabindex="-1"><header class="quick-heading"><img src="/icon-192.png" alt="" width="26" height="26"><h1 tabindex="-1">${escape(workspace?tool.name:'Edit with SoraFiles')}</h1><button class="icon-button" data-action="open-full" aria-label="Open full desktop app" title="Open full desktop app">${icon('arrow')}</button></header><div class="quick-content">${feedback()}${batchFeedback()}${content}</div><footer class="quick-footer"><span role="status">${state.processing?'Processing files…':finished?'Processing finished':state.output==='source'?'Save beside originals':state.output==='downloads'?'Save to Downloads':state.output==='ask'?'Choose a folder when you run':'Use your saved output folder'}</span>${state.processing?'':`<button class="secondary" data-action="close-quick">${finished?'Done':'Cancel'}</button>${options?'<button class="primary" type="submit" form="processing-form">Run</button>':''}`}</footer></main>`;
}
function nativeActions(){return `${heading('YOUR SELECTED FILES','Edit with SoraFiles','Choose an action for this selection.')}${feedback()}${selected()}<section class="panel"><div class="tool-grid">${(state.launchIntent?.actions||[]).map((action:any)=>`<button class="secondary" data-native-action="${escape(action.id)}">${escape(action.label)}</button>`).join('')}</div></section>`;}
function applyNativeAction(action:any){
 if(!action?.tool){if(quick.active){state.page='native';state.tool='';render();}else navigate(action?.id==='activate'?'license':'home');return;}
 if(!connectedTools.has(action.tool)){state.error='This action is not available in this build.';render();return;}
 state.tool=action.tool;state.page='workspace';render();
 for(const [name,value] of Object.entries(action.options||{})){const input=root.querySelector<HTMLInputElement|HTMLSelectElement>('[name="'+CSS.escape(name)+'"]');if(input&&typeof value!=='object'){input.value=String(value);if(input instanceof HTMLInputElement&&input.type==='range')syncPercentRange(input);}}
}
async function loadNativeLaunch(){const data=await host('getState');quick.active=data.quickAction===true;Object.assign(state,data);batchResults=[];savedOutput=null;state.error='';state.notice=data.notice||'';const previous=root.querySelector<HTMLElement>('.quick-action');if(previous)previous.dataset.tool='';if(data.launchIntent?.action)applyNativeAction(data.launchIntent.action);else if(data.launchIntent?.actions){state.page='native';render();}else{render();restoreJob(data.job);}}
function navigate(page:string){if(quick.active&&!['workspace','native'].includes(page)){void host('openFullApp').then(()=>{quick.active=false;navigate(page);}).catch(error=>{state.error=error.message;render();});return;}state.page=page;state.error='';state.notice='';render();root.querySelector<HTMLElement>('h1')?.focus();}
function syncBusy(){
 document.body.dataset.processing=String(state.processing);
 const quickStatus=root.querySelector('.quick-footer>span');if(quickStatus&&state.processing)quickStatus.textContent=t('Processing files…');
 document.querySelector<HTMLElement>('#pending-action')!.textContent=t(state.processing?'Processing files…':'Loading…');
 root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('.option-fields input,.option-fields select').forEach(control=>control.disabled=state.busy);
 const cancel=document.querySelector<HTMLButtonElement>('#cancel-processing');if(cancel)cancel.hidden=!state.processing;
 root.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('[data-action]:not([data-action="reveal-key"]),[data-remove],[data-open-output],[data-reveal-output],select,input[type="checkbox"],button[type="submit"]').forEach(control=>control.disabled=state.busy);
 // Resend stays unavailable until the service cooldown has passed.
 const resend=root.querySelector<HTMLButtonElement>('[data-action="replacement-resend"]');if(resend)resend.disabled=state.busy||(state.replacement?.resendAfter||0)*1000>Date.now();
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
root.addEventListener('click',event=>{const target=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!target)return;if(target.dataset.category){toolCategory=target.dataset.category;render();root.querySelector<HTMLButtonElement>(`[data-category="${toolCategory}"]`)?.focus();return;}if(target.dataset.action==='reset-search')toolCategory='all';if(target.dataset.page){navigate(target.dataset.page);return;}if(target.dataset.tool){state.tool=target.dataset.tool;navigate('workspace');return;}if(target.dataset.remove){const id=target.dataset.remove;void perform(async()=>{await host('releaseSelection',{ids:[id]});state.files=state.files.filter(f=>f.id!==id);if(!state.files.length){batchResults=[];savedOutput=null;state.launchIntent=null;}});return;}
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
 switch(target.dataset.action){case 'rating-dismiss':if(ratingPrompt){promptState=recordDismissed(promptState,ratingPrompt.tool);savePromptState();ratingPrompt=null;render();}return;case 'replace-device':void perform(async()=>{Object.assign(state,await host('replacementState'));if(state.replacement?.stage==='complete')state.replacement={stage:'idle'};state.replacing=true;});break;case 'replacement-back':state.replacing=false;render();break;case 'replacement-activate':state.replacing=false;render();document.querySelector<HTMLInputElement>('#license-key')?.focus();break;case 'replacement-resend':void perform(async()=>{Object.assign(state,await host('replacementEmailResend'));state.notice='A new code has been sent. Check your inbox and Spam folder.';});break;case 'replacement-change-email':void perform(async()=>{Object.assign(state,await host('replacementReset'));});break;case 'replacement-cancel':void perform(async()=>{Object.assign(state,await host('replacementCancel'));state.notice=['verified','idle'].includes(state.replacement?.stage)?'Revocation cancelled. Nothing was charged.':'';});break;case 'replacement-checkout':void perform(async()=>{await host('replacementCheckout');state.notice='Payment page opened in your browser.';});break;case 'replacement-status':void perform(async()=>{Object.assign(state,await host('replacementStatus'));state.notice=state.replacement?.stage==='complete'?'Device revoked. A fresh online activation is required to use that device again.':'Payment checked.';});break;case 'support-details':void perform(async()=>{const details=await host('supportDetails');if(!/^[A-Za-z0-9_-]{43}$/.test(details.supportDeviceId))throw Error('Device support details unavailable');state.supportDeviceId=details.supportDeviceId;});break;case 'select':void perform(async()=>acceptFiles(await host('selectFiles')));break;case 'clear':void perform(async()=>{await host('releaseSelection',{ids:state.files.map(f=>f.id)});state.files=[];batchResults=[];savedOutput=null;state.launchIntent=null;});break;case 'reset-search':state.query='';render();document.querySelector<HTMLInputElement>('#tool-search')?.focus();break;case 'trial':void perform(async()=>{Object.assign(state,await host('startTrial'));state.notice='Trial activated.';});break;case 'refresh-license':void perform(async()=>{Object.assign(state,await host('refreshLicense'));state.notice='License verified.';});break;case 'license-devices':void perform(async()=>{state.devices=(await host('licenseDevices')).devices;});break;case 'folder':void perform(async()=>{const result=await host('chooseFolder');if(result.selected)state.notice='Output folder saved.';});break;case 'updates':void perform(async()=>{const result=await host('checkUpdates');state.notice=result.message;});break;case 'quit':void perform(async()=>{await host('quit');});break;case 'reveal-key':{const input=document.querySelector<HTMLInputElement>('#license-key')!;input.type=input.type==='password'?'text':'password';target.textContent=t(input.type==='password'?'Show':'Hide');target.setAttribute('aria-pressed',String(input.type==='text'));break;}}
});
root.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-reset-adjustments]');if(!button||state.busy)return;button.closest('details')?.querySelectorAll<HTMLInputElement>('input[name^="adjust-"]').forEach(input=>input.value='0');document.querySelector('#announcement')!.textContent='Colour and detail adjustments reset.';});
root.addEventListener('input',event=>{const range=event.target as HTMLInputElement;if(range.type==='range'&&range.closest('.percent-field')){syncPercentRange(range);if(range.name==='strength'&&range.form)syncProcessingOptions(range.form);}});
root.addEventListener('input',event=>{const input=event.target as HTMLInputElement;if(input.id!=='tool-search')return;state.query=input.value;const position=input.selectionStart;render();const replacement=document.querySelector<HTMLInputElement>('#tool-search')!;replacement.focus();try{replacement.setSelectionRange(position,position);}catch{}});
root.addEventListener('change',async event=>{const input=event.target as HTMLInputElement;if(input.form?.id==='processing-form')syncProcessingOptions(input.form);if(input.id==='output-mode'||input.id==='theme'||input.id==='language'||input.id==='startup'||input.id==='shellEntry'){
 const value=input.type==='checkbox'?input.checked:input.value;
 if((input.id==='startup'||input.id==='shellEntry')&&!value){input.checked=state[input.id];if(!await confirmDisableQuickAction(input.id,state.platform))return;}
 void perform(async()=>{const settings=await host('saveSettings',{[input.id==='output-mode'?'output':input.id]:value});Object.assign(state,settings);});
}});
root.addEventListener('submit',event=>{
 const replacementForm=(event.target as HTMLFormElement).id;
 if(replacementForm.startsWith('replacement-')){
  event.preventDefault();if(state.busy)return;
  const key=root.querySelector<HTMLInputElement>('#replacement-key')?.value.trim();
  const email=root.querySelector<HTMLInputElement>('#replacement-email')?.value.trim()||'';
  const code=root.querySelector<HTMLInputElement>('#replacement-code')?.value.trim();
  const oldDeviceId=root.querySelector<HTMLSelectElement>('#replacement-device')?.value;
  if(replacementForm==='replacement-start-form'&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)){state.error='Enter the email address you used for your purchase.';state.notice='';render();root.querySelector<HTMLInputElement>('#replacement-email')?.focus();return;}
  if(replacementForm==='replacement-start-form'&&root.querySelector('#replacement-key')&&!key){state.error='Enter your license key.';state.notice='';render();root.querySelector<HTMLInputElement>('#replacement-email')!.value=email;root.querySelector<HTMLInputElement>('#replacement-key')?.focus();return;}
  root.querySelectorAll<HTMLInputElement>('#replacement-key,#replacement-code').forEach(input=>input.value='');
  void perform(async()=>{if(replacementForm==='replacement-start-form'){state.replacement={...(state.replacement||{}),email};Object.assign(state,await host('replacementEmailStart',key?{email,licenseKey:key}:{email}));state.notice='Code sent. Check your inbox and Spam folder.';}
   else if(replacementForm==='replacement-verify-form')Object.assign(state,await host('replacementEmailVerify',{code}));
   else if(replacementForm==='replacement-pay-form'){Object.assign(state,await host('replacementRequest',{oldDeviceId}));await host('replacementCheckout');state.notice='Finish payment in your browser, then check payment here.';}
  });return;
 }

 if((event.target as HTMLFormElement).id==='processing-form'){
  event.preventDefault();if(state.busy)return;
  const tool=state.tool,selectionIds=state.files.map(file=>file.id);let options;
  try{options=readProcessingOptions(event.target as HTMLFormElement,tool,{crop:CROP_TOOLS.has(tool)?cropPixels(state.files):undefined});}catch(error){state.error=(error as Error).message;render();return;}
  if(tool==='protect-pdf')(event.target as HTMLFormElement).querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(input=>input.value='');
  if(!selectionIds.length){state.error='Choose files first.';render();return;}
  if(tool==='merge-pdf'&&selectionIds.length<2){state.error='Choose at least two PDFs to merge.';render();return;}
  const sources=state.files.map(file=>file.name);batchResults=[];savedOutput=null;
  state.processing=true;
  // The compact right-click card closes itself once every file is saved; any
  // failure, cancellation or error keeps it open so the message stays visible.
  let allSaved=false;
  void perform(async()=>{try{const result=await host('processFiles',{tool,selectionIds,options});
   processingResult(result,sources);
   allSaved=result.state==='completed'||result.state==='batch'&&result.results.length>0&&result.results.every((row:any)=>row.state==='completed');
  }finally{state.processing=false;}}).then(()=>{
   if(allSaved&&!state.error)afterSuccessfulRun(tool);
   if(quick.active&&allSaved&&!state.error)void host('closeQuickAction').catch(()=>{});
   else if(ratingPrompt&&!ratingPrompt.done&&state.page==='workspace'){render();}
  });return;
 }
 if((event.target as HTMLFormElement).id!=='license-form')return;event.preventDefault();const input=document.querySelector<HTMLInputElement>('#license-key')!;const key=input.value.trim();if(!key)return;input.value='';void perform(async()=>{Object.assign(state,await host('activate',{licenseKey:key}));state.notice='License activated.';});});
root.addEventListener('dragover',event=>{event.preventDefault();(event.target as HTMLElement).closest('[data-dropzone]')?.classList.add('dragging');});root.addEventListener('dragleave',event=>(event.target as HTMLElement).closest('[data-dropzone]')?.classList.remove('dragging'));
root.addEventListener('drop',event=>{event.preventDefault();const files=Array.from(event.dataTransfer?.files||[]);if(files.length)void perform(async()=>acceptFiles(await host('dropFiles',{},files)));});
document.addEventListener('keydown',event=>{if((state.platform==='macos'?event.metaKey:event.ctrlKey)&&!event.altKey&&event.key.toLowerCase()==='o'){event.preventDefault();void perform(async()=>acceptFiles(await host('selectFiles')));}if(state.platform==='macos'&&event.metaKey&&event.key===','){event.preventDefault();navigate('settings');}if((state.platform==='macos'?event.metaKey:event.ctrlKey)&&!event.altKey&&event.key.toLowerCase()==='k'){event.preventDefault();toolCategory='all';navigate('tools');document.querySelector<HTMLInputElement>('#tool-search')?.focus();}if(event.key==='Escape'){if(state.page==='tools'&&state.query){state.query='';render();document.querySelector<HTMLInputElement>('#tool-search')?.focus();}else if(state.page==='workspace')navigate('tools');}if(event.key==='Enter'&&(event.target as HTMLElement).id==='tool-search'){const first=root.querySelector<HTMLButtonElement>('[data-tool]');if(first){event.preventDefault();state.tool=first.dataset.tool!;navigate('workspace');}}});
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
onNativeNotice(message=>{document.querySelector('#announcement')!.textContent=t(message);if(state.busy)document.querySelector('#pending-action')!.textContent=t(message);});
bindCanvas(root,()=>({tool:state.tool,files:state.files}),fitSizeToCrop);
// Pointer: a click rates. Keyboard: arrows only choose; Enter or Space confirms.
let ratingByKeyboard=false;
root.addEventListener('pointerdown',event=>{if((event.target as HTMLElement).closest('.rating-stars'))ratingByKeyboard=false;});
root.addEventListener('keydown',event=>{
 const input=event.target as HTMLInputElement;if(input.name!=='rating-prompt')return;
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))ratingByKeyboard=true;
 else if(event.key==='Enter'||event.key===' '){event.preventDefault();const checked=root.querySelector<HTMLInputElement>('input[name="rating-prompt"]:checked')??(event.key===' '?input:null);if(checked){checked.checked=true;ratingByKeyboard=false;submitPromptRating(Number(checked.value));}}
});
root.addEventListener('change',event=>{
 const input=event.target as HTMLInputElement;if(input.name!=='rating-prompt'||ratingByKeyboard)return;
 submitPromptRating(Number(input.value));
});
function submitPromptRating(rating:number){
 if(!ratingPrompt||ratingPrompt.done)return;
 const prompt=ratingPrompt;
 root.querySelectorAll<HTMLInputElement>('input[name="rating-prompt"]').forEach(item=>item.disabled=true);
 void host('ratingSubmit',{subject:prompt.tool,rating}).then((result:any)=>{
  toolRatings[prompt.tool]=result.rating;promptState=recordRated(promptState,prompt.tool,rating);savePromptState();
  prompt.done=true;prompt.status=t('Thanks for rating!');
 }).catch(()=>{prompt.status=t('Your rating could not be sent. Your files are not affected. Please try again later.');})
  .finally(()=>{if(state.page!=='workspace')return;const checked=rating;render();const again=root.querySelector<HTMLInputElement>(`input[name="rating-prompt"][value="${checked}"]`);if(again)again.checked=true;
   if(prompt.done)setTimeout(()=>{if(ratingPrompt===prompt){ratingPrompt=null;if(state.page==='workspace')render();}},4000);});
}
// Keep aspect ratio: with a known source, width and height follow each other.
root.addEventListener('input',event=>{
 const input=event.target as HTMLInputElement,form=input.form;
 if(state.tool!=='resize-image'||form?.id!=='processing-form'||!['width','height'].includes(input.name))return;
 const size=cropSize(state.files),value=Number(input.value);
 if(!size||!value||!form.querySelector<HTMLInputElement>('input[name="keep"]')?.checked)return;
 const other=form.querySelector<HTMLInputElement>(`input[name="${input.name==='width'?'height':'width'}"]`);
 if(other)other.value=String(Math.max(1,Math.round(input.name==='width'?value*size.height/size.width:value*size.width/size.height)));
});
render();void host('getState').then(data=>{quick.active=data.quickAction===true;Object.assign(state,data);if(data.launchIntent?.action)applyNativeAction(data.launchIntent.action);else{if(data.launchIntent?.actions)state.page='native';render();}restoreJob(data.job);void host('licenseStatus').then(status=>{Object.assign(state,status);render();}).catch(()=>{});}).catch(error=>{state.error=error.message;render();});

const cancelProcessing=document.createElement('button');cancelProcessing.id='cancel-processing';cancelProcessing.className='secondary cancel-processing';cancelProcessing.textContent=t('Cancel processing');cancelProcessing.hidden=true;document.body.append(cancelProcessing);cancelProcessing.addEventListener('click',()=>{cancelProcessing.disabled=true;void host('cancelProcessing').catch(()=>{state.error='Cancellation could not be requested.';}).finally(()=>{cancelProcessing.disabled=false;});});
