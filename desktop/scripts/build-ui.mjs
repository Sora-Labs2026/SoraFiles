import {build} from 'vite';import {mkdir,copyFile} from 'node:fs/promises';
await build({configFile:false,root:'desktop/ui',publicDir:false,build:{outDir:'../../.artifacts/desktop-ui',emptyOutDir:true,target:'es2022'}});
await mkdir('.artifacts/desktop-ui/fonts',{recursive:true});
await copyFile('public/favicon.ico','.artifacts/desktop-ui/favicon.ico');
await copyFile('public/icon-192.png','.artifacts/desktop-ui/icon-192.png');await copyFile('public/fonts/plus-jakarta-sans-vf.woff2','.artifacts/desktop-ui/fonts/plus-jakarta-sans-vf.woff2');
