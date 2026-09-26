import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const origin='https://sorafiles.com';const rows=[];
for(const path of ['/','/guides','/word-to-pdf','/excel-to-pdf','/remove-background','/fr/image-converter','/ar/pdf-to-word','/guides/test-fixture','/fr/guides']){
 const response=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(30000)});const html=await response.text();
 const absent=path.endsWith('test-fixture')||path==='/fr/guides';assert.equal(response.status,absent?404:200,path);
 if(!absent){assert.ok(html.includes('https://x.com/Dri_shy_a'),path);assert.ok(html.includes('Made with'),path);assert.ok(html.includes('Drishya Thapa'),path);}
 if(!absent)assert.ok(!html.includes('tinyshelf'),path);
 if(path==='/'){assert.ok(html.includes('href="#how-it-works"'));assert.ok(!html.includes('https://webassembly.org/'));}
 if(path==='/guides'){assert.doesNotMatch(html,/content="noindex/);assert.doesNotMatch(html,/<link\b[^>]*\bhreflang=/i);}
 if(['/word-to-pdf','/excel-to-pdf','/remove-background'].includes(path)){assert.equal(response.headers.get('cross-origin-opener-policy'),'same-origin');assert.equal(response.headers.get('cross-origin-embedder-policy'),'require-corp');}
 rows.push({path,status:response.status,creator:!absent,coop:response.headers.get('cross-origin-opener-policy'),coep:response.headers.get('cross-origin-embedder-policy')});
}
const www=await fetch('https://www.sorafiles.com',{redirect:'manual'});assert.equal(www.status,301);assert.equal(www.headers.get('location'),origin+'/');rows.push({path:'www',status:www.status,location:www.headers.get('location')});
const sitemap=await(await fetch(origin+'/sitemap.xml')).text();assert.equal(createHash('sha256').update(sitemap).digest('hex'),createHash('sha256').update(await readFile('dist/sitemap.xml')).digest('hex'));
const assets=await fetch(origin+'/__sf/background-removal/resources.json');assert.equal(assets.status,200);assert.ok(Object.keys(await assets.json()).length>0);
const workerName=(await readdir('dist/_astro')).find(name=>/^background-removal\.worker-.*\.js$/.test(name));assert.ok(workerName);
const workerResponse=await fetch(origin+'/_astro/'+workerName);assert.equal(workerResponse.status,200);assert.equal(workerResponse.headers.get('cross-origin-embedder-policy'),'require-corp');
const toolsPage=await(await fetch(origin+'/tools')).text();assert.ok(toolsPage.includes('data-testid="tools-privacy-summary"'));
const local=await readFile('dist/word-to-pdf/index.html','utf8'),deployed=await(await fetch(origin+'/word-to-pdf')).text();
for(const match of local.matchAll(/(?:src|href)="(\/_astro\/[^" ]+\.js)"/g))assert.ok(deployed.includes(match[1]),`release asset mismatch: ${match[1]}`);
const log=await readFile('.artifacts/astra-deploy-final.log','utf8'),version=log.match(/Current Version ID: ([\w-]+)/)?.[1];assert.ok(version,'deployment must have a version');
const result={recordedAt:new Date().toISOString(),version,url:origin,checks:rows,sitemapMatchesBuild:true,backgroundProxy:true,releaseAssetsMatch:true};
await writeFile('.artifacts/astra-deployment.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
