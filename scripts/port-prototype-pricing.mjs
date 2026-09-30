import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve('.artifacts/v10-handoff/sorafiles-tools-desktop-subpages-prototype-launchit-inspired-v2');
const plans=JSON.parse(await readFile('src/data/desktopPlans.json','utf8'));
const periods=['monthly','annual','lifetime'],pages={};
for(const [index,period]of periods.entries()){
 const out=resolve(`.artifacts/prototype-pricing-${period}.mjs`);
 await build({stdin:{contents:`import React from 'react';import{renderToStaticMarkup}from'react-dom/server';import{MemoryRouter}from'react-router-dom';import Page from './src/pages/PricingPage';export const html=renderToStaticMarkup(<MemoryRouter initialEntries={['/desktop/pricing']}><Page/></MemoryRouter>);`,resolveDir:root,loader:'jsx'},outfile:out,bundle:true,platform:'node',format:'esm',jsx:'automatic',loader:{'.js':'jsx','.css':'empty'},define:{'process.env.NODE_ENV':'"production"'},banner:{js:"import{createRequire as __cr}from'node:module';const require=__cr(import.meta.url);"},plugins:[{name:'presentation-adapter',setup(b){b.onLoad({filter:/PageShell\.jsx$/},()=>({contents:'export const PageShell=({children})=>children;',loader:'jsx'}));b.onLoad({filter:/PricingPage\.jsx$/},async({path})=>({contents:(await readFile(path,'utf8')).replace('useState("monthly")',`useState("${period}")`),loader:'jsx'}))}}]});
 let {html}=await import(pathToFileURL(out).href);
 for(const plan of plans){
  for(const [suffix,value]of [['price','$'+plan.prices[index]],['replacement-fee','$'+plan.replacement[index]]])html=html.replace(new RegExp(`(data-testid="plan-${plan.id}-${suffix}">)[^<]+`),'$1'+value.replaceAll('$','$$$$'));
  html=html.replace(new RegExp(`<a[^>]+data-testid="plan-${plan.id}-choose"[^>]*>`),tag=>tag.replace('href="#checkout"',`href="https://license.sorafiles.com/v1/checkout?plan=${plan.id}-${period}" rel="noreferrer"`));
 }
 const start=html.indexOf('<ul class="plans"'),end=html.indexOf('</ul><p class="t-small pricing__web"',start)+5;
 if(start<0||end<5||html.includes('href="#checkout"'))throw Error('Pricing adapter boundary changed');
 pages[period]={html,plans:html.slice(start,end)};
}
await writeFile('src/data/prototypePricing.json',JSON.stringify(pages)+'\n');
console.log('Copied pricing presentation with live checkout links and existing production prices.');
