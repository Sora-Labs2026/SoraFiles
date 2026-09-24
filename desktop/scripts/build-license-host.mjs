import {mkdir,copyFile,chmod,readFile,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=join(root,'.artifacts/desktop-license-host');
const files=['native-host/main.mjs','native-host/license-host.mjs','core/license-client.mjs','shared/entitlement.mjs','shared/tool-policy.mjs','shared/license-request.mjs','shared/license-plans.mjs','shared/plans.mjs','shared/validation-proof.mjs','shared/native-actions.mjs','shared/tool-metadata.json','shared/replacement-prices.mjs'];
await mkdir(out,{recursive:true});
for(const file of files){const target=join(out,'desktop',file);await mkdir(join(target,'..'),{recursive:true});await copyFile(join(root,'desktop',file),target);}
const runtime=join(out,process.platform==='win32'?'node.exe':'node');await copyFile(process.execPath,runtime);if(process.platform!=='win32')await chmod(runtime,0o755);
const noticesRoot=join(root,'desktop/licenses/runtime'),notices=JSON.parse(await readFile(join(noticesRoot,'manifest.json'),'utf8'));
const notice=notices[process.version];if(!notice)throw Error('Review and pin the Node runtime license notice for '+process.version+' before packaging');
const noticeBytes=await readFile(join(noticesRoot,notice.file));if(createHash('sha256').update(noticeBytes).digest('hex')!==notice.sha256)throw Error('Runtime license notice checksum mismatch');
await mkdir(join(out,'licenses'),{recursive:true});await writeFile(join(out,'licenses/node-LICENSE.txt'),noticeBytes);
await copyFile(join(root,'LICENSE'),join(out,'licenses/SoraFiles-AGPL-3.0.txt'));
const config=JSON.parse(await readFile(join(root,'desktop/releases/license-service.json'),'utf8'));
if(config.origin!=='https://license.sorafiles.com'||!config.keys||typeof config.keys!=='object')throw Error('Invalid bundled license configuration');
await writeFile(join(out,'config.json'),JSON.stringify(config));
await writeFile(join(out,'runtime.json'),JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,notice:{...notice,file:'licenses/node-LICENSE.txt'},scope:'On-demand license and processing components; corresponding source, provenance and public signing configuration required before release'},null,2));
console.log('Prepared on-demand native license component');
