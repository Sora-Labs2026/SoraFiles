import test from 'node:test';
import assert from 'node:assert/strict';

const publicToolSlugs = [
  'compress-image',
  'compress-pdf',
  'heic-to-jpg',
  'image-converter',
  'jpg-to-pdf',
  'merge-pdf',
  'pdf-to-jpg',
  'pdf-to-word',
  'rotate-pdf',
  'split-pdf',
  'word-to-pdf',
];

const approvedNeutralWorkflowCopy = {
  en: ['Common workflows', 'Start with a common file workflow.'],
  ja: ['一般的な作業', '一般的なファイル作業から始められます。'],
  ko: ['일반적인 작업', '일반적인 파일 작업에서 바로 시작하세요.'],
  es: ['Flujos habituales', 'Empieza con un flujo de archivos habitual.'],
  fr: ['Tâches courantes', 'Commencez par une tâche de fichier courante.'],
  de: ['Gängige Aufgaben', 'Starte mit einer gängigen Dateiaufgabe.'],
  pt: ['Fluxos comuns', 'Comece por um fluxo de ficheiros comum.'],
  'zh-cn': ['常见任务', '从常见的文件任务开始。'],
  'zh-tw': ['常見工作', '從常見的檔案工作開始。'],
  hi: ['सामान्य काम', 'किसी सामान्य फ़ाइल काम से शुरू करें।'],
  ar: ['مهام شائعة', 'ابدأ بإحدى مهام الملفات الشائعة.'],
  ru: ['Обычные задачи', 'Начните с обычной операции с файлами.'],
  id: ['Alur kerja umum', 'Mulai dengan alur kerja file yang umum.'],
  it: ['Attività comuni', "Inizia da un'attività comune sui file."],
  nl: ['Gangbare taken', 'Begin met een gangbare bestandstaak.'],
  tr: ['Yaygın işlemler', 'Yaygın bir dosya işlemiyle başlayın.'],
  vi: ['Tác vụ thường gặp', 'Bắt đầu với một tác vụ tệp thường gặp.'],
  th: ['งานทั่วไป', 'เริ่มจากงานไฟล์ทั่วไป'],
  pl: ['Typowe zadania', 'Zacznij od typowej operacji na plikach.'],
};

test('every published locale provides a complete searchable discovery catalog', async () => {
  const { localeContent } = await import('../../src/i18n/index.ts');
  const { localeDefinitions } = await import('../../src/i18n/config.ts');
  const { normalizeDiscoveryText } = await import('../../src/lib/tool-discovery.ts');

  for (const locale of localeDefinitions.filter((item) => item.published)) {
    const home = localeContent[locale.path].home;
    assert.ok(home.popularTitle?.trim(), `${locale.path} missing popularTitle`);
    assert.ok(home.popularIntro?.trim(), `${locale.path} missing popularIntro`);
    assert.ok(home.searchExamplesLabel?.trim(), `${locale.path} missing searchExamplesLabel`);
    assert.equal(home.searchExamples?.length, 3, `${locale.path} must provide 3 searchExamples`);
    for (const example of home.searchExamples) {
      assert.ok(example.trim(), `${locale.path} has an empty searchExample`);
    }
    assert.ok(home.resultCount?.trim(), `${locale.path} missing resultCount`);
    assert.ok(home.resultCount.includes('{count}'), `${locale.path} resultCount must contain {count}`);

    assert.deepEqual(
      Object.keys(home.searchAliases ?? {}).sort(),
      publicToolSlugs,
      `${locale.path} searchAliases must have exactly the 11 public tool slugs`,
    );

    for (const slug of publicToolSlugs) {
      const aliases = home.searchAliases[slug];
      assert.ok(Array.isArray(aliases), `${locale.path} missing aliases for ${slug}`);
      const normalized = aliases
        .map((alias) => normalizeDiscoveryText(alias, locale.code))
        .filter(Boolean);
      assert.equal(normalized.length, aliases.length, `${locale.path} ${slug} has an empty alias`);
      assert.ok(new Set(normalized).size >= 2, `${locale.path} ${slug} needs 2 unique normalized aliases`);
    }
  }
});

test('every locale uses approved neutral workflow copy without unsupported usage statistics', async () => {
  const { localeContent } = await import('../../src/i18n/index.ts');
  const { localeDefinitions } = await import('../../src/i18n/config.ts');

  for (const locale of localeDefinitions.filter((item) => item.published)) {
    assert.deepEqual(
      [localeContent[locale.path].home.popularTitle, localeContent[locale.path].home.popularIntro],
      approvedNeutralWorkflowCopy[locale.path],
      `${locale.path} workflow heading and intro must use the approved neutral copy`,
    );
  }
});

test('English discovery count is grammatical at one and homepage privacy names the contact exception', async () => {
  const { localeContent } = await import('../../src/i18n/index.ts');
  const home = localeContent.en.home;

  assert.equal(home.resultCount, 'Tools found: {count}');
  assert.equal(home.resultCount.replace('{count}', '1'), 'Tools found: 1');
  assert.match(home.faqs[0].answer, /Contact form/iu);
  assert.match(home.faqs[0].answer, /name, email address, subject, message, and any optional attachment/iu);
  assert.match(home.faqs[0].answer, /FormSubmit/iu);
  assert.match(home.faqs[0].answer, /Sora Labs/iu);
  assert.match(home.faqs[0].answer, /not part of the local file-tool flow/iu);
});

test('representative outcome phrases map to the correct tools', async () => {
  const { localeContent } = await import('../../src/i18n/index.ts');
  const expectedAliases = {
    en: {
      'compress-pdf': 'make pdf smaller',
      'compress-image': 'shrink photo',
      'heic-to-jpg': 'iphone photo to jpg',
      'merge-pdf': 'combine documents',
      'split-pdf': 'separate pdf pages',
      'rotate-pdf': 'turn pdf pages',
      'jpg-to-pdf': 'photos to pdf',
      'pdf-to-jpg': 'pdf pages to images',
      'pdf-to-word': 'extract pdf text',
      'word-to-pdf': 'docx to pdf',
    },
    es: {
      'compress-pdf': 'comprimir pdf',
      'compress-image': 'reducir imagen',
      'merge-pdf': 'unir pdf',
      'pdf-to-jpg': 'pdf a imagen',
    },
    ja: {
      'compress-pdf': 'PDF 圧縮',
      'compress-image': '画像 圧縮',
      'merge-pdf': 'PDF 結合',
      'pdf-to-jpg': 'PDF 画像',
    },
    ar: {
      'compress-pdf': 'ضغط PDF',
      'compress-image': 'ضغط صورة',
      'merge-pdf': 'دمج PDF',
      'pdf-to-jpg': 'PDF إلى صورة',
    },
  };

  for (const [locale, tools] of Object.entries(expectedAliases)) {
    for (const [slug, alias] of Object.entries(tools)) {
      assert.ok(
        localeContent[locale].home.searchAliases?.[slug]?.includes(alias),
        `${locale} ${slug} missing representative alias: ${alias}`,
      );
    }
  }
});
