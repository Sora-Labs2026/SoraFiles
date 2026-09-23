import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {liveTools} from '../../src/data/liveTools.ts';
import {capabilities, searchTools, relevantActions, quickActionMenu} from '../shared/capabilities.mjs';
import {desktopToolIds, isDesktopTool} from '../shared/tool-policy.mjs';
import {JobQueue} from '../core/queue.mjs';
import {verifyEntitlement} from '../shared/entitlement.mjs';
import {entitlementClaims, signEntitlement} from '../license-service/signing.mjs';
import {runProcessing, processingTools} from '../native-host/processing-host.mjs';
import {licensePlans} from '../shared/license-plans.mjs';

const excluded = ['unlock-pdf', 'unlock_pdf', 'pdf_unlock', 'decrypt-pdf', 'decrypt_pdf',
  'unprotect-pdf', 'remove-pdf-password', 'bypass-pdf-password', 'strip-pdf-security'];

test('Desktop metadata, search and selected-file actions exclude Unlock; free Web and Protect stay available', async () => {
  assert.equal(liveTools.length, 26);
  assert.equal(liveTools.find(tool => tool.id === 'unlock-pdf').engine, 'unlockPdf');
  assert.equal(capabilities.length, 25);
  assert.deepEqual(capabilities.map(t => t.id), desktopToolIds);
  assert.ok(capabilities.some(t => t.id === 'protect-pdf'));
  assert.ok(processingTools.every(isDesktopTool));
  const metadata = JSON.parse(await readFile(new URL('../shared/tool-metadata.json', import.meta.url)));
  assert.deepEqual(metadata, liveTools.filter(t => isDesktopTool(t.id)).map(t => ({
    id:t.id, name:t.name, slug:t.slug, inputFormats:t.inputFormats, outputFormats:t.outputFormats,
  })));
  for (const query of ['unlock', 'decrypt', 'remove pdf password', 'unprotect']) assert.deepEqual(searchTools(query), []);
  for (const authorized of [false, true]) for (const count of [1, 2, 40]) {
    const selection = Array.from({length:count}, () => ({format:'PDF', validated:true}));
    for (const actions of [relevantActions(selection, authorized), quickActionMenu(selection, authorized)])
      assert.ok(actions.every(tool => !excluded.includes(tool.id)));
  }
});

test('an injected excluded engine never reaches authorization, processing, or output', async () => {
  for (const id of [...excluded, 'future-unreviewed-tool']) {
    let invoked = false;
    const queue = new JobQueue({engines:{[id]:async()=>{invoked=true;}}, authorize:async()=>{invoked=true;}});
    await assert.rejects(queue.add(id, {selectionIds:['synthetic']}), /not available in Desktop/);
    assert.equal(invoked, false);
    assert.deepEqual(queue.list(), []);
  }
});

test('trial and every paid or promotional plan refuse excluded direct native processing', async () => {
  const pair = generateKeyPairSync('ed25519');
  const signing = {kid:'policy-test', privateKey:pair.privateKey.export({type:'pkcs8', format:'pem'})};
  const keys = {'policy-test':pair.publicKey.export({type:'spki', format:'pem'})};
  const now = Math.floor(Date.now()/1000);
  for (const plan of ['trial', ...Object.keys(licensePlans)]) {
    const claims = entitlementClaims({deviceId:'synthetic-device', now,
      ...(plan==='trial'?{trial:{exp:now+7*86400}}:{license:{ref:'synthetic', plan, status:'active', period_end:now+30*86400}})});
    assert.deepEqual(claims.features, ['process']);
    const token = signEntitlement(claims, signing);
    assert.equal(verifyEntitlement(token, {keys, deviceId:'synthetic-device'}).plan, plan);
    for (const tool of excluded) {
      await assert.rejects(runProcessing({tool, paths:['synthetic.pdf'],
        state:{license:{entitlement:token}}, config:{keys},
        saveState:async()=>assert.fail('Excluded request touched protected state')}), /Invalid processing request/);
      assert.throws(()=>signEntitlement({...claims, features:['process',tool]}, signing), /Feature/);
      // Simulate a correctly signed old/foreign feature-bearing token, bypassing
      // our current signer: verification must not grandfather the capability.
      const body = [{alg:'EdDSA', typ:'sf-entitlement+jwt', kid:'policy-test'}, {...claims,features:['process',tool]}]
        .map(value=>Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
      const legacy = body+'.'+sign(null,Buffer.from(body),pair.privateKey).toString('base64url');
      assert.throws(()=>verifyEntitlement(legacy,{keys,deviceId:'synthetic-device'}), /Feature/);
    }
  }
});
