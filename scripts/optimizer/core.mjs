import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
export const policyPath = path.join(projectRoot, 'optimizer', 'constitution.json');
export const knowledgePath = path.join(projectRoot, 'optimizer', 'knowledge.json');
export const auditPath = path.join(projectRoot, 'optimizer', 'audit.json');
export const rollbackPath = path.join(projectRoot, 'optimizer', 'rollback.json');
export const baselinePath = path.join(projectRoot, 'optimizer', 'baselines', 'current.json');
export const visualBaselinePath = path.join(projectRoot, 'optimizer', 'baselines', 'visual.json');

export const CONSTITUTION_SHA256 = 'a50a91de7f616256417bd4480c339279b9eaf74b50de3b2c38dd0f41a4e26706';
export const RECIPE_IDS = Object.freeze([
  'canonical-locale-root',
  'immutable-astro-cache',
  'bounded-service-worker-cache',
  'storage-denial-safety',
  'workbench-overflow-containment',
]);
export const SCOPES = Object.freeze(['performance', 'technical-seo', 'geo', 'resilience']);
export const OUTCOMES = Object.freeze(['success', 'failure', 'rollback', 'blocked']);
const KNOWLEDGE_LIMIT = 250;
const AUDIT_LIMIT = 500;
const ROLLBACK_LIMIT = 10;
const DAY_MS = 86_400_000;
const HEX_64 = /^[a-f0-9]{64}$/;
const RECORD_ID = /^(?:kb|audit|tx)_[a-f0-9]{16}$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const NOTE_CODES = new Set([
  'baseline-captured',
  'canonical-redirects-eliminated',
  'hashed-assets-immutable',
  'runtime-cache-bounded',
  'storage-denial-contained',
  'workbench-overflow-contained',
  'gate-failed',
  'policy-blocked',
  'rollback-complete',
  'no-change',
]);
const GATES = new Set(['baseline', 'seo-validator', 'worker-contract', 'service-worker-contract', 'storage-stress', 'input-stress', 'full-gate']);
const UNITS = new Set(['count', 'boolean', 'bytes', 'milliseconds', 'ratio']);

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function exactKeys(value, keys, label) {
  if (!isObject(value)) throw new Error(`${label} must be an object.`);
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contains unknown field ${key}.`);
  }
}

function finiteNumber(value, label, { min = -Infinity, max = Infinity } = {}) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be a finite number between ${min} and ${max}.`);
}

function validateEvidence(value, label) {
  exactKeys(value, ['gate', 'before', 'after', 'unit', 'noteCode'], label);
  if (!GATES.has(value.gate)) throw new Error(`${label}.gate is not allowlisted.`);
  if (!UNITS.has(value.unit)) throw new Error(`${label}.unit is not allowlisted.`);
  if (!NOTE_CODES.has(value.noteCode)) throw new Error(`${label}.noteCode is not allowlisted.`);
  finiteNumber(value.before, `${label}.before`);
  finiteNumber(value.after, `${label}.after`);
}

export function validateKnowledgeDocument(value) {
  exactKeys(value, ['schemaVersion', 'records'], 'knowledge');
  if (value.schemaVersion !== 1 || !Array.isArray(value.records) || value.records.length > KNOWLEDGE_LIMIT) {
    throw new Error('Knowledge schema or bound is invalid.');
  }
  const seen = new Set();
  value.records.forEach((record, index) => {
    const label = `knowledge.records[${index}]`;
    exactKeys(record, ['id', 'recordedAt', 'scope', 'recipeId', 'architectureFingerprint', 'outcome', 'baseConfidence', 'evidence'], label);
    if (!RECORD_ID.test(record.id) || seen.has(record.id)) throw new Error(`${label}.id is invalid or duplicated.`);
    seen.add(record.id);
    if (!ISO_TIME.test(record.recordedAt) || Number.isNaN(Date.parse(record.recordedAt))) throw new Error(`${label}.recordedAt is invalid.`);
    if (!SCOPES.includes(record.scope) || !RECIPE_IDS.includes(record.recipeId) || !OUTCOMES.includes(record.outcome)) throw new Error(`${label} has a non-allowlisted enum.`);
    if (!HEX_64.test(record.architectureFingerprint)) throw new Error(`${label}.architectureFingerprint is invalid.`);
    finiteNumber(record.baseConfidence, `${label}.baseConfidence`, { min: 0, max: 1 });
    validateEvidence(record.evidence, `${label}.evidence`);
  });
  return value;
}

export function validateAuditDocument(value) {
  exactKeys(value, ['schemaVersion', 'records'], 'audit');
  if (value.schemaVersion !== 1 || !Array.isArray(value.records) || value.records.length > AUDIT_LIMIT) throw new Error('Audit schema or bound is invalid.');
  const actions = new Set(['baseline', 'decision', 'apply', 'rollback']);
  const decisions = new Set(['observed', 'approved', 'applied', 'blocked', 'rolled-back']);
  const candidates = new Set(['baseline', ...RECIPE_IDS]);
  const reasons = new Set(['baseline-captured', 'policy-approved', 'policy-blocked', 'gates-passed', 'gate-failed', 'rollback-complete', 'no-change']);
  const seen = new Set();
  value.records.forEach((record, index) => {
    const label = `audit.records[${index}]`;
    exactKeys(record, ['id', 'timestamp', 'action', 'candidate', 'decision', 'reasonCode', 'policyHash', 'architectureFingerprint', 'evidenceIds'], label);
    if (!RECORD_ID.test(record.id) || seen.has(record.id)) throw new Error(`${label}.id is invalid or duplicated.`);
    seen.add(record.id);
    if (!ISO_TIME.test(record.timestamp) || Number.isNaN(Date.parse(record.timestamp))) throw new Error(`${label}.timestamp is invalid.`);
    if (!actions.has(record.action) || !decisions.has(record.decision) || !candidates.has(record.candidate) || !reasons.has(record.reasonCode)) throw new Error(`${label} contains a non-allowlisted enum.`);
    if (!HEX_64.test(record.policyHash) || !HEX_64.test(record.architectureFingerprint)) throw new Error(`${label} contains an invalid hash.`);
    if (!Array.isArray(record.evidenceIds) || record.evidenceIds.length > 20 || record.evidenceIds.some((id) => !RECORD_ID.test(id))) throw new Error(`${label}.evidenceIds is invalid.`);
  });
  return value;
}

export function validateRollbackDocument(value, allowedPaths) {
  exactKeys(value, ['schemaVersion', 'transactions'], 'rollback');
  if (value.schemaVersion !== 1 || !Array.isArray(value.transactions) || value.transactions.length > ROLLBACK_LIMIT) throw new Error('Rollback schema or bound is invalid.');
  value.transactions.forEach((transaction, index) => {
    const label = `rollback.transactions[${index}]`;
    exactKeys(transaction, ['id', 'recipeId', 'createdAt', 'files'], label);
    if (!RECORD_ID.test(transaction.id) || !RECIPE_IDS.includes(transaction.recipeId) || !ISO_TIME.test(transaction.createdAt)) throw new Error(`${label} metadata is invalid.`);
    if (!Array.isArray(transaction.files) || transaction.files.length < 1 || transaction.files.length > 3) throw new Error(`${label}.files is invalid.`);
    transaction.files.forEach((file, fileIndex) => {
      const fileLabel = `${label}.files[${fileIndex}]`;
      exactKeys(file, ['path', 'sha256', 'contentBase64'], fileLabel);
      if (!allowedPaths.has(file.path) || !HEX_64.test(file.sha256) || typeof file.contentBase64 !== 'string' || file.contentBase64.length > 4_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.contentBase64)) throw new Error(`${fileLabel} is invalid.`);
      const decoded = Buffer.from(file.contentBase64, 'base64');
      if (sha256(decoded) !== file.sha256) throw new Error(`${fileLabel} checksum does not match.`);
    });
  });
  return value;
}

export async function loadConstitution() {
  const raw = await readFile(policyPath);
  const digest = sha256(raw);
  if (digest !== CONSTITUTION_SHA256) throw new Error(`Optimizer constitution hash mismatch: ${digest}.`);
  const value = JSON.parse(raw.toString('utf8'));
  exactKeys(value, ['schemaVersion', 'policyId', 'priorities', 'allowedChangeClasses', 'protectedPathPrefixes', 'forbiddenChangeClasses', 'limits'], 'constitution');
  if (value.schemaVersion !== 1 || value.policyId !== 'sorafiles-optimizer-policy-v1') throw new Error('Optimizer constitution identity is invalid.');
  if (value.limits.knowledgeRecords !== KNOWLEDGE_LIMIT || value.limits.auditRecords !== AUDIT_LIMIT || value.limits.rollbackTransactions !== ROLLBACK_LIMIT || value.limits.maxRecipeFiles !== 3) throw new Error('Optimizer constitution limits do not match the runtime safety bounds.');
  const recipeSet = new Set(value.allowedChangeClasses.map((entry) => entry.recipeId));
  if (recipeSet.size !== RECIPE_IDS.length || RECIPE_IDS.some((id) => !recipeSet.has(id))) throw new Error('Optimizer constitution recipe allowlist is incomplete.');
  return { value, digest };
}

async function readValidatedJson(file, validate) {
  return validate(JSON.parse(await readFile(file, 'utf8')));
}

export async function loadKnowledge({ fallback = false } = {}) {
  try {
    return { value: await readValidatedJson(knowledgePath, validateKnowledgeDocument), degraded: false };
  } catch (error) {
    if (!fallback) throw error;
    return { value: { schemaVersion: 1, records: [] }, degraded: true, errorCode: 'corrupt-knowledge' };
  }
}

export async function loadAudit() {
  return readValidatedJson(auditPath, validateAuditDocument);
}

export const allAllowedTargetPaths = (constitution) => new Set(constitution.allowedChangeClasses.flatMap((entry) => entry.paths));

export async function loadRollback(allowedPaths) {
  return readValidatedJson(rollbackPath, (value) => validateRollbackDocument(value, allowedPaths));
}

export async function atomicWriteText(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, content, 'utf8');
  await rename(temporary, file);
}

export async function atomicWriteJson(file, value) {
  await atomicWriteText(file, `${JSON.stringify(value, null, 2)}\n`);
}

const architectureFiles = ['package.json', 'astro.config.mjs', 'wrangler.jsonc', 'worker.js', 'src/layouts/Layout.astro'];

export async function architectureFingerprint() {
  const hash = createHash('sha256');
  for (const file of architectureFiles) {
    hash.update(file);
    hash.update('\0');
    hash.update(await readFile(path.join(projectRoot, file)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function walk(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

export async function sourceManifest(excluded = new Set()) {
  const candidates = [
    ...await walk(path.join(projectRoot, 'src')),
    ...await walk(path.join(projectRoot, 'public')),
    ...['package.json', 'astro.config.mjs', 'wrangler.jsonc', 'worker.js'].map((file) => path.join(projectRoot, file)),
  ];
  const manifest = new Map();
  for (const file of candidates) {
    const relative = path.relative(projectRoot, file).replaceAll('\\', '/');
    if (!excluded.has(relative)) manifest.set(relative, sha256(await readFile(file)));
  }
  return manifest;
}

export function assertManifestsEqual(before, after) {
  const changed = [];
  const paths = new Set([...before.keys(), ...after.keys()]);
  for (const file of paths) if (before.get(file) !== after.get(file)) changed.push(file);
  if (changed.length) throw new Error(`Non-target source changed: ${changed.join(', ')}`);
}

export async function measureDist() {
  const dist = path.join(projectRoot, 'dist');
  const files = await walk(dist);
  const bytesByKind = { html: 0, javascript: 0, css: 0, fonts: 0, other: 0 };
  let maxAssetBytes = 0;
  let htmlPages = 0;
  let trailingSlashCanonicals = 0;
  let canonicalCount = 0;
  for (const file of files) {
    const size = (await stat(file)).size;
    maxAssetBytes = Math.max(maxAssetBytes, size);
    const extension = path.extname(file).toLowerCase();
    const kind = extension === '.html' ? 'html' : ['.js', '.mjs'].includes(extension) ? 'javascript' : extension === '.css' ? 'css' : ['.woff', '.woff2', '.ttf', '.otf'].includes(extension) ? 'fonts' : 'other';
    bytesByKind[kind] += size;
    if (extension === '.html') {
      htmlPages += 1;
      const html = await readFile(file, 'utf8');
      for (const match of html.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi)) {
        const href = match[0].match(/href=["']([^"']+)["']/i)?.[1];
        if (!href) continue;
        canonicalCount += 1;
        try { if (new URL(href).pathname !== '/' && new URL(href).pathname.endsWith('/')) trailingSlashCanonicals += 1; } catch {}
      }
    }
  }
  let sitemapUrls = 0;
  const sitemapFile = path.join(dist, 'sitemap.xml');
  if (existsSync(sitemapFile)) sitemapUrls = ((await readFile(sitemapFile, 'utf8')).match(/<loc>/g) ?? []).length;
  return {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    files: files.length,
    htmlPages,
    sitemapUrls,
    canonicalCount,
    trailingSlashCanonicals,
    maxAssetBytes,
    bytesByKind,
  };
}

export async function writeBaseline(metrics, fingerprint) {
  await atomicWriteJson(baselinePath, { schemaVersion: 1, architectureFingerprint: fingerprint, ...metrics });
}

function nextId(prefix, parts) {
  return `${prefix}_${sha256(parts.join('|')).slice(0, 16)}`;
}

export async function appendAuditRecord(record) {
  const document = await loadAudit();
  const timestamp = new Date().toISOString();
  const entry = { id: nextId('audit', [timestamp, record.action, record.candidate, String(document.records.length)]), timestamp, ...record };
  document.records.push(entry);
  document.records = document.records.slice(-AUDIT_LIMIT);
  validateAuditDocument(document);
  await atomicWriteJson(auditPath, document);
  return entry;
}

export async function appendKnowledgeRecord(record) {
  const loaded = await loadKnowledge();
  const recordedAt = new Date().toISOString();
  const entry = { id: nextId('kb', [recordedAt, record.scope, record.recipeId, record.outcome, String(loaded.value.records.length)]), recordedAt, ...record };
  loaded.value.records.push(entry);
  loaded.value.records = loaded.value.records.slice(-KNOWLEDGE_LIMIT);
  validateKnowledgeDocument(loaded.value);
  await atomicWriteJson(knowledgePath, loaded.value);
  return entry;
}

export function queryKnowledge(document, { scope, recipeId, architecture, now = Date.now() }) {
  return document.records
    .filter((record) => record.scope === scope && record.recipeId === recipeId)
    .map((record) => {
      const ageDays = Math.max(0, (now - Date.parse(record.recordedAt)) / DAY_MS);
      const freshness = 0.5 ** (ageDays / 90);
      const architectureWeight = record.architectureFingerprint === architecture ? 1 : 0.2;
      return { ...record, effectiveConfidence: record.baseConfidence * freshness * architectureWeight };
    })
    .filter((record) => record.effectiveConfidence >= 0.05)
    .sort((left, right) => right.effectiveConfidence - left.effectiveConfidence);
}

export async function createRollbackSnapshot(recipeId, targetPaths, allowedPaths) {
  const files = [];
  for (const relative of targetPaths) {
    if (!allowedPaths.has(relative)) throw new Error(`Rollback target ${relative} is not allowlisted.`);
    const content = await readFile(path.join(projectRoot, relative));
    files.push({ path: relative, sha256: sha256(content), contentBase64: content.toString('base64') });
  }
  const document = await loadRollback(allowedPaths);
  const createdAt = new Date().toISOString();
  const transaction = { id: nextId('tx', [createdAt, recipeId, files.map((file) => file.sha256).join(',')]), recipeId, createdAt, files };
  document.transactions.push(transaction);
  document.transactions = document.transactions.slice(-ROLLBACK_LIMIT);
  validateRollbackDocument(document, allowedPaths);
  await atomicWriteJson(rollbackPath, document);
  return transaction;
}

export async function restoreRollbackSnapshot(transaction) {
  for (const file of transaction.files) {
    const content = Buffer.from(file.contentBase64, 'base64');
    if (sha256(content) !== file.sha256) throw new Error(`Rollback checksum failed for ${file.path}.`);
    await atomicWriteText(path.join(projectRoot, file.path), content.toString('utf8'));
  }
}
