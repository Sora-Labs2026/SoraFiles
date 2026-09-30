import assert from 'node:assert/strict';
import {build} from 'esbuild';

// Bundle the TypeScript catalog as Astro does, so this test exercises the
// exported resolver rather than parsing translation source text.
const bundle=await build({entryPoints:['src/i18n/prototype.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {prototypeText}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const localeBundle=await build({entryPoints:['src/i18n/config.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {localeDefinitions}=await import(`data:text/javascript;base64,${Buffer.from(localeBundle.outputFiles[0].text).toString('base64')}`);
const required=[
 'Processed on your device.',
 'Supported tools run in your browser. File contents are never sent to a SoraFiles server.',
 'Right-click a file. Pick a tool. Done.',
 'Run SoraFiles from your file manager, on one file or a whole batch. Fewer steps for repeat work.',
 'Explore Desktop','Everyday PDF','and image tools.',
 'Compress, convert, merge and sign files in your browser. Free, no account.',
 '3 PDFs into one file','One PDF, one file per page','Sideways pages turned 90°',
 'Made with','by','Breadcrumb','Security','All','Show all 26 tools',
];
for(const {path} of localeDefinitions){
 for(const phrase of required){
  const translated=prototypeText(path,phrase);
  assert.ok(translated&&translated.trim(),`${path}: empty prototype translation for ${phrase}`);
  if(path!=='en')assert.notEqual(translated,phrase,`${path}: English fallback for ${phrase}`);
 }
 for(const template of ['{count} tools','{count} of {total} tools']){
  const translated=prototypeText(path,template);
  assert.ok(translated.includes('{count}'),`${path}: missing count placeholder`);
  if(template.includes('{total}'))assert.ok(translated.includes('{total}'),`${path}: missing total placeholder`);
 }
}
console.log(`Prototype shared-copy localization: ${localeDefinitions.length} locales and ${required.length} critical phrases verified.`);
