import {mkdir} from 'node:fs/promises';
export async function captureJourney(driver,root,route,stage,row){
 if(process.env.SORA_UX_AUDIT!=='1')return;
 if(stage==='result'||stage==='arrival')await driver.page.waitForTimeout(350);
 await mkdir(`${root}/journeys`,{recursive:true});
 await driver.page.screenshot({path:`${root}/journeys/${route}-${stage}.png`});
 const state=await driver.page.evaluate(()=>{
  const controls=[...document.querySelectorAll('button,a[download],select,input,summary')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').map(el=>{
   const r=el.getBoundingClientRect(),style=getComputedStyle(el),target=el.id?'#'+el.id:[...el.attributes].filter(a=>a.name.startsWith('data-')).map(a=>`[${a.name}${a.value?'="'+a.value+'"':''}]`).join('');
   const x=r.x+r.width/2,y=r.y+r.height/2,hit=x>=0&&y>=0&&x<innerWidth&&y<innerHeight?document.elementFromPoint(x,y):null;
   return {target,label:(el.getAttribute('aria-label')||el.textContent||el.getAttribute('title')||'').trim().replace(/\s+/g,' ').slice(0,100),tag:el.tagName,type:el.type,rect:{x:r.x,y:r.y,width:r.width,height:r.height},inViewport:!!hit,uncovered:hit?el.contains(hit)||hit===el:false,disabled:!!el.disabled,fontSize:style.fontSize};
  });
  return {viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth,focus:document.activeElement?.getAttribute('aria-label')||document.activeElement?.id,controls};
 });
 (row.journey??=[]).push({stage,...state});
}

export async function resetJourney(driver,root,route,row){
 if(process.env.SORA_UX_AUDIT!=='1')return;
 const workspace=driver.page.locator('[data-adaptive-workspace]:visible');
 if(await workspace.count()){
  const target=await workspace.first().getAttribute('data-workspace-reset-target');
  await driver.click('[data-workspace-close]');
  if(await driver.page.locator('[data-workspace-discard]').isVisible())await driver.click('[data-workspace-confirm-discard]');
  await workspace.first().waitFor({state:'hidden'});
  // Wait for the shared close animation's deferred reset handler to complete.
  await driver.page.waitForTimeout(250);
  row.resetControl=target;
 }else throw new Error('No discoverable workspace close/reset after result');
 await captureJourney(driver,root,route,'reset',row);
 const leftovers=await driver.page.locator('a[download][href^="blob:"]:visible').evaluateAll(nodes=>nodes.map(n=>({id:n.id,href:n.href,html:n.outerHTML.slice(0,200)})));
 if(leftovers.length)throw new Error('Stale download visible after reset: '+JSON.stringify(leftovers));
}
