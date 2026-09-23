import {plans,verifiedCatalog} from '../shared/plans.mjs';

export function amountInMinorUnits(amount,currency){
 if(!Intl.supportedValuesOf('currency').includes(currency)||!/^\d+\.\d{2}$/.test(amount))throw Error('Unsupported currency/amount');
 const digits=new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits;
 const [whole,fraction]=amount.split('.');if(digits<2&&Number(fraction.slice(digits))!==0)throw Error('Launch amount cannot be represented in configured currency');
 const minor=BigInt(whole)*10n**BigInt(digits)+BigInt((fraction+'0000').slice(0,digits)||'0');
 if(minor>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Amount out of range');return Number(minor);
}
export function verifyDodoProduct(planId,product,expected){
 assertDesktopProductCopy(product);
 const plan=plans[planId],price=product?.price;
 if(!plan||product.product_id!==expected.productId||!price||price.price!==amountInMinorUnits(plan.amount,price.currency))throw Error('Dodo launch price mismatch');
 if(product.is_recurring!==plan.recurring||price.type!==(plan.recurring?'recurring_price':'one_time_price'))throw Error('Dodo billing type mismatch');
 if(price.tax_inclusive!==true)throw Error('Dodo launch prices must include tax');
 if(price.discount||price.discount_bps||price.pay_what_you_want||price.purchasing_power_parity||product.pricing_mode||price.trial_period_days)throw Error('Dodo price overrides require review');
 if(plan.recurring){const count=price.payment_frequency_count,interval=price.payment_frequency_interval;const correct=plan.interval==='monthly'?count===1&&interval==='Month':count===1&&interval==='Year'||count===12&&interval==='Month';if(!correct)throw Error('Dodo billing interval mismatch');}
 const entitlements=product.entitlements?.filter(e=>e.id===expected.entitlementId&&e.integration_type==='license_key');
 if(entitlements?.length!==1)throw Error('Dodo license entitlement missing');const config=entitlements[0].integration_config;
 if(config?.activations_limit!==plan.maxDevices||config.duration_count!=null||config.duration_interval!=null||config.fulfillment_mode==='manual')throw Error('Dodo license configuration mismatch');
 return {plan:plan.id,amount:plan.amount,interval:plan.interval,activationLimit:plan.maxDevices,currency:price.currency,productId:expected.productId,entitlementId:expected.entitlementId,verified:true};
}
// Inspect only public product/entitlement copy and metadata; never log provider
// payloads. This is a release guard, not a substitute for dashboard review.
export function assertDesktopProductCopy(product){
 const copy={name:product?.name,description:product?.description,metadata:product?.metadata,
  entitlements:product?.entitlements?.map(e=>({name:e.name,description:e.description,metadata:e.metadata,integration_config:e.integration_config}))};
 const normalized=JSON.stringify(copy).normalize('NFKC').replace(/[^a-z0-9]+/gi,' ').toLowerCase();
 if(/(?:unlock\s*pdf|pdf\s*unlock|decrypt\s*pdf|pdf\s*decrypt|unprotect\s*pdf|remove\s*pdf\s*password|bypass\s*pdf\s*password|strip\s*pdf\s*security)/.test(normalized))throw Error('Dodo product copy includes an excluded Desktop capability');
}
// Read-only API checks; never creates products, checkout sessions or charges.
export async function fetchVerifiedCatalog(dodo,config){
 if(!Array.isArray(config)||config.length!==6||new Set(config.map(r=>r.plan)).size!==6)throw Error('Six unique plan mappings required');
 const rows=[];for(const row of config){if(!plans[row.plan]||typeof row.productId!=='string'||!row.productId||typeof row.entitlementId!=='string'||!row.entitlementId)throw Error('Invalid plan mapping');rows.push(verifyDodoProduct(row.plan,await dodo.product(row.productId),row));}
 verifiedCatalog(rows);return rows;
}
