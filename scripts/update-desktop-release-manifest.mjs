import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const version=JSON.parse(await readFile('desktop/native/tauri.conf.json','utf8')).version;
const run=process.argv[2];if(!/^\d+$/.test(run||''))throw Error('Expected verified package run');
const verified=JSON.parse(await readFile(`.artifacts/release-${run}/verified-artifacts.json`,'utf8'));
const remote=JSON.parse(execFileSync('gh',['api','repos/Sora-Labs2026/SoraFiles/releases/tags/v'+version],{encoding:'utf8'}));
if(remote.draft||remote.prerelease)throw Error('Release is not public and stable');
for(const artifact of verified.artifacts){const asset=remote.assets.find(a=>a.name===artifact.name);if(asset?.size!==artifact.bytes||asset?.digest!==`sha256:${artifact.sha256}`)throw Error(`Public release checksum differs: ${artifact.name}`);}
const path='desktop/releases/manifest.json',manifest=JSON.parse(await readFile(path,'utf8'));
for(const release of manifest.releases){const label=`${release.platform}-${release.arch}${release.package==='exe'?'-setup':''}.${release.package}`;const artifact=verified.artifacts.find(a=>a.name.endsWith(label));if(!artifact)throw Error(`Missing platform: ${label}`);Object.assign(release,{version,url:`https://github.com/Sora-Labs2026/SoraFiles/releases/download/v${version}/${artifact.name}`,bytes:artifact.bytes,sha256:artifact.sha256,releaseDate:new Date(remote.published_at).toISOString().slice(0,10)});}
await writeFile(path,JSON.stringify(manifest,null,2)+'\n');
await writeFile('desktop/releases/publication.json',JSON.stringify({homepagePromotionEnabled:true,reason:'SoraFiles Desktop '+version+' is published for Windows x64, macOS Apple Silicon/Intel and Ubuntu 22.04 x64. Automatic updates remain disabled; macOS ad-hoc builds require Open Anyway.'},null,2)+'\n');
console.log('Verified five public SHA-256 digests; updated truthful release metadata to '+version+'.');
