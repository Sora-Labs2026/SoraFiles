// Authoring-time copy of the owner's locked guide frontend content.
import {readFile,writeFile} from 'node:fs/promises';
const root='.artifacts/v10-handoff/sorafiles-tools-desktop-subpages-prototype-launchit-inspired-v2/src/data/';
const base=await readFile(root+'guides.js','utf8');
const desktop=(await readFile(root+'desktopGuides.js','utf8')).replace(/^import .*;\s*/,'');
const {ALL_GUIDES}=await import('data:text/javascript;base64,'+Buffer.from(base+'\n'+desktop).toString('base64'));
await writeFile('src/data/prototypeGuides.json',JSON.stringify(ALL_GUIDES,null,2)+'\n');
console.log(`Copied ${ALL_GUIDES.length} prototype guides.`);
