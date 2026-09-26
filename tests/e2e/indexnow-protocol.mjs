// All fetches are replaced in the child process. This never contacts a provider.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile,writeFile } from 'node:fs/promises';
const results=[];
for(const status of [202,429,500]){
 const mock=`import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';globalThis.fetch=async(url,init)=>{if(url==='https://sorafiles.com/sitemap.xml')return new Response(await readFile('dist/sitemap.xml','utf8'));if(url==='https://sorafiles.com/fc1b21d84d0549ba9d2ab3bea5dc3845.txt')return new Response('fc1b21d84d0549ba9d2ab3bea5dc3845');assert.equal(url,'https://api.indexnow.org/indexnow');assert.equal(init.method,'POST');const body=JSON.parse(init.body);assert.ok(body.urlList.length>0&&body.urlList.length<=10000);assert.equal(new Set(body.urlList).size,body.urlList.length);return new Response('',{status:${status}});};`;
 const result=spawnSync(process.execPath,['--import',`data:text/javascript,${encodeURIComponent(mock)}`,'scripts/ping-search-engines.js','--live','--indexnow-only'],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,result.stderr);const receipt=JSON.parse(await readFile('.artifacts/search-submission-receipt.json','utf8'));
 assert.equal(receipt.operations[0].status,status===202?'key-validation-pending':'failed');results.push({mockHttpStatus:status,status:'PASS',recordedStatus:receipt.operations[0].status});
}
// Leave a dry-run receipt rather than a mocked submission receipt.
const dry=spawnSync(process.execPath,['scripts/ping-search-engines.js','--dry-run','--indexnow-only'],{encoding:'utf8',windowsHide:true});assert.equal(dry.status,0,dry.stderr);
await writeFile('.artifacts/astra-indexnow-protocol.json',JSON.stringify({network:'all provider calls mocked; no external submission',results},null,2));console.log('PASS: mocked 202 pending-validation, 429 and 500 nonfatal failures; dry-run receipt restored.');
