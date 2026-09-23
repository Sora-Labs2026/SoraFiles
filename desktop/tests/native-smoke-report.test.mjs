import test from 'node:test';
import assert from 'node:assert/strict';
import {validateNativeSmokeReport} from '../scripts/native-smoke-report.mjs';

test('native diagnostics cannot certify a background job using a release lifecycle-only report', () => {
 const lifecycle = {status:'PASS', nativeWindowLoads:3, closeReopenCycles:2, backgroundJobState:false, trayOnlyStartup:false};
 assert.doesNotThrow(() => validateNativeSmokeReport(lifecycle));
 assert.throws(() => validateNativeSmokeReport(lifecycle,{background:true}));
 assert.throws(() => validateNativeSmokeReport(lifecycle,{startup:true}));
 assert.doesNotThrow(() => validateNativeSmokeReport({...lifecycle,backgroundJobState:true},{background:true}));
 assert.doesNotThrow(() => validateNativeSmokeReport({...lifecycle,trayOnlyStartup:true},{startup:true}));
 for (const report of [null,{}, {...lifecycle,status:'FAIL'}, {...lifecycle,nativeWindowLoads:2}, {...lifecycle,closeReopenCycles:1}]) {
  assert.throws(() => validateNativeSmokeReport(report));
 }
});
