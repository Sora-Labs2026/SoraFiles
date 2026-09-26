import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { guides, guideSchema } from '../../src/data/guides.ts';
import { liveTools } from '../../src/data/liveTools.ts';
const origin=process.env.SORA_BASE_URL||'http://127.0.0.1:4321';
const folder=origin.includes('127.0.0.1')?'.artifacts/astra-guides-local':'.artifacts/astra-guides-live';
await mkdir(folder,{recursive:true});const rows=[];
const browser=await chromium.launch({channel:'msedge'});
try {
 for(const width of [1147,320])for(const slug of ['',...guides.map(g=>g.slug)]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  const path='/guides'+(slug?'/'+slug:'');
  const response=await page.goto(origin+path);assert.equal(response.status(),200);
  if(width===320)await page.evaluate(()=>document.documentElement.classList.add('dark'));
  assert.equal(await page.locator('h1').count(),1);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://sorafiles.com'+path);
  assert.doesNotMatch(await page.locator('meta[name="robots"]').getAttribute('content')||'',/noindex/);
  assert.equal(await page.locator('link[hreflang]').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow '+path);
  if(slug){
   const guide=guides.find(g=>g.slug===slug);assert.equal(await page.locator('h1').innerText(),guide.title);
   const schemas=await page.locator('script[type="application/ld+json"]').evaluateAll(nodes=>nodes.flatMap(n=>{const x=JSON.parse(n.textContent);return Array.isArray(x)?x:[x]}));
   for(const expected of guideSchema(guide))assert.deepEqual(schemas.find(x=>x['@type']===expected['@type']),expected);
   if(guide.publishedAt) assert.equal(await page.locator('main time').first().getAttribute('datetime'),guide.publishedAt);
   else assert.equal(await page.locator('main time').count(),0,'undated guide must not invent a date');
   const tables=page.locator('article [role="region"]');
   assert.equal(await tables.count(),guide.body.filter(b=>b.type==='table').length);
   for(const region of await tables.all()){
    await region.scrollIntoViewIfNeeded();assert.ok(await region.evaluate(n=>n.getBoundingClientRect().right<=innerWidth+1));
    if(width===320){await region.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(150);assert.ok(await region.evaluate(n=>n.scrollLeft>0));}
   }
   const heading=page.locator('article h2[id]').first();const id=await heading.getAttribute('id');
   await page.evaluate(id=>location.hash=id,id);await page.waitForTimeout(150);
   assert.ok(await heading.evaluate(n=>n.getBoundingClientRect().top>=64),'heading hidden under header');
   if(guide.targetTool){const tool=liveTools.find(t=>t.id===guide.targetTool);assert.ok(await page.locator(`article a[href="/${tool.slug}"]`).count()>0);}
   await page.locator('article').screenshot({path:`${folder}/${slug}-${width}.png`});
  }else for(const g of guides)assert.ok(await page.locator(`main a[href="/guides/${g.slug}"]`).count()>0);
  const links=await page.locator('main a[href^="/"]').evaluateAll(nodes=>[...new Set(nodes.map(n=>n.getAttribute('href')))]);
  rows.push({path,width,status:'PASS',links});await page.close();
 }
 const p=await browser.newPage();await p.goto(origin+'/');
 assert.equal(await p.locator('[data-pdf-tile-label]').innerText(),'PDF');
 assert.equal(await p.locator('[data-device-icon] path').getAttribute('d'),'M7 10V7a5 5 0 0 1 10 0v3');
 await p.locator('[data-hero-visualization]').screenshot({path:folder+'/hero-icons.png'});
 for(const tool of liveTools){const expected=guides.filter(g=>g.targetTool===tool.id||g.relatedTools.includes(tool.id));if(!expected.length)continue;
  await p.goto(origin+'/'+tool.slug);for(const g of expected)assert.ok(await p.locator(`a[href="/guides/${g.slug}"]`).count()>0,tool.slug+' missing '+g.slug);
 }
 await p.close();
}finally{await browser.close();await writeFile(folder+'/results.json',JSON.stringify(rows,null,2));}
const links=[...new Set(rows.flatMap(r=>r.links))];
for(const path of links){const res=await fetch(origin+path,{redirect:'manual'});assert.equal(res.status,200,path);}
console.log(`PASS ${rows.length}/14 reading cases; ${links.length} canonical internal links; related guides, schemas, indexability, mobile tables, heading anchors and hero icons.`);
