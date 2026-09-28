import {readFile,readdir,stat,mkdir,link,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,basename} from 'node:path';
const run=process.argv[2];if(!/^\d+$/.test(run||''))throw Error('Expected a verified CI run');
const base=`.artifacts/release-${run}`,out=join(base,'publish');await mkdir(out,{recursive:true});
const targets=[['windows','x86_64-pc-windows-msvc','windows-x64'],['macos-arm','aarch64-apple-darwin','macos-arm64'],['macos-intel','x86_64-apple-darwin','macos-x64'],['linux','x86_64-unknown-linux-gnu','linux-x64']];
const artifacts=[];
for(const [folder,target,label] of targets){const receipt=JSON.parse(await readFile(join(base,folder,'.artifacts',`native-candidate-${target}.json`),'utf8'));if(receipt.version!=='0.1.1'||receipt.run!==run)throw Error('Candidate identity mismatch');
 for(const item of receipt.artifacts){const source=join(base,folder,'desktop/native/target',target,'release/bundle',item.file);const bytes=await readFile(source);const sha256=createHash('sha256').update(bytes).digest('hex');if(sha256!==item.sha256||bytes.length!==item.bytes)throw Error(`Artifact mismatch: ${source}`);const extension=item.file.split('.').at(-1);const name=`SoraFiles-Desktop-0.1.1-${label}${extension==='exe'?'-setup':''}.${extension}`;const destination=join(out,name);try{await link(source,destination)}catch(error){if(error.code!=='EEXIST')throw error;const existing=await readFile(destination);if(createHash('sha256').update(existing).digest('hex')!==sha256)throw Error('Existing release asset differs');}artifacts.push({name,bytes:bytes.length,sha256,target,commit:receipt.commit});}
}
if(artifacts.length!==5||new Set(artifacts.map(a=>a.commit)).size!==1)throw Error('Expected five packages from one commit');
await writeFile(join(out,'SHA256SUMS.txt'),artifacts.map(a=>`${a.sha256}  ${a.name}`).join('\n')+'\n');await writeFile(join(base,'verified-artifacts.json'),JSON.stringify({run,version:'0.1.1',artifacts},null,2));console.log(JSON.stringify({run,files:artifacts.length,commit:artifacts[0].commit,out}));
