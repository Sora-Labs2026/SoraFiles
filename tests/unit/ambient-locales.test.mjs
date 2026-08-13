import assert from 'node:assert/strict';
import test from 'node:test';

test('every locale catalog provides nonempty ambient control labels', async () => {
  const { localeDefinitions } = await import('../../src/i18n/config.ts');
  const { themeMessages } = await import('../../src/i18n/theme.ts');
  const ambientKeys = ['ambientBubbles', 'ambientOn', 'ambientOff', 'ambientSystemSuppressed'];

  assert.equal(localeDefinitions.length, 19, 'the canonical locale registry must contain 19 locales');
  assert.equal(Object.keys(themeMessages).length, 19, 'theme messages must provide all 19 locale catalogs');

  for (const { path } of localeDefinitions) {
    const messages = themeMessages[path];
    assert.ok(messages, `${path} theme catalog is missing`);
    for (const key of ambientKeys) {
      assert.ok(messages[key]?.trim(), `${path} ${key} is missing or empty`);
    }
  }
});
