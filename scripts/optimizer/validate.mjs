import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  allAllowedTargetPaths,
  auditPath,
  knowledgePath,
  loadAudit,
  loadConstitution,
  loadKnowledge,
  loadRollback,
  projectRoot,
  rollbackPath,
  validateAuditDocument,
  validateKnowledgeDocument,
  validateRollbackDocument,
} from './core.mjs';

const failures = [];

const check = (condition, message) => { if (!condition) failures.push(message); };

try {
  const { value: constitution } = await loadConstitution();
  const allowedPaths = allAllowedTargetPaths(constitution);
  const knowledge = (await loadKnowledge()).value;
  const audit = await loadAudit();
  const rollback = await loadRollback(allowedPaths);
  validateKnowledgeDocument(knowledge);
  validateAuditDocument(audit);
  validateRollbackDocument(rollback, allowedPaths);

  for (const changeClass of constitution.allowedChangeClasses) {
    check(changeClass.paths.length <= constitution.limits.maxRecipeFiles, `${changeClass.recipeId} exceeds the maximum file count.`);
    check(changeClass.paths.every((file) => allowedPaths.has(file)), `${changeClass.recipeId} has a path outside the allowlist.`);
    check(changeClass.paths.every((file) => !constitution.protectedPathPrefixes.some((prefix) => file.startsWith(prefix))), `${changeClass.recipeId} overlaps a protected path.`);
  }

  const serializedMemory = `${await readFile(knowledgePath, 'utf8')}\n${await readFile(auditPath, 'utf8')}\n${await readFile(rollbackPath, 'utf8')}`;
  check(!/(?:email|ipAddress|userAgent|filename|fileContent|visitorId|sessionId|prompt|freeText)\s*"?\s*:/i.test(serializedMemory), 'Optimizer memory contains a prohibited personal or unbounded-text field.');

  const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  check(packageJson.scripts?.['build:production'] === 'node scripts/build-production.mjs', 'Production build must use the guarded build script.');
  const buildScript = await readFile(path.join(projectRoot, 'scripts', 'build-production.mjs'), 'utf8');
  check(buildScript.includes("'./validate-built-seo.mjs'"), 'Production build is missing the built SEO/GEO validator.');
  check(buildScript.includes("'./verify-monetization.mjs'"), 'Production build is missing monetization verification.');

  const serviceWorker = await readFile(path.join(projectRoot, 'public', 'sw.js'), 'utf8');
  if (serviceWorker.includes('MAX_STATIC_ENTRIES = 80')) {
    check(serviceWorker.includes('MAX_NAVIGATION_ENTRIES = 20'), 'Service-worker navigation cache is not bounded.');
    check(serviceWorker.includes('MAX_STATIC_ENTRIES = 80'), 'Service-worker static cache is not bounded.');
    check(serviceWorker.includes("url.pathname.startsWith('/_astro/')"), 'Service-worker static cache is not allowlisted.');
    check(serviceWorker.includes('Promise.allSettled'), 'Service-worker quota/error containment is missing.');
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

if (failures.length) {
  console.error(`Optimizer validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('Optimizer validation passed: policy, bounded memory, rollback, privacy, and build gates are intact.');
