// Copy the locked, presentation-only Desktop overview. No prototype engines or checkout code.
import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),postcss=require('postcss');
const root=resolve('.artifacts/v10-handoff/sorafiles-tools-desktop-subpages-prototype-launchit-inspired-v2');
const source=`import React from 'react';import{renderToStaticMarkup}from'react-dom/server';import{MemoryRouter}from'react-router-dom';
import{DesktopHero}from'./src/components/desktop/DesktopHero';import{WorkflowDemo}from'./src/components/desktop/WorkflowDemo';import{Benefits,Platforms}from'./src/components/desktop/Benefits';import{Comparison,FinalCta,Faq}from'./src/components/desktop/DesktopSections';
export const html=renderToStaticMarkup(<MemoryRouter><DesktopHero/><WorkflowDemo/><Benefits/><Platforms/><Comparison/><FinalCta/><Faq/></MemoryRouter>);`;
const out=resolve('.artifacts/prototype-overview-render.mjs');
await build({stdin:{contents:source,resolveDir:root,loader:'jsx'},outfile:out,bundle:true,platform:'node',format:'esm',jsx:'automatic',loader:{'.js':'jsx','.css':'empty'},define:{'window.matchMedia':'__referenceMedia','process.env.NODE_ENV':'"production"'},banner:{js:"import {createRequire as __cr} from 'node:module';const require=__cr(import.meta.url);const __referenceMedia=()=>({matches:false});"}});
const {html}=await import(pathToFileURL(out).href);
// Trial policy is a live app fact, not a mock value in the reference.
const truthful=html.replace('Your 7-day trial starts during installation on Windows, or on first launch on macOS and Linux. Works offline after setup. When the trial ends, processing needs a valid license; settings stay available.','Your 7-day trial starts when you first open SoraFiles Desktop on Windows, macOS or Linux. Connect to finish setup; waiting to connect does not extend the trial. When it ends, processing needs a valid license; settings stay available.');
await writeFile('src/data/prototypeDesktopOverview.json',JSON.stringify(truthful)+'\n');
let css='';
for(const file of ['styles/base.css','components/ui/button.css','components/ui/context-menu.css','components/desktop/desktop.css','components/desktop/workflow-demo.css']){
 let content=await readFile(root+'/src/'+file,'utf8');
 if(file==='styles/base.css')content=content.slice(content.indexOf('/* Type roles */'),content.indexOf('/* Theme switch:'))+'\n'+content.slice(content.indexOf('@media (prefers-reduced-motion: reduce)'));
 css+='\n'+content;
}
const ast=postcss.parse(css);ast.walkRules(rule=>{if(rule.parent.type==='atrule'&&/keyframes/.test(rule.parent.name))return;rule.selectors=rule.selectors.map(selector=>':where([data-prototype-desktop]) '+selector)});
await writeFile('src/styles/v10-desktop-exact.css',ast.toString());
console.log('Copied original Desktop overview markup and styles.');
