import assert from 'node:assert/strict';
import test from 'node:test';
import { localeDefinitions } from '../../src/i18n/config.ts';
import { workbenchMessages } from '../../src/i18n/workbench.ts';
import { localizedNoTextStatus, noTextMessageForTool } from '../../src/lib/action-messages.ts';

const scanOrOcr = /\bOCR\b|scan|スキャン|스캔|escane|numéris|digitaliz|扫描|掃描|स्कैन|مسح|скан|pindai|scansion|taran|quét|สแกน|skan/iu;

test('PDF-to-Word and Word-to-PDF map to truthful native no-text messages in every locale', () => {
  const published = localeDefinitions.filter((locale) => locale.published);
  for (const locale of published) {
    const messages = workbenchMessages[locale.path];
    assert.ok(messages.noTextAfterOcr?.trim(), `${locale.path} missing noTextAfterOcr`);
    assert.ok(messages.noReadableText?.trim(), `${locale.path} missing noReadableText`);
    assert.notEqual(messages.noTextAfterOcr, messages.noReadableText, `${locale.path} messages must be tool-specific`);
    assert.match(messages.noTextAfterOcr, /OCR/iu, `${locale.path} PDF-to-Word error must explain local OCR`);
    assert.doesNotMatch(messages.noReadableText, scanOrOcr, `${locale.path} Word-to-PDF error must not mention OCR or scans`);
    if (locale.path !== 'en') {
      assert.notEqual(messages.noReadableText, workbenchMessages.en.noReadableText, `${locale.path} generic error must be localized`);
      assert.notEqual(messages.noTextAfterOcr, workbenchMessages.en.noTextAfterOcr, `${locale.path} OCR error must be localized`);
    }
    assert.equal(noTextMessageForTool('pdf-to-word', messages), messages.noTextAfterOcr);
    assert.equal(noTextMessageForTool('word-to-pdf', messages), messages.noReadableText);
    assert.equal(localizedNoTextStatus('pdf-to-word', 'No readable text was found.', messages), messages.noTextAfterOcr);
    assert.equal(localizedNoTextStatus('word-to-pdf', 'No readable text was found.', messages), messages.noReadableText);
  }
});
