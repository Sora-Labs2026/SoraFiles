import {build} from 'vite';
await build({configFile:false,root:'desktop/prototypes',publicDir:'../../public',build:{outDir:'../../.artifacts/desktop-probe-ui',emptyOutDir:true,target:'esnext'},worker:{format:'es'}});
