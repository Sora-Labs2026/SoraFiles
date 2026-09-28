import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {parse} from 'parse5';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {publishedLocales,localizedRoutePaths} from '../src/i18n/config.ts';
const root='.artifacts/desktop-web-locales';await mkdir(root,{recursive:true});
const routes=['/desktop','/desktop/pricing','/desktop/download','/desktop/releases','/desktop/help','/desktop/purchase','/desktop/redeem'];
function mainShape(html){let main;function walk(n){if(n.tagName==='main')main=n;for(const child of n.childNodes||[])walk(child);}walk(parse(html));const nodes=[];function shape(n){if(n.tagName)nodes.push([n.tagName,(n.attrs||[]).find(a=>a.name==='class')?.value||'']);for(const child of n.childNodes||[])shape(child);}assert.ok(main);shape(main);return nodes;}
const originals=new Map(await Promise.all(routes.map(async route=>[route,mainShape(await readFile(`dist${route}/index.html`,'utf8'))])));
let pages=0;
for(const locale of publishedLocales)for(const route of localizedRoutePaths){const path=(locale.path==='en'?'':'/'+locale.path)+(route==='/'?'':route);const html=await readFile(`dist${path}/index.html`,'utf8');assert.ok(html.includes(`lang="${locale.code}"`),`${path}: language`);assert.ok(!/SORA_KEEP_|ZXQ\d{4}/.test(html),`${path}: placeholder`);if(routes.includes(route)){assert.deepEqual(mainShape(html),originals.get(route),`${path}: prototype structure`);assert.ok(html.includes(`href="https://sorafiles.com${path}"`),`${path}: canonical`);}pages++;}
const browser=await chromium.launch({channel:'msedge',headless:true});const checks=[],errors=[];
try{
 for(const locale of ['ja','ar','de']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://localhost:4395/${locale}/desktop/pricing`);await page.locator('[data-testid=billing-period]').waitFor();
  await page.locator('input[value=annual]').check({force:true});await page.waitForFunction(()=>document.querySelector('[data-testid=plan-personal-choose]')?.getAttribute('href')?.includes('annual'));
  assert.ok(!(await page.locator('[data-testid=plan-personal-choose]').innerText()).includes('Choose annual'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`${root}/${locale}-pricing.png`,fullPage:true});
  await page.goto(`http://localhost:4395/${locale}/desktop`);await page.locator('.fm').waitFor();await page.locator('[data-testid=demo-replay]').click();
  await page.waitForFunction(()=>!['5 items','1 of 5 selected','2 of 5 selected'].includes(document.querySelector('.fm__status')?.textContent?.trim()));
  assert.equal(await page.locator('html').getAttribute('dir'),locale==='ar'?'rtl':'ltr');
  await page.screenshot({path:`${root}/${locale}-overview.png`,fullPage:true});checks.push(locale+' pricing, checkout links, animation, layout');await page.close();
 }
 assert.deepEqual(errors,[]);
 await writeFile(`${root}/results.json`,JSON.stringify({pages,prototypeDesktopPages:133,checks,errors},null,2));console.log(JSON.stringify({pages,checks,errors}));
}finally{await browser.close();}
