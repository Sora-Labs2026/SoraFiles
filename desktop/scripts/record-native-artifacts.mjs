import {readdir,readFile,stat,writeFile,mkdir} from 'node:fs/promises';import {createReadStream} from 'node:fs';import {resolve,join,relative,extname} from 'node:path';import {createHash} from 'node:crypto';
const target=process.argv[2];if(!['x86_64-pc-windows-msvc','aarch64-apple-darwin','x86_64-apple-darwin','x86_64-unknown-linux-gnu'].includes(target))throw Error('Unknown native target');
const root=resolve('desktop/native/target',target,'release/bundle'),artifacts=[];
async function visit(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.isSymbolicLink())continue;const path=join(dir,entry.name);if(entry.isDirectory())await visit(path);else if(/\.(dmg|deb|AppImage|exe)$/.test(entry.name)){const info=await stat(path);if(!info.size)throw Error('Empty installer artifact');const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);artifacts.push({file:relative(root,path).replaceAll('\\','/'),bytes:info.size,sha256:hash.digest('hex')});}}}
await visit(root);
const expected=target.endsWith('apple-darwin')?['.dmg']:target.endsWith('windows-msvc')?['.exe']:['.AppImage','.deb'];
if(JSON.stringify(artifacts.map(a=>extname(a.file)).sort())!==JSON.stringify(expected.sort()))throw Error('Missing or unexpected installer packages');
artifacts.sort((a,b)=>a.file.localeCompare(b.file));await mkdir('.artifacts',{recursive:true});
const {version}=JSON.parse(await readFile('desktop/native/tauri.conf.json','utf8'));
await writeFile('.artifacts/native-candidate-'+target+'.json',JSON.stringify({schema:1,target,version,commit:process.env.GITHUB_SHA||null,run:process.env.GITHUB_RUN_ID||null,builtAt:new Date().toISOString(),publicRelease:false,artifacts,remaining:'Native runtime, full processing, licensing, install/uninstall and release clearance'},null,2));console.log(`Recorded ${artifacts.length} candidate artifact hashes for ${target}`);
