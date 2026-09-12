import test from 'node:test';import assert from 'node:assert/strict';
import {validateManifest,recommendRelease} from '../shared/releases.mjs';
const fixture=()=>({version:'1.0.0',minOS:'13.0',platform:'macos',arch:'arm64',channel:'stable',package:'dmg',status:'active',security:'clear',url:'https://downloads.sorafiles.com/1.0.0/macos-arm64.dmg',bytes:123,sha256:'a'.repeat(64),tested:true,releaseDate:'2026-09-13',notes:'Synthetic test fixture',signing:'ad-hoc',notarized:false,installation:'gatekeeper-approval',updaterEligible:false,approvalInstructions:'https://sorafiles.com/desktop/help#macos-open-anyway'});
test('ad-hoc Mac release is explicitly manual and retains compatibility requirements',()=>{
 const manifest={schema:1,releases:[fixture()]};validateManifest(manifest);
 const device={platform:'macos',arch:'arm64',osVersion:'14.0',packageType:'dmg'};
 assert.equal(recommendRelease(manifest,device).reason,'manual-approval-required');
 assert.equal(recommendRelease(manifest,{...device,osVersion:'12.0'}).release,null);
 assert.equal(recommendRelease(manifest,{...device,arch:'x64'}).release,null);
 for(const patch of [{notarized:true},{signing:'unsigned'},{updaterEligible:true},{installation:null},{approvalInstructions:'https://example.com/'},{tested:false}])assert.throws(()=>validateManifest({schema:1,releases:[{...fixture(),...patch}]}));
});
test('blocked Mac releases remain unavailable even with manual approval metadata',()=>{
 for(const patch of [{security:'blocked'},{status:'blocked'}])assert.equal(recommendRelease({schema:1,releases:[{...fixture(),...patch}]},{platform:'macos',arch:'arm64',osVersion:'14.0'}).release,null);
});
