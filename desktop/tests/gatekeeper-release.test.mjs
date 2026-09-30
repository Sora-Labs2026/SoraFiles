import test from 'node:test';import assert from 'node:assert/strict';
import {validateManifest,recommendRelease} from '../shared/releases.mjs';
const fixture=()=>({version:'1.0.0',minOS:'13.0',platform:'macos',arch:'arm64',channel:'stable',package:'dmg',status:'active',security:'clear',url:'https://downloads.sorafiles.com/1.0.0/macos-arm64.dmg',bytes:123,sha256:'a'.repeat(64),tested:true,releaseDate:'2026-09-13',notes:'Synthetic test fixture',signing:'signed',notarized:true,updaterEligible:false});
test('standard Mac release requires signing and notarization',()=>{
 const manifest={schema:1,releases:[fixture()]};validateManifest(manifest);
 const device={platform:'macos',arch:'arm64',osVersion:'14.0',packageType:'dmg'};
 assert.equal(recommendRelease(manifest,device).reason,'compatible');
 assert.equal(recommendRelease(manifest,{...device,osVersion:'12.0'}).release,null);
 assert.equal(recommendRelease(manifest,{...device,arch:'x64'}).release,null);
 for(const patch of [{notarized:false},{signing:'unsigned'},{updaterEligible:true},{installation:'gatekeeper-approval'},{tested:false}])assert.throws(()=>validateManifest({schema:1,releases:[{...fixture(),...patch}]}));
});
test('owner-approved ad-hoc Mac distribution discloses manual approval and disables automatic updates',()=>{
 const release={...fixture(),signing:'ad-hoc',notarized:false,installation:'gatekeeper-approval',updaterEligible:false,approvalInstructions:'https://sorafiles.com/desktop/help#macos-open-anyway'};
 const device={platform:'macos',arch:'arm64',osVersion:'14.0'};
 assert.equal(recommendRelease({schema:1,releases:[release]},device).reason,'manual-approval-required');
 for(const patch of [{approvalInstructions:undefined},{approvalInstructions:'https://example.com/help'},{updaterEligible:true,updateSignature:'fixture'},{notarized:true},{installation:undefined},{tested:false}])assert.throws(()=>validateManifest({schema:1,releases:[{...release,...patch}]}));
 for(const patch of [{security:'blocked'},{status:'blocked'}])assert.equal(recommendRelease({schema:1,releases:[{...release,...patch}]},device).release,null);
});
test('blocked Mac releases remain unavailable after signing and notarization',()=>{
 for(const patch of [{security:'blocked'},{status:'blocked'}])assert.equal(recommendRelease({schema:1,releases:[{...fixture(),...patch}]},{platform:'macos',arch:'arm64',osVersion:'14.0'}).release,null);
});
