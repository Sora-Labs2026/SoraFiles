import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';
import catalogs from '../shared/locales/catalogs.json' with {type:'json'};

// The desktop UI translates by exact match, so every fixed interface phrase
// must exist in every catalog. Collect t('...') literals and the plain text
// between tags in UI templates; text next to ${...} is data, not a phrase.
const dir=new URL('../ui/',import.meta.url);
const phrases=new Set();
for(const name of readdirSync(dir).filter(name=>name.endsWith('.ts'))){
 const source=readFileSync(new URL(name,dir),'utf8');
 for(const match of source.matchAll(/\bt\('((?:[^'\\]|\\.)+)'\)/g))phrases.add(match[1].replace(/\\'/g,"'"));
 // Prose only: starts with a capital, no code punctuation. Generics and
 // comparisons also sit between < and >, so anything code-like is skipped.
 for(const match of source.matchAll(/>([^<>`${}]+)</g)){
  const text=match[1].trim();
  if(/^[A-Z][^\n;=()'"&|!+*/\\[\]]*$/.test(text)&&/[a-z]/.test(text))phrases.add(text);
 }
}
const ignored=new Set(['Promise','SoraFiles','JPG','PNG','PDF','WebP','ZIP','OCR']);

test('every fixed desktop UI phrase is translated in all catalogs',()=>{
 assert.ok(phrases.size>100,`found only ${phrases.size} phrases; the scan is broken`);
 const missing=[];
 for(const phrase of phrases){
  if(ignored.has(phrase))continue;
  const locales=Object.keys(catalogs).filter(code=>code!=='en'&&!Object.hasOwn(catalogs[code],phrase));
  if(locales.length)missing.push(`${JSON.stringify(phrase)} (${locales.length===Object.keys(catalogs).length-1?'all':locales.join(',')})`);
 }
 assert.deepEqual(missing,[],`untranslated phrases:\n${missing.join('\n')}`);
});
