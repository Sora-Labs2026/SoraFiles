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

test('window-race diagnostics require one native window build per view load', () => {
 const lifecycle = {status:'PASS', nativeWindowLoads:3, nativeWindowBuilds:3, closeReopenCycles:2, backgroundJobState:false, trayOnlyStartup:false, windowRace:false};
 assert.doesNotThrow(() => validateNativeSmokeReport(lifecycle));
 assert.throws(() => validateNativeSmokeReport(lifecycle,{race:true}));
 assert.doesNotThrow(() => validateNativeSmokeReport({...lifecycle,windowRace:true},{race:true}));
 // A duplicate "main" window is built but never counted as a view load.
 assert.throws(() => validateNativeSmokeReport({...lifecycle,nativeWindowBuilds:4}));
 assert.throws(() => validateNativeSmokeReport({...lifecycle,windowRace:true,nativeWindowBuilds:4},{race:true}));
 const {nativeWindowBuilds, ...legacy} = lifecycle;
 assert.throws(() => validateNativeSmokeReport({...legacy,windowRace:true},{race:true}));
});
