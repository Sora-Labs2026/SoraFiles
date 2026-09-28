// Authoring-only extraction of the owner's exact Desktop marketing frontend.
// Generated HTML has no React/runtime dependency. Production bindings are applied in Astro.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const postcss=require('postcss');
const root=resolve('.artifacts/v10-handoff/sorafiles-tools-desktop-subpages-prototype-launchit-inspired-v2');
const out=resolve('src/components/desktop-prototype');
await mkdir(out,{recursive:true});
const bundle=await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {MemoryRouter} from 'react-router-dom';import DesktopPage from './src/pages/DesktopPage';import PricingPage from './src/pages/PricingPage';import HelpPage from './src/pages/HelpPage';import RedeemPage from './src/pages/RedeemPage';import {copy} from './src/copy';import * as icons from 'lucide-react';export {copy};export function render(page,path){return renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:[path]},React.createElement({index:DesktopPage,pricing:PricingPage,help:HelpPage,redeem:RedeemPage}[page])))}export function svg(name,size=20){return renderToStaticMarkup(React.createElement(icons[name],{size,'aria-hidden':true}));}`,resolveDir:root,loader:'jsx'},bundle:true,platform:'node',format:'esm',jsx:'automatic',write:false,loader:{'.js':'jsx','.css':'empty'},plugins:[{name:'static-extraction',setup(b){
 b.onLoad({filter:/PageShell\.jsx$/},()=>({contents:'export const PageShell=({children})=>children;',loader:'jsx'}));
 b.onLoad({filter:/DesktopSubnav\.jsx$/},()=>({contents:'export const DesktopSubnav=()=>null;',loader:'jsx'}));
 b.onLoad({filter:/ProtoLink\.jsx$/},()=>({contents:'export const ProtoLink=({children,...props})=><a {...props}>{children}</a>;',loader:'jsx'}));
 b.onLoad({filter:/useReducedMotion\.js$/},()=>({contents:'export const useReducedMotion=()=>false;',loader:'js'}));
 b.onLoad({filter:/useInView\.js$/},()=>({contents:'export const useInView=()=>true;',loader:'js'}));
}}]});
await writeFile('.artifacts/desktop-prototype-render.mjs',"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);\n"+bundle.outputFiles[0].text);
const source=await import('../.artifacts/desktop-prototype-render.mjs?'+Date.now());
for(const name of ['index','pricing','help','redeem']){
 let html=source.render(name,name==='index'?'/desktop':'/desktop/'+name);
 html=html.replaceAll('href="#apple-support"','href="https://support.apple.com/en-us/102445"');
 html=html.replace('Your 7-day trial starts during installation on Windows, or on first launch on macOS and Linux.','Your 7-day trial starts when you first open SoraFiles Desktop on Windows, macOS or Linux.');
 html=html.replace('Your free 7-day trial begins automatically during Windows installation, or when you first open the app on macOS or Linux.','Your free 7-day trial begins automatically when you first open SoraFiles Desktop on Windows, macOS or Linux.');
 if(name==='pricing')html=html.replace(/href="#checkout"([^>]*data-testid="plan-(personal|team)-choose")/g,(_,attrs,id)=>`href="https://license.sorafiles.com/v1/checkout?plan=${id}-monthly"${attrs}`);
 await writeFile(out+'/'+name+'.html',html+'\n');
}
await writeFile(out+'/copy.json',JSON.stringify(source.copy.desktop,null,2)+'\n');
await writeFile(out+'/icons.json',JSON.stringify(Object.fromEntries(['Download','Play','Pause','RotateCcw','CircleCheck','LoaderCircle','Lock'].map(name=>[name,source.svg(name)])),null,2)+'\n');
const base=await readFile(root+'/src/styles/base.css','utf8');
let css=base.slice(base.indexOf('/* Type roles */'),base.indexOf('.skip-link'))+base.slice(base.indexOf('/* Page-load motion:'));
for(const file of ['components/site/site.css','components/desktop/desktop.css','components/desktop/workflow-demo.css','components/ui/context-menu.css','components/tool/controls.css'])css+='\n'+await readFile(root+'/src/'+file,'utf8');
const ast=postcss.parse(css);ast.walkRules(rule=>{if(rule.parent.type==='atrule'&&/keyframes/.test(rule.parent.name))return;rule.selectors=rule.selectors.map(s=>'[data-desktop-page] '+s)});
await writeFile('src/styles/v10-desktop-exact.css',ast.toString()+'\n[data-desktop-page] [hidden]{display:none!important}\n');
console.log('Extracted exact Desktop frontend, icons, copy and scoped styles.');
