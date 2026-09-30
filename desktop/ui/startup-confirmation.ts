import {localizeUi} from './localization';
export function confirmDisableQuickAction(setting:'startup'|'shellEntry',platform:string):Promise<boolean>{
 const startup=setting==='startup';
 const title=startup?'Turn off the sign-in helper?':'Remove SoraFiles from right-click menus?';
 const description=startup?(platform==='windows'?'SoraFiles will no longer start its background helper when you sign in to Windows. Edit with SoraFiles will still work, but the first action may take longer to start.':'SoraFiles will no longer start its background helper when you sign in. Edit with SoraFiles will still work, but the first action may take longer to start.'):'Edit with SoraFiles will no longer appear in supported file-manager menus. You can still open SoraFiles and choose files in the app.';
 const dialog=document.createElement('dialog');
 dialog.className='startup-confirmation';
 dialog.setAttribute('aria-labelledby','startup-confirmation-title');
 dialog.setAttribute('aria-describedby','startup-confirmation-description');
 dialog.innerHTML=`<h2 id="startup-confirmation-title">${title}</h2><p id="startup-confirmation-description">${description}</p><p>You can turn this back on in Settings.</p><form method="dialog"><button class="secondary" value="disable">Turn off</button><button class="primary" value="keep" autofocus>Keep enabled</button></form>`;
 document.body.append(dialog);
 localizeUi(dialog);
 return new Promise(resolve=>{
  dialog.addEventListener('close',()=>{const confirmed=dialog.returnValue==='disable';dialog.remove();document.querySelector<HTMLInputElement>('#'+setting)?.focus();resolve(confirmed);},{once:true});
  dialog.showModal();
 });
}
