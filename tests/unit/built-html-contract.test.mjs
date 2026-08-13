import assert from 'node:assert/strict';
import test from 'node:test';
import {
  discoveryVisibilityFailures,
  identifiedDisclosureContract,
  parseHtml,
  processFlowContract,
  toolCardLinkContract,
} from '../../scripts/lib/built-html-contract.mjs';
import { readFile } from 'node:fs/promises';

const shell = (content) => `<!doctype html><html><body><main>${content}</main></body></html>`;

test('hidden tool wrapper is rejected as substantive hidden discovery content', () => {
  const document = parseHtml(shell(`
    <section data-tool-explorer>
      <div data-tool-wrapper hidden><article><h3>Compress PDF</h3><p>Make a document smaller locally in this browser.</p></article></div>
      <div data-tool-empty hidden>No matching tool. Change the search or category.</div>
    </section>
  `));

  assert.deepEqual(discoveryVisibilityFailures(document), [
    'substantive discovery copy is hidden in <div data-tool-wrapper>',
  ]);
});

test('hidden nested privacy module is rejected', () => {
  const document = parseHtml(shell(`
    <div data-privacy-proof>
      <section><div data-privacy-architecture style="visibility: hidden"><h2>Private by architecture</h2><p>Your files remain on this device while processing.</p></div></section>
    </div>
  `));

  assert.deepEqual(discoveryVisibilityFailures(document), [
    'substantive discovery copy is hidden in <div data-privacy-architecture>',
  ]);
});

test('a hidden generic ancestor cannot conceal a discovery module', () => {
  const document = parseHtml(shell(`
    <div class="hidden">
      <section data-tool-explorer><article><h2>Find a tool</h2><p>Search every local file workflow from this visible catalog.</p></article></section>
    </div>
  `));

  assert.deepEqual(discoveryVisibilityFailures(document), [
    'substantive discovery copy is hidden in <div>',
  ]);
});

test('aria-hidden and display none are rejected inside discovery content', () => {
  for (const hiddenMarkup of ['aria-hidden="true"', 'style="display: none"']) {
    const document = parseHtml(shell(`
      <section data-tool-explorer>
        <div ${hiddenMarkup}><h2>Find a tool</h2><p>Search every local workflow without uploading a file.</p></div>
      </section>
    `));
    assert.equal(discoveryVisibilityFailures(document).length, 1, hiddenMarkup);
  }
});

test('intentional interactive empty state is excluded from the static visibility invariant', () => {
  const document = parseHtml(shell(`
    <section data-tool-explorer>
      <div data-tool-wrapper><article><h3>Compress PDF</h3><p>Make a document smaller locally in this browser.</p></article></div>
      <div data-tool-empty hidden>No matching tool. Change the search or category.</div>
    </section>
  `));

  assert.deepEqual(discoveryVisibilityFailures(document), []);
});

test('identified disclosure is not visible when hidden on itself or an ancestor', () => {
  for (const markup of [
    '<p data-pdf-to-word-ocr-disclosure hidden>Scanned pages use local OCR with accuracy limits.</p>',
    '<div aria-hidden="true"><p data-pdf-to-word-ocr-disclosure>Scanned pages use local OCR with accuracy limits.</p></div>',
  ]) {
    const contract = identifiedDisclosureContract(parseHtml(shell(markup)), 'data-pdf-to-word-ocr-disclosure');
    assert.equal(contract.count, 1);
    assert.equal(contract.visible, false);
    assert.equal(contract.text, '');
  }
});

test('parse5 is declared directly as a development dependency', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  assert.match(packageJson.devDependencies?.parse5 ?? '', /^\^7\.3\.0$/u);
  assert.equal(packageJson.dependencies?.parse5, undefined);
});

test('process flow reads exactly three catalog-matching list items from its own ol', () => {
  const document = parseHtml(shell(`
    <div data-process-flow><section><ol>
      <li><h3>Select</h3><p>Open the file on this device.</p></li>
      <li><h3>Process locally</h3><p>Your browser does the work.</p></li>
      <li><h3>Download</h3><p>Save a separate result.</p></li>
    </ol></section></div>
    <ol><li><h3>Unrelated</h3><p>This later list must not be counted.</p></li></ol>
  `));

  assert.deepEqual(processFlowContract(document), {
    moduleCount: 1,
    orderedListCount: 1,
    steps: [
      { title: 'Select', text: 'Open the file on this device.' },
      { title: 'Process locally', text: 'Your browser does the work.' },
      { title: 'Download', text: 'Save a separate result.' },
    ],
  });
});

test('process flow does not borrow an unrelated list when its own ol is missing', () => {
  const document = parseHtml(shell(`
    <div data-process-flow><section><p>No ordered steps here.</p></section></div>
    <ol>
      <li><h3>Select</h3><p>Open the file on this device.</p></li>
      <li><h3>Process locally</h3><p>Your browser does the work.</p></li>
      <li><h3>Download</h3><p>Save a separate result.</p></li>
    </ol>
  `));

  assert.deepEqual(processFlowContract(document), {
    moduleCount: 1,
    orderedListCount: 0,
    steps: [],
  });
});

test('tool card contract requires the card itself to be a descriptive crawlable anchor', () => {
  const valid = parseHtml(shell(`
    <section data-tool-explorer>
      <a data-tool-card href="/pdf"><h3>Compress PDF</h3><p>PDF compression</p><p>Make a PDF smaller locally.</p><ul aria-label="Compress PDF formats"><li>PDF</li></ul></a>
    </section>
  `));
  assert.deepEqual(toolCardLinkContract(valid), { cardCount: 1, failures: [] });

  const emptyOverlay = parseHtml(shell(`
    <section data-tool-explorer>
      <article data-tool-card><a href="/pdf" aria-label="Open: Compress PDF"></a><h3>Compress PDF</h3><p>Make a PDF smaller locally.</p></article>
    </section>
  `));
  assert.deepEqual(toolCardLinkContract(emptyOverlay), {
    cardCount: 1,
    failures: ['tool card 1 must be a nonempty descriptive anchor with title, description, and format text'],
  });
});
