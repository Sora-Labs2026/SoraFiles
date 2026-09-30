// Local reference only. No prototype processing code is shipped to production.
import {createServer,transformWithEsbuild} from 'vite';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
const root=resolve('.artifacts/v10-handoff/sorafiles-tools-desktop-subpages-prototype-launchit-inspired-v2');
await writeFile(resolve(root,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/index.js"></script></body></html>');
const server=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:4397,strictPort:true},css:{postcss:{plugins:[]}},plugins:[{name:'reference-jsx',enforce:'pre',async transform(code,id){if(/\/src\/.*\.[jt]sx?$/.test(id.replaceAll('\\','/')))return transformWithEsbuild(code,id,{loader:'jsx',jsx:'automatic'})}}],optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-runtime','react-router-dom','lucide-react']}});
await server.listen();console.log('Prototype reference ready at http://127.0.0.1:4397');
