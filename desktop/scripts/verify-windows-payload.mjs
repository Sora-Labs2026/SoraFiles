// Verify the resource staging tree actually supplied to NSIS against the tested
// generated pack. This is not a substitute for extraction/install validation.
import {readdir,readFile,writeFile,stat} from 'node:fs/promises';import {join,resolve,relative,sep} from 'node:path';import {createHash} from 'node:crypto';
const generated=resolve('.artifacts/desktop-license-host'),release=resolve('desktop/native/target/x86_64-pc-windows-msvc/release'),staged=join(release,'license-host');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function inventory(root){const files=new Map();async function visit(directory){for(const entry of await readdir(directory,{withFileTypes:true})){
 if(entry.isSymbolicLink())throw Error('Unexpected resource link');const path=join(directory,entry.name);if(entry.isDirectory())await visit(path);else if(entry.isFile())files.set(relative(root,path).split(sep).join('/'),await readFile(path));else throw Error('Unexpected resource');
}}await visit(root);return files;}
const expected=await inventory(generated),actual=await inventory(staged);if(expected.size!==actual.size)throw Error('Resource staging count differs from tested pack');
let resourceBytes=0;const entries=[];for(const [path,bytes] of expected){if(!actual.get(path)?.equals(bytes))throw Error('Resource staging differs: '+path);resourceBytes+=bytes.length;entries.push({path,bytes:bytes.length,sha256:hash(bytes)});}
const nativeBytes=(await stat(join(release,'sorafiles-desktop.exe'))).size;
const expectedShell=await readFile(resolve('.artifacts/windows-shell/sorafiles-explorer.dll'));
const actualShell=await readFile(join(release,'sorafiles-explorer.dll'));
if(!actualShell.equals(expectedShell))throw Error('Explorer component staging differs from tested DLL');
const script=await readFile(join(release,'nsis/x64/installer.nsi'),'utf8');
if(!script.includes('SetCompressor /SOLID "lzma"'))throw Error('Unexpected installer compression');
if(!script.includes('sorafiles-explorer.dll')||!script.includes('--sync-explorer-entry')||!script.includes('--remove-explorer-entry'))throw Error('Installer omits native menu component or lifecycle hooks');
const shellComponent={bytes:actualShell.length,sha256:hash(actualShell)};
const report={recordedAt:new Date().toISOString(),status:'PASS',resourceFiles:entries.length,resourceBytes,nativeBytes,shellComponent,totalStagedPayloadBytes:resourceBytes+nativeBytes+shellComponent.bytes,compression:'NSIS solid LZMA',scope:'NSIS resource staging equals generated pack byte-for-byte; excludes installed allocation, uninstaller, shortcuts and shared WebView2; not installer extraction or installation verification',entries};
await writeFile('.artifacts/windows-payload-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,entries:undefined}));
