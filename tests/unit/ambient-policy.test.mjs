import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ambientModeForRoute,
  bubbleSpecFromUnitValues,
  fragmentCountFromUnitValue,
  resolveAmbientProfile,
} from '../../src/lib/ambient.ts';

const baseCapabilities = {
  preference: 'on',
  reducedMotion: false,
  saveData: false,
  mobile: false,
};

test('classifies public routes into their approved ambient modes', () => {
  for (const pathname of [
    '/',
    '/image-converter',
    '/compress-image',
    '/heic-to-jpg',
    '/pdf',
    '/merge-pdf',
    '/split-pdf',
    '/rotate-pdf',
    '/jpg-to-pdf',
    '/pdf-to-jpg',
    '/pdf-to-word',
    '/word-to-pdf',
  ]) {
    assert.equal(ambientModeForRoute(pathname), 'standard', pathname);
  }

  for (const pathname of ['/about', '/open-source']) {
    assert.equal(ambientModeForRoute(pathname), 'reduced', pathname);
  }

  for (const pathname of ['/contact', '/privacy', '/terms', '/404']) {
    assert.equal(ambientModeForRoute(pathname), 'off', pathname);
  }
});

test('resolves the approved desktop and mobile profiles and disables constrained devices', () => {
  assert.deepEqual(resolveAmbientProfile('standard', baseCapabilities), {
    maxVisible: 5, spawnMin: 4500, spawnMax: 8500, sizeMin: 30, sizeMax: 64,
    durationMin: 14000, durationMax: 24000, firstDelay: 1500,
  });
  assert.deepEqual(resolveAmbientProfile('standard', { ...baseCapabilities, mobile: true }), {
    maxVisible: 2, spawnMin: 7000, spawnMax: 12000, sizeMin: 26, sizeMax: 48,
    durationMin: 16000, durationMax: 26000, firstDelay: 1500,
  });
  assert.deepEqual(resolveAmbientProfile('reduced', baseCapabilities), {
    maxVisible: 2, spawnMin: 9000, spawnMax: 15000, sizeMin: 28, sizeMax: 52,
    durationMin: 18000, durationMax: 28000, firstDelay: 1500,
  });
  assert.deepEqual(resolveAmbientProfile('reduced', { ...baseCapabilities, mobile: true }), {
    maxVisible: 1, spawnMin: 12000, spawnMax: 18000, sizeMin: 26, sizeMax: 42,
    durationMin: 20000, durationMax: 30000, firstDelay: 1500,
  });

  for (const capabilities of [
    { ...baseCapabilities, preference: 'off' },
    { ...baseCapabilities, reducedMotion: true },
    { ...baseCapabilities, saveData: true },
    { ...baseCapabilities, deviceMemory: 1 },
    { ...baseCapabilities, deviceMemory: 2 },
    { ...baseCapabilities, hardwareConcurrency: 1 },
    { ...baseCapabilities, hardwareConcurrency: 2 },
  ]) {
    assert.equal(resolveAmbientProfile('standard', capabilities).maxVisible, 0);
  }
  assert.equal(resolveAmbientProfile('off', baseCapabilities).maxVisible, 0);
});

test('creates bubble specs inside literal policy bounds from unit values', () => {
  const cases = [
    {
      profile: { maxVisible: 5, spawnMin: 4500, spawnMax: 8500, sizeMin: 30, sizeMax: 64, durationMin: 14000, durationMax: 24000, firstDelay: 1500 },
      spawn: [4500, 8500], size: [30, 64], duration: [14000, 24000],
    },
    {
      profile: { maxVisible: 2, spawnMin: 7000, spawnMax: 12000, sizeMin: 26, sizeMax: 48, durationMin: 16000, durationMax: 26000, firstDelay: 1500 },
      spawn: [7000, 12000], size: [26, 48], duration: [16000, 26000],
    },
    {
      profile: { maxVisible: 2, spawnMin: 9000, spawnMax: 15000, sizeMin: 28, sizeMax: 52, durationMin: 18000, durationMax: 28000, firstDelay: 1500 },
      spawn: [9000, 15000], size: [28, 52], duration: [18000, 28000],
    },
    {
      profile: { maxVisible: 1, spawnMin: 12000, spawnMax: 18000, sizeMin: 26, sizeMax: 42, durationMin: 20000, durationMax: 30000, firstDelay: 1500 },
      spawn: [12000, 18000], size: [26, 42], duration: [20000, 30000],
    },
  ];
  const unitValues = [0, .25, .5, .75, .999999];

  for (const { profile, spawn, size, duration } of cases) {
    const specs = unitValues.map((unit, index) => bubbleSpecFromUnitValues(profile, [unit, unit, unit, unit, unit, index / 3]));
    for (const spec of specs) {
      assert.ok(spec.spawnDelay >= spawn[0] && spec.spawnDelay <= spawn[1]);
      assert.ok(spec.size >= size[0] && spec.size <= size[1]);
      assert.ok(spec.duration >= duration[0] && spec.duration <= duration[1]);
      assert.ok(Math.abs(spec.drift) <= 40);
      assert.ok(spec.left >= 3 && spec.left <= 97);
    }
    assert.ok(specs.filter((spec) => spec.motif).length <= Math.floor(specs.length / 3));
  }
});

test('resolved profiles are immutable policy values', () => {
  const resolvedProfiles = [
    resolveAmbientProfile('standard', baseCapabilities),
    resolveAmbientProfile('standard', { ...baseCapabilities, mobile: true }),
    resolveAmbientProfile('reduced', baseCapabilities),
    resolveAmbientProfile('reduced', { ...baseCapabilities, mobile: true }),
    resolveAmbientProfile('off', baseCapabilities),
  ];

  for (const profile of resolvedProfiles) {
    assert.equal(Object.isFrozen(profile), true);
    assert.throws(() => { profile.maxVisible = 99; }, TypeError);
  }
  assert.equal(resolveAmbientProfile('standard', baseCapabilities).maxVisible, 5);
});

test('fragment counts stay inside the approved range for hostile injected randomness', () => {
  const cases = [
    [-10, 2],
    [-0.001, 2],
    [0, 2],
    [0.999999, 4],
    [1, 4],
    [10, 4],
    [Number.NaN, 2],
    [Number.POSITIVE_INFINITY, 2],
  ];

  for (const [unit, expected] of cases) {
    assert.equal(fragmentCountFromUnitValue(unit), expected, String(unit));
  }
});
