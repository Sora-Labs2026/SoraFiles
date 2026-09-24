// Optional transactional sender adapter. Credentials and verified sender belong
// only to the backend secret/config store; never to Desktop or browser assets.
export function createReplacementMailer({apiKey,from,request=fetch}){
 if(typeof apiKey!=='string'||!apiKey||typeof from!=='string'||from.length>254||!/^SoraFiles <[^\s<>@]+@[^\s<>@]+>$/.test(from))throw Error('Replacement email sender is not configured');
 return async({to,code,expiresAt,requestId})=>{
  if(typeof to!=='string'||to.length>254||/[\r\n]/.test(to)||!/^\d{8}$/.test(code)||!Number.isSafeInteger(expiresAt)||!/^[A-Za-z0-9_-]{43}$/.test(requestId))throw Error('Invalid verification email');
  const response=await request('https://api.resend.com/emails',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':'replacement-'+requestId},body:JSON.stringify({from,to:[to],subject:'Verify your SoraFiles device replacement',text:`Your SoraFiles verification code is ${code}.\n\nUse this code in SoraFiles to replace a device. It expires in 10 minutes and can be used once.\n\nIf you did not request this, ignore this email. Your device has not been replaced.`})});
  if(!response.ok){await response.body?.cancel();throw Error('Verification email delivery unavailable');}
  // No response payload, addresses, code or provider error is logged/returned.
  await response.body?.cancel();
 };
}
