import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  allAllowedTargetPaths,
  appendAuditRecord,
  appendKnowledgeRecord,
  architectureFingerprint,
  assertManifestsEqual,
  atomicWriteText,
  createRollbackSnapshot,
  loadConstitution,
  loadKnowledge,
  measureDist,
  projectRoot,
  queryKnowledge,
  restoreRollbackSnapshot,
  sourceManifest,
  writeBaseline,
} from './core.mjs';
import { getRecipe } from './recipes.mjs';

const mode = process.argv[2] ?? 'audit';
const requestedRecipe = process.argv[3];
const reviewedRetry = process.argv.includes('--reviewed-retry');
const astro = path.join(projectRoot, 'node_modules', 'astro', 'bin', 'astro.mjs');
const unitTestRunner = path.join(projectRoot, 'scripts', 'run-unit-tests.mjs');

function run(label, command, args) {
  console.log(`\n[optimizer gate] ${label}`);
  const result = spawnSync(command, args, { cwd: projectRoot, env: process.env, stdio: 'inherit', shell: false, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
}

function assertPolicy(recipe, constitution) {
  const policy = constitution.allowedChangeClasses.find((entry) => entry.recipeId === recipe.id);
  if (!policy) throw new Error(`Recipe ${recipe.id} is not permitted by the constitution.`);
  if (policy.paths.length !== recipe.targetPaths.length || policy.paths.some((file, index) => file !== recipe.targetPaths[index])) throw new Error(`Recipe ${recipe.id} target paths do not exactly match policy.`);
  if (recipe.targetPaths.some((file) => constitution.protectedPathPrefixes.some((prefix) => file.startsWith(prefix)))) throw new Error(`Recipe ${recipe.id} overlaps a protected path.`);
}

async function audit() {
  const { value: constitution, digest } = await loadConstitution();
  const loadedKnowledge = await loadKnowledge({ fallback: true });
  const fingerprint = await architectureFingerprint();
  const metrics = await measureDist();
  await writeBaseline(metrics, fingerprint);
  await appendAuditRecord({
    action: 'baseline',
    candidate: 'baseline',
    decision: 'observed',
    reasonCode: 'baseline-captured',
    policyHash: digest,
    architectureFingerprint: fingerprint,
    evidenceIds: [],
  });
  console.log(JSON.stringify({ policyId: constitution.policyId, policyHash: digest, knowledgeDegraded: loadedKnowledge.degraded, metrics }, null, 2));
}

async function applyRecipe(recipeId) {
  if (!recipeId) throw new Error('Specify exactly one recipe ID.');
  const recipe = getRecipe(recipeId);
  const { value: constitution, digest } = await loadConstitution();
  assertPolicy(recipe, constitution);
  const allowedPaths = allAllowedTargetPaths(constitution);
  const loadedKnowledge = await loadKnowledge({ fallback: true });
  const preArchitecture = await architectureFingerprint();
  if (loadedKnowledge.degraded) {
    await appendAuditRecord({ action: 'decision', candidate: recipe.id, decision: 'blocked', reasonCode: 'policy-blocked', policyHash: digest, architectureFingerprint: preArchitecture, evidenceIds: [] });
    throw new Error('Knowledge Base is corrupt or unreadable; apply mode fails closed while audit mode can use an empty fallback.');
  }
  const prior = queryKnowledge(loadedKnowledge.value, { scope: recipe.scope, recipeId: recipe.id, architecture: preArchitecture });
  if (!reviewedRetry && prior.some((record) => ['failure', 'rollback'].includes(record.outcome) && record.effectiveConfidence >= 0.8)) {
    await appendAuditRecord({ action: 'decision', candidate: recipe.id, decision: 'blocked', reasonCode: 'policy-blocked', policyHash: digest, architectureFingerprint: preArchitecture, evidenceIds: prior.slice(0, 3).map((record) => record.id) });
    throw new Error(`Current-architecture failure memory blocks ${recipe.id} until an operator reviews it.`);
  }

  await appendAuditRecord({ action: 'decision', candidate: recipe.id, decision: 'approved', reasonCode: 'policy-approved', policyHash: digest, architectureFingerprint: preArchitecture, evidenceIds: prior.slice(0, 3).map((record) => record.id) });
  const excluded = new Set(recipe.targetPaths);
  const guardBefore = await sourceManifest(excluded);
  const before = await measureDist();
  const transaction = await createRollbackSnapshot(recipe.id, recipe.targetPaths, allowedPaths);

  try {
    const transformed = await recipe.transform();
    if (!(transformed instanceof Map) || transformed.size !== recipe.targetPaths.length || recipe.targetPaths.some((file) => !transformed.has(file))) throw new Error(`${recipe.id} returned an invalid target set.`);
    let changed = 0;
    for (const file of recipe.targetPaths) {
      const absolute = path.join(projectRoot, file);
      const next = transformed.get(file);
      if (typeof next !== 'string') throw new Error(`${recipe.id} produced non-text output for ${file}.`);
      const previous = Buffer.from(transaction.files.find((entry) => entry.path === file).contentBase64, 'base64').toString('utf8');
      if (previous !== next) {
        changed += 1;
        await atomicWriteText(absolute, next);
      }
    }
    if (!changed) throw new Error(`${recipe.id} produced no change.`);

    run('Astro type and content check', process.execPath, [astro, 'check']);
    run('guarded production build', process.execPath, [path.join(projectRoot, 'scripts', 'build-production.mjs')]);
    run('unit contracts', process.execPath, [unitTestRunner]);
    run('visual equivalence', process.execPath, [path.join(projectRoot, 'scripts', 'optimizer', 'visual-resilience.mjs'), '--compare']);
    const stressMode = recipe.id === 'storage-denial-safety' ? '--stress-storage' : recipe.id === 'workbench-overflow-containment' ? '--stress-batch' : '--stress';
    run('storage and extreme-input stress', process.execPath, [path.join(projectRoot, 'scripts', 'optimizer', 'visual-resilience.mjs'), stressMode]);

    const guardAfter = await sourceManifest(excluded);
    assertManifestsEqual(guardBefore, guardAfter);
    const after = await measureDist();
    const evidence = recipe.evidence(before, after);
    const postArchitecture = await architectureFingerprint();
    const knowledge = await appendKnowledgeRecord({ scope: recipe.scope, recipeId: recipe.id, architectureFingerprint: postArchitecture, outcome: 'success', baseConfidence: 0.98, evidence });
    await appendAuditRecord({ action: 'apply', candidate: recipe.id, decision: 'applied', reasonCode: 'gates-passed', policyHash: digest, architectureFingerprint: postArchitecture, evidenceIds: [knowledge.id] });
    await writeBaseline(after, postArchitecture);
    console.log(JSON.stringify({ recipe: recipe.id, transaction: transaction.id, evidence, before, after }, null, 2));
  } catch (error) {
    await restoreRollbackSnapshot(transaction);
    const restoredArchitecture = await architectureFingerprint();
    let rebuildPassed = false;
    try {
      run('rollback production rebuild', process.execPath, [path.join(projectRoot, 'scripts', 'build-production.mjs')]);
      rebuildPassed = true;
    } catch {}
    const knowledge = await appendKnowledgeRecord({
      scope: recipe.scope,
      recipeId: recipe.id,
      architectureFingerprint: restoredArchitecture,
      outcome: 'rollback',
      baseConfidence: 0.99,
      evidence: { gate: 'full-gate', before: 1, after: rebuildPassed ? 1 : 0, unit: 'boolean', noteCode: 'rollback-complete' },
    });
    await appendAuditRecord({ action: 'rollback', candidate: recipe.id, decision: 'rolled-back', reasonCode: 'rollback-complete', policyHash: digest, architectureFingerprint: restoredArchitecture, evidenceIds: [knowledge.id] });
    throw error;
  }
}

try {
  if (mode === 'audit') await audit();
  else if (mode === 'apply') await applyRecipe(requestedRecipe);
  else throw new Error(`Unknown optimizer mode: ${mode}.`);
} catch (error) {
  console.error(`Optimizer ${mode} failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
