import {mkdir,copyFile,chmod,readFile,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=join(root,'.artifacts/desktop-license-host');
const files=['native-host/main.mjs','native-host/license-host.mjs','core/license-client.mjs','shared/entitlement.mjs','shared/license-request.mjs','shared/license-plans.mjs','shared/plans.mjs'];
await mkdir(out,{recursive:true});
for(const file of files){const target=join(out,'desktop',file);await mkdir(join(target,'..'),{recursive:true});await copyFile(join(root,'desktop',file),target);}
const runtime=join(out,process.platform==='win32'?'node.exe':'node');await copyFile(process.execPath,runtime);if(process.platform!=='win32')await chmod(runtime,0o755);
const config=JSON.parse(await readFile(join(root,'desktop/releases/license-service.json'),'utf8'));
if(config.origin!=='https://license.sorafiles.com'||!config.keys||typeof config.keys!=='object')throw Error('Invalid bundled license configuration');
await writeFile(join(out,'config.json'),JSON.stringify(config));
await writeFile(join(out,'runtime.json'),JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,scope:'On-demand license client only; public signing configuration and runtime notice pack required before release'},null,2));
console.log('Prepared on-demand native license component');
