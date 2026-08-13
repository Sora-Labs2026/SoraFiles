import test from 'node:test';
import assert from 'node:assert/strict';

// These imports use .ts files which require Node's TypeScript support (Node 22+)
// We need to use dynamic import with tsx or similar, or test against the built output
// For now, use the approach that works with the project's Node 22+ requirement

test('every published locale provides four privacy proof modules', async () => {
  const { localeContent } = await import('../../src/i18n/index.ts');
  const { localeDefinitions } = await import('../../src/i18n/config.ts');
  for (const locale of localeDefinitions.filter((item) => item.published)) {
    const content = localeContent[locale.path];
    assert.ok(content, `${locale.path} catalog is missing`);
    assert.ok(content.home.privacyProof, `${locale.path} missing privacyProof`);
    assert.equal(content.home.privacyProof.items.length, 4, `${locale.path} must have 4 proof items`);
    for (const item of content.home.privacyProof.items) {
      assert.ok(item.title.trim(), `${locale.path} proof item missing title`);
      assert.ok(item.value.trim(), `${locale.path} proof item missing value`);
      assert.ok(item.description.trim(), `${locale.path} proof item missing description`);
    }
  }
});

test('every published locale provides shared shell labels', async () => {
  const { localeContent } = await import('../../src/i18n/index.ts');
  const { localeDefinitions } = await import('../../src/i18n/config.ts');
  const requiredCommonKeys = ['skipToContent', 'openTool', 'theme', 'system', 'dark', 'light'];
  for (const locale of localeDefinitions.filter((item) => item.published)) {
    const content = localeContent[locale.path];
    assert.ok(content, `${locale.path} catalog is missing`);
    for (const key of requiredCommonKeys) {
      assert.ok(content.common[key]?.trim(), `${locale.path} common.${key} is missing or empty`);
    }
  }
});

test('global.css defines required modular theme tokens and reduced-motion block', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile('src/styles/global.css', 'utf8');
  const requiredTokens = [
    '--color-surface-raised',
    '--color-surface-subtle',
    '--shadow-lift',
    '--radius-module',
    'prefers-reduced-motion: reduce',
  ];
  for (const token of requiredTokens) {
    assert.ok(css.includes(token), `global.css missing token or block: ${token}`);
  }
});

