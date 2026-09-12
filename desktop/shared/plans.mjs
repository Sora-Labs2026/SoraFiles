// Amounts are decimal strings, never assumed to be USD or cents.
export const plans=Object.freeze(Object.fromEntries([
 ['personal-monthly','Personal','monthly','4.99',1],['personal-annual','Personal','annual','49.99',1],['personal-lifetime','Personal','lifetime','249.99',1],
 ['team-monthly','Team','monthly','19.99',5],['team-annual','Team','annual','199.99',5],['team-lifetime','Team','lifetime','999.99',5],
].map(([id,edition,interval,amount,maxDevices])=>[id,Object.freeze({id,edition,interval,amount,maxDevices,recurring:interval!=='lifetime'})])));
export function verifiedCatalog(config){
 if(!Array.isArray(config)||config.length!==6)throw Error('Six Dodo product configurations required');
 const seen=new Set(),products=new Set(),entitlements=new Set();return config.map(p=>{const expected=plans[p.plan];if(!expected||seen.has(p.plan)||products.has(p.productId)||entitlements.has(p.entitlementId))throw Error('Unknown or duplicate plan/product/entitlement');seen.add(p.plan);products.add(p.productId);entitlements.add(p.entitlementId);
 if(p.amount!==expected.amount||p.activationLimit!==expected.maxDevices||p.interval!==expected.interval)throw Error('Dodo product differs from launch plan');
 if(!/^[A-Z]{3}$/.test(p.currency)||!p.productId||!p.entitlementId||p.verified!==true)throw Error('Unverified Dodo configuration');
 return Object.freeze({...expected,currency:p.currency,productId:p.productId,entitlementId:p.entitlementId});
 });
}
