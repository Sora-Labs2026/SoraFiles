import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { PlaywrightAuditDriver } from './playwright-audit-driver.mjs';
const root='.artifacts/astra-perspective';await mkdir(root+'/downloads',{recursive:true});
const expected=JSON.parse(await readFile(root+'/expected.json','utf8')),rows=[];
for(const width of [1440,390]){
 const d=new PlaywrightAuditDriver({downloadDir:root+'/downloads'}),row={width,status:'FAIL'};
 try{
  await d.start();await d.setViewport(width,1000);await d.navigate('http://127.0.0.1:4321/doc-scanner');
  await d.setFiles('[data-scanner-input]',root+'/perspective.png');await d.waitFor('[data-scanner-workspace]');
  await d.click('[data-scanner-recrop]');await d.waitFor('[data-corner="topLeft"]');
  const host=await d.page.locator('[data-corner-host]').boundingBox();
  const scale=Math.min((host.width-24)/1200,(host.height-24)/1200),ox=host.x+(host.width-1200*scale)/2,oy=host.y+(host.height-1200*scale)/2;
  for(const [i,name] of ['topLeft','topRight','bottomRight','bottomLeft'].entries()){
   const h=await d.page.locator(`[data-corner="${name}"]`).boundingBox();await d.page.mouse.move(h.x+h.width/2,h.y+h.height/2);await d.page.mouse.down();
   await d.page.mouse.move(ox+expected.quad[i][0]*scale,oy+expected.quad[i][1]*scale,{steps:15});await d.page.mouse.up();
  }
  await d.click('[data-corners-apply]');await d.page.locator('[data-corner-dialog]').waitFor({state:'hidden'});
  await d.check('[data-export-format][value="png"]');await d.click('[data-export-run]');await d.waitFor('[data-export-result]');
  row.output=await d.waitForDownload(()=>d.click('[data-export-download]'));await d.screenshot(`${root}/scanner-${width}.png`);row.status='EXPORTED';
 }catch(e){row.error=e.message;}finally{await d.stop();rows.push(row);await writeFile(root+'/results.json',JSON.stringify(rows,null,2));console.log(row);}
}
