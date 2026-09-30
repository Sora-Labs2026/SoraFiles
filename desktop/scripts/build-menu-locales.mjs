import fs from 'node:fs';
const source=fs.readFileSync('desktop/shared/native-actions.mjs','utf8');
const keys=new Set(['Edit with SoraFiles','More options','Set up SoraFiles',...[...source.matchAll(/(?:label|many):'([^']+)'/g)].map(match=>match[1])]);
const full=JSON.parse(fs.readFileSync('desktop/shared/locales/catalogs.json','utf8'));
// Share the reviewed native root/tray wording with the webview and Unix menus.
const native=fs.readFileSync('desktop/native/src/locale.rs','utf8');
for(const match of native.matchAll(/"([a-z-]+)"=>\["([^"]+)","([^"]+)","([^"]+)"\]/g)){
 if(full[match[1]])for(const [index,key]of ['Edit with SoraFiles','Open SoraFiles','Quit SoraFiles'].entries())full[match[1]][key]=match[index+2];
}
fs.writeFileSync('desktop/shared/locales/catalogs.json',JSON.stringify(full,null,2)+'\n');
const small=Object.fromEntries(Object.entries(full).map(([locale,dict])=>[locale,Object.fromEntries([...keys].map(key=>{if(!dict[key])throw Error(`Missing menu message ${locale}: ${key}`);return [key,dict[key]];}))]));
fs.writeFileSync('desktop/shared/locales/menu.json',JSON.stringify(small)+'\n');
const nativeKeys=['Save SoraFiles results','Choose files for SoraFiles','Choose output folder'];
fs.writeFileSync('desktop/shared/locales/native.json',JSON.stringify(Object.fromEntries(Object.entries(full).map(([locale,dict])=>[locale,Object.fromEntries(nativeKeys.map(key=>{if(!dict[key])throw Error(`Missing native message ${locale}: ${key}`);return [key,dict[key]];}))])))+'\n');
