// Keys and session proofs remain in memory. Never read them from URL parameters
// or persist them in browser storage. The server owns campaign/device authority.
export function mountRedemption(document, {request=fetch, clipboard=navigator.clipboard, listen=addEventListener}={}) {
  const form=document.querySelector('[data-redemption-form]');
  if(!form||document.querySelector('[data-redemption-enabled]')?.dataset.redemptionEnabled!=='true')return;
  const status=document.querySelector('[data-redemption-status]'),panel=document.querySelector('[data-redemption-result]');
  const keyField=document.querySelector('[data-redemption-key]'),reveal=document.querySelector('[data-redemption-reveal]');
  const submit=form.querySelector('button[type="submit"]'),code=form.querySelector('[name="code"]');
  let key='',busy=false,alive=true,controller;
  const post=async(path,body)=>{
    const response=await request(path,{method:'POST',mode:'same-origin',credentials:'same-origin',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!response.ok){await response.body?.cancel();throw Error(response.status===429?'Please wait before trying again.':response.status===401?'Verify the account associated with your invitation, then try again.':response.status===503?'Redemption is not ready. Keep your code and retry with the same verified account.':'This code could not be redeemed. Check it or contact support.');}
    if(!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||'')||!response.body)throw Error('Invalid redemption response. Contact support.');
    const reader=response.body.getReader(),parts=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384)throw Error('Invalid redemption response. Contact support.');parts.push(value);}}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    const bytes=new Uint8Array(size);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}
    try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw Error('Invalid redemption response. Contact support.');}
  };
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||key||!alive)return;
    const invitation=code.value.trim();if(!/^[A-Za-z0-9-]{8,128}$/.test(invitation)){status.textContent='Check your invitation code.';return;}
    busy=true;submit.disabled=true;code.disabled=true;code.value='';status.textContent='Verifying your invitation…';controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),30000);
    try{
      const session=await post('/api/desktop/redemption-session',{});
      if(typeof session.identityToken!=='string'||!session.identityToken||session.identityToken.length>8192)throw Error('Verify your invitation account before redeeming.');
      const result=await post('/api/desktop/redeem',{code:invitation,identityToken:session.identityToken});session.identityToken='';
      if(!alive)return;
      if(typeof result.licenseKey!=='string'||!/^[A-Za-z0-9_-]{6,512}$/.test(result.licenseKey)||!['Personal','Team'].includes(result.edition)||result.maxDevices!==(result.edition==='Personal'?1:5)||result.emailSent!==false||!(result.expiresAt===null||typeof result.expiresAt==='string'&&Number.isFinite(Date.parse(result.expiresAt))))throw Error('Invalid redemption response. Contact support.');
      key=result.licenseKey;panel.hidden=false;form.hidden=true;
      document.querySelector('[data-redemption-details]').textContent=`${result.edition} · ${result.maxDevices} ${result.maxDevices===1?'device':'devices'} · ${result.expiresAt===null?'Lifetime':('Expires '+new Date(result.expiresAt).toLocaleDateString())}`;
      status.textContent='Your invitation was redeemed. Save your license key privately.';
    }catch(error){if(alive)status.textContent=error.name==='AbortError'?'The request timed out. Retry the same code with the same verified account.':error.message;}
    finally{clearTimeout(timer);busy=false;submit.disabled=false;code.disabled=false;}
  });
  reveal.addEventListener('click',()=>{if(!key)return;keyField.hidden=!keyField.hidden;keyField.value=keyField.hidden?'':key;reveal.textContent=keyField.hidden?'Show key':'Hide key';reveal.setAttribute('aria-expanded',String(!keyField.hidden));});
  document.querySelector('[data-redemption-copy]').addEventListener('click',async()=>{if(!key)return;try{await clipboard.writeText(key);if(alive)status.textContent='License key copied.';}catch{if(alive)status.textContent='Choose Show key to select and copy it manually.';}});
  listen('pagehide',()=>{alive=false;controller?.abort();key='';code.value='';keyField.value='';keyField.hidden=true;panel.hidden=true;status.textContent='';});
}
