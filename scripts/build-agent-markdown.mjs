// Markdown for Agents: writes a clean Markdown twin (index.md) beside every
// indexable page in dist/. The Worker serves it when a request prefers
// text/markdown; browsers keep receiving HTML. Noindex pages get no twin.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';

const SITE = 'https://sorafiles.com';
const dist = path.resolve('dist');
const SKIP = new Set(['script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'button', 'input', 'select', 'textarea', 'form', 'video', 'audio', 'dialog', 'output', 'progress', 'meter']);
const BLOCK = new Set(['address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl', 'dd', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'legend', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'summary', 'table', 'ul']);

const attr = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
// Decorative illustrations (the animated hero product window) carry no page facts.
const skipped = (node) => !node.tagName || SKIP.has(node.tagName) || attr(node, 'hidden') !== undefined || attr(node, 'aria-hidden') === 'true' || attr(node, 'data-hero-visualization') !== undefined;
// Adjacent elements are often separate lines through CSS alone (stacked spans,
// card title then description). Keep their words apart in plain text.
const joinChildren = (children, render) => {
  let text = '', previousElement = false;
  for (const child of children ?? []) {
    const part = render(child), element = Boolean(child.tagName);
    if (element && previousElement && /\S$/.test(text) && /^\S/.test(part)) text += ' ';
    text += part; if (part) previousElement = element;
  }
  return text;
};
const elements = (node) => (node.childNodes ?? []).filter((child) => child.tagName);
const absolute = (href) => { try { return href ? new URL(href, SITE).href : ''; } catch { return ''; } };
const hasBlock = (node) => elements(node).some((child) => !skipped(child) && (BLOCK.has(child.tagName) || hasBlock(child)));
const clean = (text) => text.replace(/[ \t\r\f\v]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();

function find(node, test) {
  if (test(node)) return node;
  for (const child of node.childNodes ?? []) { const found = find(child, test); if (found) return found; }
  return null;
}
function textContent(node) {
  if (node.nodeName === '#text') return node.value;
  return skipped(node) && node.nodeName !== '#document' ? '' : joinChildren(node.childNodes, textContent);
}

function inline(node) {
  if (node.nodeName === '#text') return node.value.replace(/\s+/g, ' ');
  if (skipped(node)) return '';
  const inner = () => joinChildren(node.childNodes, inline);
  switch (node.tagName) {
    case 'br': return '\n';
    case 'strong': case 'b': { const text = inner().trim(); return text ? `**${text}**` : ''; }
    case 'em': case 'i': { const text = inner().trim(); return text ? `_${text}_` : ''; }
    case 'code': { const text = inner().trim(); return text ? `\`${text}\`` : ''; }
    case 'a': { const text = clean(inner()); const href = absolute(attr(node, 'href')); return text && href ? `[${text}](${href})` : text; }
    case 'img': { const alt = attr(node, 'alt')?.trim(); return alt ? `![${alt}](${absolute(attr(node, 'src'))})` : ''; }
    default: return inner();
  }
}
const inlineText = (node) => clean(joinChildren(node.childNodes, inline));

function table(node, out) {
  const rows = [];
  const collect = (parent) => { for (const child of elements(parent)) { if (child.tagName === 'tr') rows.push(elements(child).filter((cell) => ['th', 'td'].includes(cell.tagName)).map((cell) => inlineText(cell).replaceAll('|', '\\|').replaceAll('\n', ' '))); else if (['thead', 'tbody', 'tfoot'].includes(child.tagName)) collect(child); } };
  collect(node);
  const width = Math.max(0, ...rows.map((row) => row.length));
  if (!width) return;
  const line = (cells) => `| ${Array.from({ length: width }, (_, index) => cells[index] ?? '').join(' | ')} |`;
  out.push([line(rows[0]), line(Array(width).fill('---')), ...rows.slice(1).map(line)].join('\n'));
}

function blocks(node, out) {
  let run = '', afterElement = false;
  const flush = () => { const text = clean(run); if (text) out.push(text); run = ''; afterElement = false; };
  for (const child of node.childNodes ?? []) {
    if (child.nodeName === '#text') { run += child.value.replace(/\s+/g, ' '); if (child.value.trim()) afterElement = false; continue; }
    if (skipped(child)) continue;
    if (child.tagName === 'a' && hasBlock(child)) {
      // Card-style links wrap headings and text: keep them as one linked line.
      flush(); const text = clean(textContent(child).replace(/\s+/g, ' ')); const href = absolute(attr(child, 'href'));
      if (text) out.push(href ? `- [${text}](${href})` : text); continue;
    }
    if (!BLOCK.has(child.tagName) && !hasBlock(child)) { const part = inline(child); if (afterElement && /\S$/.test(run) && /^\S/.test(part)) run += ' '; run += part; if (part) afterElement = true; continue; }
    flush(); block(child, out);
  }
  flush();
}

function block(node, out) {
  const tag = node.tagName;
  if (/^h[1-6]$/.test(tag)) { const text = inlineText(node).replaceAll('\n', ' '); if (text) out.push(`${'#'.repeat(Number(tag[1]))} ${text}`); return; }
  if (tag === 'ul' || tag === 'ol') {
    let index = 1; const items = [];
    for (const item of elements(node).filter((child) => child.tagName === 'li' && !skipped(child))) {
      const parts = []; blocks(item, parts); if (!parts.length) continue;
      items.push(`${tag === 'ol' ? `${index++}.` : '-'} ${parts.join('\n').replaceAll('\n', '\n  ')}`);
    }
    if (items.length) out.push(items.join('\n'));
    return;
  }
  if (tag === 'table') return table(node, out);
  if (tag === 'pre') { const text = textContent(node).replace(/\n+$/, ''); if (text.trim()) out.push(`\`\`\`\n${text}\n\`\`\``); return; }
  if (tag === 'hr') { out.push('---'); return; }
  if (tag === 'summary') { const text = inlineText(node); if (text) out.push(`**${text}**`); return; }
  if (tag === 'blockquote') { const parts = []; blocks(node, parts); if (parts.length) out.push(parts.join('\n\n').split('\n').map((line) => `> ${line}`).join('\n')); return; }
  blocks(node, out);
}

export function htmlToAgentMarkdown(html) {
  const document = parse(html);
  const head = find(document, (node) => node.tagName === 'head');
  const meta = (name) => head && find(head, (node) => node.tagName === 'meta' && attr(node, 'name') === name);
  const robots = attr(meta('robots') ?? {}, 'content') ?? '';
  if (/\bnoindex\b/i.test(robots)) return null;
  const title = clean(textContent(find(head ?? document, (node) => node.tagName === 'title') ?? { nodeName: '#text', value: '' }));
  const description = attr(meta('description') ?? {}, 'content') ?? '';
  const canonical = attr(find(head ?? document, (node) => node.tagName === 'link' && attr(node, 'rel') === 'canonical') ?? {}, 'href') ?? '';
  const main = find(document, (node) => node.tagName === 'main') ?? find(document, (node) => node.tagName === 'body');
  if (!main) return null;
  const out = []; blocks(main, out);
  const body = out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  const quote = (value) => JSON.stringify(value.replace(/\s+/g, ' ').trim());
  return `---\ntitle: ${quote(title)}\ndescription: ${quote(description)}\nurl: ${canonical}\n---\n\n${body}\n`;
}

async function* htmlFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) { if (entry.name !== '_astro') yield* htmlFiles(full); }
    else if (entry.name.endsWith('.html') && entry.name !== '404.html') yield full;
  }
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll('\\', '/').replace(/^\//, '')}`) {
  let written = 0, skippedPages = 0;
  for await (const file of htmlFiles(dist)) {
    const markdown = htmlToAgentMarkdown(await readFile(file, 'utf8'));
    if (!markdown) { skippedPages++; continue; }
    await writeFile(file.replace(/\.html$/, '.md'), markdown);
    written++;
  }
  console.log(`Markdown for agents: ${written} pages written, ${skippedPages} noindex pages skipped.`);
}
