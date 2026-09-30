import test from 'node:test';import assert from 'node:assert/strict';
import {appFacts,manifest,msixVersion} from '../scripts/build-msix.mjs';

const identity={name:'SoraLabs.SoraFilesDesktop',publisher:'CN=Test & Co',publisherDisplayName:'Sora Labs'};

test('Store manifest declares the same Explorer command, file types and startup task as the app',async()=>{
 const facts=await appFacts(),xml=manifest(facts,identity);
 assert.equal(facts.clsid,'F482B896-7D0B-4C12-9832-5B6D326139A7');
 assert.equal(facts.startupTask,'SoraFilesStartup');
 assert.ok(facts.extensions.includes('.pdf')&&facts.extensions.includes('.docx'));
 for(const ext of facts.extensions)assert.match(xml,new RegExp(`<desktop5:ItemType Type="\\${ext}"><desktop5:Verb Id="SoraFilesDesktop" Clsid="${facts.clsid}"/>`));
 // The surrogate COM class is the same one the verbs invoke, loaded from the packaged DLL.
 assert.match(xml,new RegExp(`<com:Class Id="${facts.clsid}" Path="sorafiles-explorer.dll"`));
 assert.match(xml,/<rescap:Capability Name="runFullTrust"\/>/);
 assert.match(xml,/EntryPoint="Windows.FullTrustApplication"/);
});

test('Store startup task is off until the user turns it on',async()=>{
 const xml=manifest(await appFacts(),identity);
 assert.match(xml,/<desktop:StartupTask TaskId="SoraFilesStartup" Enabled="false"/);
});

test('Store package declares every app language, English first',async()=>{
 const facts=await appFacts(),xml=manifest(facts,identity);
 assert.equal(facts.languages.length,19);
 assert.equal(facts.languages[0],'en-us');
 const declared=[...xml.matchAll(/<Resource Language="([a-z]{2}-[a-z]{2})"\/>/g)].map(m=>m[1]);
 assert.deepEqual(declared,facts.languages);
 assert.ok(declared.includes('ja-jp')&&declared.includes('zh-tw')&&declared.includes('ar-sa'));
});

test('Store version is four-part with a zero revision and identity is XML-escaped',async()=>{
 const facts=await appFacts();
 assert.match(msixVersion(facts.version),/^\d+\.\d+\.\d+\.0$/);
 const xml=manifest(facts,identity);
 assert.match(xml,new RegExp(`Version="${msixVersion(facts.version).replaceAll('.','\\.')}"`));
 assert.match(xml,/Publisher="CN=Test &amp; Co"/);
 assert.doesNotMatch(xml,/Publisher="CN=Test & Co"/);
});
