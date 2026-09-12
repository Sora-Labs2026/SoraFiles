import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {platform,release,arch} from 'node:os';
const json=async path=>{let data=JSON.parse(await readFile(path,'utf8'));return typeof data==='string'?JSON.parse(data):data;};
const ui=await json('.artifacts/desktop-ui-qa/results.json'),web=await json('.artifacts/desktop-website-qa/results.json');
const native=await json('.artifacts/desktop-ui-native/ui-state.json'),zoom=await json('.artifacts/desktop-ui-native/zoom-state.json');
if(ui.status!=='PASS'||web.errors.length||native.overflow||native.errors||zoom.overflow||!zoom.quitVisible||zoom.checkedScreens!==5)throw Error('Design validation incomplete');
const files=['desktop/ui/main.ts','desktop/ui/styles.css','desktop/ui/brand.css','desktop/ui/host.ts','desktop/prototypes/DesktopUiProbe.cs','desktop/tests/NativeUiContractProbe.cs','desktop/tests/ui-qa.mjs','desktop/tests/website-qa.mjs','src/components/DesktopPromo.astro','src/styles/global.css'];
const sourceHashes={};for(const file of files)sourceHashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
const captures={};for(const name of ['home.png','settings-native-200.png']){const file='.artifacts/desktop-ui-native/'+name;captures[name]={sha256:createHash('sha256').update(await readFile(file)).digest('hex'),capturedAt:(await stat(file)).mtime.toISOString()};}
const result={recordedAt:new Date().toISOString(),status:'SCOPED DESIGN CHECKS PASS; DESKTOP RELEASE INCOMPLETE',platform:{os:platform(),release:release(),arch:arch()},desktopUi:ui,website:web,native,zoom,captures,sourceHashes,limits:['Browser UI uses an explicit fake native bridge.','Native WebView2 zoom and selection contract checks cover Windows only.','No installer, macOS/Linux host, real Dodo purchase, native processing/result flow or screen-reader certification.','Homepage promotion is disabled pending the three-OS launch.']};
await writeFile('desktop/audit/premium-design-evidence.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,desktopUiGroups:ui.checks.length,websiteGroups:web.checks.length,nativeZoom:zoom.zoom}));
