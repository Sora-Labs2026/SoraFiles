import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:760,height:600}});await page.setContent('<style>html{zoom:2}body{margin:0}.side{position:fixed;left:0;top:0;width:226px;height:100vh;background:red}main{margin-left:226px;width:154px}button{width:84px;height:59px;margin:17px}</style><aside class="side"></aside><main><div style="height:2000px"></div><button>Test</button></main>');
 await page.locator('button').scrollIntoViewIfNeeded();console.log(await page.locator('button').evaluate(el=>{const r=el.getBoundingClientRect();return {r:r.toJSON(),hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.tagName,hitDouble:document.elementFromPoint((r.x+r.width/2)*2,(r.y+r.height/2)*2)?.tagName};}));
 await page.screenshot({path:'.artifacts/edge-zoom-probe.png'});
}finally{await browser.close();}
