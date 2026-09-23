// Run before packaging: copying the host Node/native modules only works when
// the runner, Node process and requested Rust target have the same architecture.
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const nativeTargets = Object.freeze({
  'x86_64-pc-windows-msvc': {platform:'win32', arch:'x64', packages:['.exe']},
  'aarch64-apple-darwin': {platform:'darwin', arch:'arm64', packages:['.dmg']},
  'x86_64-apple-darwin': {platform:'darwin', arch:'x64', packages:['.dmg']},
  'x86_64-unknown-linux-gnu': {platform:'linux', arch:'x64', packages:['.AppImage','.deb']},
});

export function verifyNativeTarget(target, {platform=process.platform, arch=process.arch}={}) {
  const expected=nativeTargets[target];
  if (!expected) throw Error('Unknown native target: '+target);
  if (platform!==expected.platform || arch!==expected.arch)
    throw Error(`Native target ${target} requires ${expected.platform}/${expected.arch}; runner Node is ${platform}/${arch}`);
  return {target, platform, arch, packages:expected.packages};
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const report=verifyNativeTarget(process.argv[2]);
  const root=new URL('../../',import.meta.url);
  const notices=JSON.parse(await readFile(new URL('desktop/licenses/runtime/manifest.json',root),'utf8'));
  const notice=notices[process.version];
  if (!notice) throw Error('No reviewed license notice for bundled Node '+process.version);
  const bytes=await readFile(new URL('desktop/licenses/runtime/'+notice.file,root));
  if (createHash('sha256').update(bytes).digest('hex')!==notice.sha256)
    throw Error('Node license notice checksum mismatch: '+notice.file+(bytes.includes(Buffer.from('\r\n'))?' (CRLF checkout detected; restore the pinned LF bytes using .gitattributes)':''));
  await mkdir(new URL('.artifacts/',root),{recursive:true});
  const result={...report,status:'PASS',node:process.version,recordedAt:new Date().toISOString(),scope:'Runner/Node architecture and reviewed runtime notice; not OS compatibility certification'};
  await writeFile(new URL('.artifacts/native-target-verification.json',root),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
}
