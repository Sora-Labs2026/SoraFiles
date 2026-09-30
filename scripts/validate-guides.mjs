import { existsSync } from 'node:fs';
import { guides } from '../src/data/guides.ts';
import { validateGuides } from '../src/lib/guide-validation.ts';
const result = validateGuides(guides, path => existsSync(new URL(`../public${path}`, import.meta.url)));
for (const message of result.warnings) console.warn(`WARN ${message}`);
for (const message of result.errors) console.error(`FAIL ${message}`);
console.log(`Guides: ${guides.length} records, ${result.errors.length} errors, ${result.warnings.length} warnings.`);
if (result.errors.length) process.exitCode = 1;
