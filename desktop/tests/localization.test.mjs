import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import catalogs from '../shared/locales/catalogs.json' with {type:'json'};
import menu from '../shared/locales/menu.json' with {type:'json'};
import {translate} from '../shared/localization.mjs';
import {translateMenu} from '../shared/menu-localization.mjs';
const locales=['en','ja','ko','es','fr','de','pt','zh-cn','zh-tw','hi','ar','ru','id','it','nl','tr','vi','th','pl'];
test('all supported languages have bundled settings and action copy with safe English fallback',()=>{
 assert.deepEqual(Object.keys(catalogs).sort(),[...locales].sort());
 for(const code of locales){
  for(const source of Object.keys(catalogs.en))assert.ok(typeof catalogs[code][source]==='string'&&catalogs[code][source].trim(),`${code}: ${source}`);
  for(const [source,label]of Object.entries(menu[code])){
   assert.equal(translateMenu(code,source),translate(code,source));
   assert.ok([...label].length<=100&&!/[\t\r\n\u202a-\u202e\u2066-\u2069]/u.test(label),`${code}: native protocol label`);
  }
 }
 for(const code of ['unsupported','__proto__','constructor'])assert.equal(translate(code,'Settings'),'Settings');
 assert.equal(translate('ja','Customer filename not in catalog.pdf'),'Customer filename not in catalog.pdf');
});
test('file-manager localization loads only its small data catalog and no engines',async()=>{
 const result=await build({entryPoints:['desktop/shared/menu-localization.mjs'],bundle:true,write:false,platform:'browser',format:'esm',metafile:true});
 assert.deepEqual(Object.keys(result.metafile.inputs).sort(),['desktop/shared/locales/menu.json','desktop/shared/menu-localization.mjs']);
 assert.ok(result.outputFiles[0].contents.length<70000);
});
