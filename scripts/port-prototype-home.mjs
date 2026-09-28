// Reproduce the owner-supplied, locked homepage; engines remain in their routes.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const root='.artifacts/v10-handoff/sorafiles-tools-desktop-subpages-prototype-launchit-inspired-v2';
const React=require('../'+root+'/node_modules/react');
const renderer=require('../'+root+'/node_modules/react-dom/server');
const icons=require('../'+root+'/node_modules/lucide-react');
const svg=(name,size=20)=>renderer.renderToStaticMarkup(React.createElement(icons[name],{size,'aria-hidden':true}));
const registry=await readFile(root+'/src/data/tools.js','utf8');
const tools=[...registry.matchAll(/\{ id: "([^"]+)", name: "([^"]+)", category: "([^"]+)", href: "([^"]+)", icon: (\w+), outcome: "([^"]+)", keywords: (\[[^\]]+\]) \}/g)].map(m=>({id:m[1],name:m[2],category:m[3],href:m[4],icon:svg(m[5]),outcome:m[6],keywords:JSON.parse(m[7])}));
if(tools.length!==26)throw Error('Expected exact 26-tool prototype registry');
await writeFile('src/data/prototypeHomeTools.json',JSON.stringify(tools,null,2)+'\n');
await writeFile('src/data/prototypeIcons.json',JSON.stringify(Object.fromEntries(['Sun','Moon','Download','Menu','X','Globe','Heart'].map(name=>[name,svg(name,name==='Heart'?13:name==='Sun'||name==='Moon'?15:20)])),null,2)+'\n');
const layoutBase=await readFile(root+'/src/styles/base.css','utf8');
await writeFile('src/styles/v10-layout-exact.css',(await readFile(root+'/src/components/ui/button.css','utf8'))+'\n'+(await readFile(root+'/src/components/layout/layout.css','utf8'))+'\n'+(await readFile(root+'/src/components/brand/logo.css','utf8'))+'\n'+layoutBase.slice(layoutBase.indexOf('/* Type roles */'),layoutBase.indexOf('/* Layout */'))+'\n'+layoutBase.slice(layoutBase.indexOf('.visually-hidden {'),layoutBase.indexOf('/* Page-load motion:'))+'\n@media(min-width:48rem){.site-header .site-header__menu-btn{display:none}}\n');
const postcss=require('postcss');
let css=await readFile(root+'/src/components/ui/button.css','utf8');
css+='\n'+await readFile(root+'/src/components/home/home.css','utf8');
css+='\n'+await readFile(root+'/src/components/ui/context-menu.css','utf8');
const base=await readFile(root+'/src/styles/base.css','utf8');
css+='\n'+base.slice(base.indexOf('/* Type roles */'),base.indexOf('.visually-hidden'));
const ast=postcss.parse(css);ast.walkRules(rule=>{if(rule.parent.type==='atrule'&&/keyframes/.test(rule.parent.name))return;rule.selectors=rule.selectors.map(s=>':where([data-home-root],[data-prototype-directory]) '+s)});
await writeFile('src/styles/v10-home-exact.css',ast.toString()+'\n[data-prototype-directory] [hidden], [data-home-root] [hidden]{display:none!important}\n :where([data-home-root],[data-prototype-directory]) .tool-card__enter{display:none}\n :where([data-home-root],[data-prototype-directory]) .tool-card[data-top] .tool-card__enter{display:inline-grid}\n :where([data-home-root],[data-prototype-directory]) .tool-card[data-top] .tool-card__arrow{display:none}\n');
const mark='<svg class="logo-mark" width="13" height="13" viewBox="0 0 32 32" aria-hidden="true"><path fill="var(--brand-mark)" d="M18.5 4H26a2 2 0 0 1 2 2v6.75a2 2 0 0 1-2 2H7.75A10.75 10.75 0 0 1 18.5 4z"/><path fill="currentColor" d="M6 17.25h18.25A10.75 10.75 0 0 1 13.5 28H6a2 2 0 0 1-2-2v-6.75a2 2 0 0 1 2-2z"/></svg>';
await writeFile('src/components/PrototypeHomeSections.astro',`---
import type {LocalePath} from '../i18n/config';
import {prototypeText} from '../i18n/prototype';
interface Props {locale?:LocalePath;}
const {locale='en'}=Astro.props;
const t=(text:string)=>prototypeText(locale,text);
---
<section class="privacy section section--ruled" aria-labelledby="privacy-title" data-testid="privacy-statement">
 <div class="container"><div class="privacy__grid"><div class="privacy__copy">
  <h2 id="privacy-title" class="t-h1">{t("Processed on your device.")}</h2>
  <p class="t-lead privacy__text">{t("Supported tools run in your browser. File contents are never sent to a SoraFiles server.")}</p>
 </div><div class="flow" data-play="false" data-reveal-threshold="0.4" aria-hidden="true" data-testid="privacy-flow">
  <div class="flow__file"><span class="flow__tag tnum">PDF</span><span class="flow__text"><span class="flow__name tnum">{t("Contract.pdf")}</span><span class="flow__meta">2.1 MB</span></span></div>
  <span class="flow__line"><i></i></span><span class="flow__node">${svg('Laptop')}<span>{t("This device")}</span></span><span class="flow__line flow__line--2"><i></i></span>
  <div class="flow__file" data-result><span class="flow__tag tnum">PDF</span><span class="flow__text"><span class="flow__name tnum">{t("Contract-signed.pdf")}</span><span class="flow__meta">${svg('CircleCheck',13)}Ready</span></span></div>
 </div></div></div>
</section>
<section class="promo-section" aria-labelledby="promo-title" data-testid="desktop-promo"><div class="container"><div class="promo">
 <div class="promo__visual"><div class="rcm" data-play="false" data-reveal-threshold="0.5" aria-hidden="true"><div class="rcm__stage">
  <div class="rcm__file">${svg('FileText',16)}<span class="tnum">{t("Report.pdf")}</span></div>
  <div class="ctx-menu rcm__menu"><span class="ctx-menu__item">{t("Open")}</span><span class="ctx-menu__item">{t("Rename")}</span><span class="ctx-menu__sep"></span><span class="ctx-menu__item is-hot">${mark}Edit with SoraFiles ${svg('ChevronRight',14).replace('class="','class="ctx-menu__chev ')}</span></div>
  <div class="ctx-menu rcm__sub"><span class="ctx-menu__item is-hot">{t("Compress PDF")}</span><span class="ctx-menu__item">{t("Merge PDF")}</span><span class="ctx-menu__item">{t("PDF to JPG")}</span></div>
  <svg class="pointer rcm__pointer" width="18" height="22" viewBox="0 0 18 22" aria-hidden="true"><path d="M2 1.5v16.2l4.3-4 2.9 6.6 2.7-1.2-2.8-6.5h6.1z"/></svg>
 </div></div></div>
 <div class="promo__copy"><p class="eyebrow">{t("SoraFiles Desktop · Windows, macOS and Linux")}</p><h2 id="promo-title" class="t-h2">{t("Right-click a file. Pick a tool. Done.")}</h2><p class="promo__text">{t("Run SoraFiles from your file manager, on one file or a whole batch. Fewer steps for repeat work.")}</p><a class="btn btn--md btn--primary btn--chip" href="/desktop" data-testid="desktop-promo-link">Explore Desktop${svg('ArrowRight',17).replace('class="','class="btn__icon btn__icon--end ')}</a></div>
</div></div></section>
<script>
document.querySelectorAll<HTMLElement>('[data-reveal-threshold]').forEach(el=>{
 const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){el.dataset.play='true';observer.disconnect()}},{threshold:Number(el.dataset.revealThreshold),rootMargin:'0px 0px -8% 0px'});observer.observe(el);
});
</script>
`);
