import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeTargets,verifyNativeTarget} from '../scripts/verify-native-target.mjs';

test('native packaging rejects foreign runtime architectures instead of bundling host binaries',()=>{
  for (const [target,expected] of Object.entries(nativeTargets)) {
    assert.equal(verifyNativeTarget(target,expected).target,target);
    assert.throws(()=>verifyNativeTarget(target,{...expected,arch:expected.arch==='x64'?'arm64':'x64'}),/requires/);
    assert.throws(()=>verifyNativeTarget(target,{...expected,platform:expected.platform==='win32'?'linux':'win32'}),/requires/);
  }
  assert.throws(()=>verifyNativeTarget('aarch64-unknown-linux-gnu'),/Unknown native target/);
});
