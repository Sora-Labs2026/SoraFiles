import {build} from 'esbuild';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve('.artifacts/v10-handoff/sorafiles-tools-desktop-subpages-prototype-launchit-inspired-v2');
const out=resolve('.artifacts/prototype-help-render.mjs');
await build({stdin:{contents:`import React from'react';import{renderToStaticMarkup}from'react-dom/server';import{MemoryRouter}from'react-router-dom';import Page from'./src/pages/HelpPage';export const html=renderToStaticMarkup(<MemoryRouter initialEntries={['/desktop/help']}><Page/></MemoryRouter>);`,resolveDir:root,loader:'jsx'},outfile:out,bundle:true,platform:'node',format:'esm',jsx:'automatic',loader:{'.js':'jsx','.css':'empty'},define:{'process.env.NODE_ENV':'"production"'},banner:{js:"import{createRequire as __cr}from'node:module';const require=__cr(import.meta.url);"},plugins:[{name:'presentation-only',setup(b){b.onLoad({filter:/PageShell\.jsx$/},()=>({contents:'export const PageShell=({children})=>children;',loader:'jsx'}))}}]});
let {html}=await import(pathToFileURL(out).href);
html=html.replace('href="#apple-support"','href="https://support.apple.com/en-us/102445"')
 .replace('<section id="smartscreen"','<span id="windows-unsigned" aria-hidden="true"></span><section id="smartscreen"')
 .replace('<section id="promo-code"','<span id="promo-codes" aria-hidden="true"></span><section id="promo-code"')
 .replace('Your free 7-day trial begins automatically during Windows installation, or when you first open the app on macOS or Linux.','Your free 7-day trial begins automatically when you first open SoraFiles Desktop on Windows, macOS or Linux. Connect to finish trial setup; waiting to connect does not extend the trial.')
 .replace('Works offline after setup; file processing stays on your device.','File processing works offline after setup. Setup, activation and subscription renewals need an internet connection. A Lifetime license continues to work offline after activation.');
await writeFile('src/data/prototypeDesktopHelp.json',JSON.stringify(html)+'\n');
console.log('Copied help frontend, retaining live first-launch trial policy and Apple support link.');
