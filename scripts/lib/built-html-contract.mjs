import { parse } from 'parse5';

const discoveryHooks = [
  'data-home-workspace',
  'data-home-hero',
  'data-popular-workflows',
  'data-tool-explorer',
  'data-privacy-proof',
  'data-home-content',
];

export function parseHtml(html) {
  return parse(html);
}

export function attribute(node, name) {
  return node?.attrs?.find((item) => item.name === name)?.value;
}

export function hasAttribute(node, name) {
  return node?.attrs?.some((item) => item.name === name) ?? false;
}

export function elementChildren(node) {
  return (node?.childNodes ?? []).filter((child) => child.tagName);
}

export function descendants(node, predicate = () => true) {
  const matches = [];
  const visit = (candidate) => {
    for (const child of candidate?.childNodes ?? []) {
      if (child.tagName && predicate(child)) matches.push(child);
      visit(child);
    }
  };
  visit(node);
  return matches;
}

export function elementsWithData(document, dataAttribute) {
  return descendants(document, (node) => hasAttribute(node, dataAttribute));
}

export function textContent(node) {
  if (!node) return '';
  if (node.nodeName === '#text') return node.value ?? '';
  return (node.childNodes ?? []).map(textContent).join('').replace(/\s+/gu, ' ').trim();
}

export function visibleTextContent(node) {
  if (!node) return '';
  if (!isEffectivelyVisible(node)) return '';
  if (node.nodeName === '#text') return node.value ?? '';
  return (node.childNodes ?? []).map(visibleTextContent).join('').replace(/\s+/gu, ' ').trim();
}

function isHidden(node) {
  const classes = (attribute(node, 'class') ?? '').split(/\s+/u).filter(Boolean);
  const style = attribute(node, 'style') ?? '';
  return hasAttribute(node, 'hidden')
    || attribute(node, 'aria-hidden')?.toLowerCase() === 'true'
    || classes.includes('hidden')
    || /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:;|$)/iu.test(style);
}

export function isEffectivelyVisible(node) {
  let candidate = node?.nodeName === '#text' ? node.parentNode : node;
  while (candidate) {
    if (['script', 'style', 'template'].includes(candidate.tagName) || isHidden(candidate)) return false;
    candidate = candidate.parentNode;
  }
  return true;
}

export function identifiedDisclosureContract(document, dataAttribute) {
  const disclosures = elementsWithData(document, dataAttribute);
  const node = disclosures[0];
  const visible = disclosures.length === 1 && isEffectivelyVisible(node);
  return {
    count: disclosures.length,
    visible,
    text: visible ? visibleTextContent(node) : '',
  };
}

function isInsideExcludedEmptyState(node) {
  let candidate = node;
  while (candidate) {
    if (hasAttribute(candidate, 'data-tool-empty')) return true;
    candidate = candidate.parentNode;
  }
  return false;
}

function dataLabel(node) {
  const preferred = [
    'data-tool-wrapper',
    'data-privacy-architecture',
    'data-process-flow',
    ...discoveryHooks,
  ].find((name) => hasAttribute(node, name));
  return preferred ? ` ${preferred}` : '';
}

function hasDiscoveryAncestor(node) {
  let candidate = node;
  while (candidate) {
    if (discoveryHooks.some((hook) => hasAttribute(candidate, hook))) return true;
    candidate = candidate.parentNode;
  }
  return false;
}

function hasDiscoveryDescendant(node) {
  return descendants(node, (candidate) => discoveryHooks.some((hook) => hasAttribute(candidate, hook))).length > 0;
}

export function discoveryVisibilityFailures(document) {
  const failures = [];
  const hiddenAncestors = new Set();
  for (const node of descendants(document)) {
    if ((!hasDiscoveryAncestor(node) && !hasDiscoveryDescendant(node)) || !isHidden(node) || isInsideExcludedEmptyState(node)) continue;
    if (textContent(node).length < 24) continue;

    let parent = node.parentNode;
    let nestedUnderReported = false;
    while (parent) {
      if (hiddenAncestors.has(parent)) {
        nestedUnderReported = true;
        break;
      }
      parent = parent.parentNode;
    }
    if (nestedUnderReported) continue;

    hiddenAncestors.add(node);
    failures.push(`substantive discovery copy is hidden in <${node.tagName}${dataLabel(node)}>`);
  }
  return failures;
}

function firstDescendantText(node, tagName) {
  const match = descendants(node, (candidate) => candidate.tagName === tagName)[0];
  return textContent(match);
}

export function processFlowContract(document) {
  const modules = elementsWithData(document, 'data-process-flow');
  if (modules.length !== 1) return { moduleCount: modules.length, orderedListCount: 0, steps: [] };

  const orderedLists = descendants(modules[0], (node) => node.tagName === 'ol');
  if (orderedLists.length !== 1) return { moduleCount: 1, orderedListCount: orderedLists.length, steps: [] };

  const steps = elementChildren(orderedLists[0])
    .filter((node) => node.tagName === 'li')
    .map((node) => ({
      title: firstDescendantText(node, 'h3'),
      text: firstDescendantText(node, 'p'),
    }));
  return { moduleCount: 1, orderedListCount: 1, steps };
}

export function toolCardLinkContract(document) {
  const cards = elementsWithData(document, 'data-tool-card');
  const failures = [];

  for (const [index, card] of cards.entries()) {
    const paragraphs = descendants(card, (node) => node.tagName === 'p');
    const formats = descendants(card, (node) => node.tagName === 'li');
    const nestedInteractive = descendants(card, (node) => ['a', 'button', 'input', 'select', 'textarea'].includes(node.tagName));
    const valid = card.tagName === 'a'
      && Boolean(attribute(card, 'href'))
      && Boolean(firstDescendantText(card, 'h3'))
      && paragraphs.length >= 2
      && paragraphs.every((node) => Boolean(visibleTextContent(node)))
      && formats.length >= 1
      && formats.every((node) => Boolean(visibleTextContent(node)))
      && Boolean(visibleTextContent(card))
      && nestedInteractive.length === 0;
    if (!valid) failures.push(`tool card ${index + 1} must be a nonempty descriptive anchor with title, description, and format text`);
  }

  return { cardCount: cards.length, failures };
}
