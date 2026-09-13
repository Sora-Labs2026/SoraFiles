import {build} from 'vite';import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
// May be called by Tauri from desktop/native or directly from the repository root.
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
await import('./build-license-host.mjs');
await import('./build-processing-host.mjs');
await build({configFile:false,root:'desktop/ui',publicDir:false,build:{outDir:'../../.artifacts/desktop-native-ui',emptyOutDir:true,target:'es2022'}});
await mkdir('.artifacts/desktop-native-ui/fonts',{recursive:true});
for(const name of ['icon-192.png','favicon.ico','fonts/plus-jakarta-sans-vf.woff2'])await copyFile('public/'+name,'.artifacts/desktop-native-ui/'+name);
// Tauri injects and hashes its IPC bootstrap using the host CSP. The WebView2
// prototype keeps its stricter no-IPC-network meta policy in the source HTML.
const path='.artifacts/desktop-native-ui/index.html';let html=await readFile(path,'utf8');html=html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,'');await writeFile(path,html);
