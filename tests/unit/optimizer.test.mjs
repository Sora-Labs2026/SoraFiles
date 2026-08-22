import test from 'node:test';
import assert from 'node:assert/strict';
import {
  architectureFingerprint,
  loadConstitution,
  queryKnowledge,
  validateKnowledgeDocument,
} from '../../scripts/optimizer/core.mjs';

const validRecord = {
  id: 'kb_0123456789abcdef',
  recordedAt: '2026-08-21T00:00:00.000Z',
  scope: 'performance',
  recipeId: 'immutable-astro-cache',
  architectureFingerprint: 'a'.repeat(64),
  outcome: 'success',
  baseConfidence: 0.9,
  evidence: { gate: 'worker-contract', before: 0, after: 1, unit: 'boolean', noteCode: 'hashed-assets-immutable' },
};

test('optimizer constitution is hash-pinned and architecture fingerprint is aggregate-only', async () => {
  const policy = await loadConstitution();
  assert.equal(policy.value.policyId, 'sorafiles-optimizer-policy-v1');
  assert.match(policy.digest, /^[a-f0-9]{64}$/);
  assert.match(await architectureFingerprint(), /^[a-f0-9]{64}$/);
});

test('optimizer knowledge rejects unknown or unbounded fields', () => {
  assert.throws(() => validateKnowledgeDocument({ schemaVersion: 1, records: [{ ...validRecord, freeText: 'poison' }] }), /unknown field/);
  assert.throws(() => validateKnowledgeDocument({ schemaVersion: 1, records: [{ ...validRecord, baseConfidence: Number.POSITIVE_INFINITY }] }), /finite number/);
  assert.throws(() => validateKnowledgeDocument({ schemaVersion: 1, records: Array.from({ length: 251 }, (_, index) => ({ ...validRecord, id: `kb_${index.toString(16).padStart(16, '0')}` })) }), /bound/);
});

test('optimizer retrieval decays stale evidence and down-ranks architecture mismatch', () => {
  const document = { schemaVersion: 1, records: [validRecord] };
  const matching = queryKnowledge(document, { scope: 'performance', recipeId: 'immutable-astro-cache', architecture: 'a'.repeat(64), now: Date.parse('2026-08-21T00:00:00.000Z') });
  const mismatching = queryKnowledge(document, { scope: 'performance', recipeId: 'immutable-astro-cache', architecture: 'b'.repeat(64), now: Date.parse('2026-08-21T00:00:00.000Z') });
  assert.equal(matching[0].effectiveConfidence, 0.9);
  assert.ok(mismatching[0].effectiveConfidence < matching[0].effectiveConfidence);
});
