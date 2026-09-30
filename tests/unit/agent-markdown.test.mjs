import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { prefersMarkdown } from '../../worker.js';
import { htmlToAgentMarkdown } from '../../scripts/build-agent-markdown.mjs';

const page = '<!doctype html><html><head><title>Compress Image | SoraFiles</title><meta name="description" content="Shrink images."><meta name="robots" content="index,follow"><link rel="canonical" href="https://sorafiles.com/compress-image"></head><body><header>Site nav</header><main><h1><span>Everyday PDF</span><span>and image tools.</span></h1><p>Files stay <strong>on your device</strong>. See <a href="/privacy">privacy</a>.</p><script>secret()</script><form><button>Run</button></form><figure data-hero-visualization>demo</figure><ul><li>One</li><li>Two</li></ul><table><tr><th>Plan</th><th>Price</th></tr><tr><td>Personal</td><td>$1.99</td></tr></table></main></body></html>';

test('agent markdown keeps page facts and drops scripts, controls and decoration', () => {
  const markdown = htmlToAgentMarkdown(page);
  assert.match(markdown, /^---\ntitle: "Compress Image \| SoraFiles"\ndescription: "Shrink images."\nurl: https:\/\/sorafiles\.com\/compress-image\n---/);
  assert.match(markdown, /^# Everyday PDF and image tools\.$/m);
  assert.match(markdown, /Files stay \*\*on your device\*\*\. See \[privacy\]\(https:\/\/sorafiles\.com\/privacy\)\./);
  assert.match(markdown, /^- One\n- Two$/m);
  assert.match(markdown, /\| Plan \| Price \|\n\| --- \| --- \|\n\| Personal \| \$1\.99 \|/);
  for (const hidden of ['secret', 'Run', 'demo', 'Site nav']) assert.equal(markdown.includes(hidden), false, hidden);
  assert.equal(htmlToAgentMarkdown(page.replace('index,follow', 'noindex,follow')), null);
});

test('only clients that rank markdown at least as high as html get markdown', () => {
  assert.equal(prefersMarkdown('text/markdown'), true);
  assert.equal(prefersMarkdown('text/markdown, text/html;q=0.9'), true);
  assert.equal(prefersMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'), false);
  assert.equal(prefersMarkdown('text/html, text/markdown;q=0.5'), false);
  assert.equal(prefersMarkdown('text/markdown;q=0'), false);
  assert.equal(prefersMarkdown(''), false);
});

test('worker negotiates markdown on the canonical URL and keeps html for browsers', async () => {
  const requested = [];
  const env = { ASSETS: { fetch: async (request) => {
    const { pathname } = new URL(request.url); requested.push(pathname);
    if (pathname === '/compress-image/index.md') return new Response('# Compress Image\n', { headers: { 'Content-Type': 'text/plain' } });
    return new Response('<!doctype html><title>x</title>', { headers: { 'Content-Type': 'text/html' } });
  } } };
  const markdown = await worker.fetch(new Request('https://sorafiles.com/compress-image', { headers: { Accept: 'text/markdown' } }), env);
  assert.equal(markdown.headers.get('Content-Type'), 'text/markdown; charset=utf-8');
  assert.equal(markdown.headers.get('Vary'), 'Accept');
  assert.equal(markdown.headers.get('Link'), '<https://sorafiles.com/compress-image>; rel="canonical"');
  assert.equal(await markdown.text(), '# Compress Image\n');
  const html = await worker.fetch(new Request('https://sorafiles.com/compress-image', { headers: { Accept: 'text/html' } }), env);
  assert.match(html.headers.get('Content-Type'), /^text\/html/);
  assert.match(html.headers.get('Vary') ?? '', /Accept/);
  const direct = await worker.fetch(new Request('https://sorafiles.com/compress-image/index.md'), env);
  assert.equal(direct.headers.get('X-Robots-Tag'), 'noindex');
});

test('homepage advertises llms.txt, sitemap and its markdown form in a Link header', async () => {
  const env = { ASSETS: { fetch: async () => new Response('<!doctype html><title>x</title>', { headers: { 'Content-Type': 'text/html' } }) },
    POPULARITY_DB: { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }), first: async () => null }), all: async () => ({ results: [] }), first: async () => null }) } };
  const response = await worker.fetch(new Request('https://sorafiles.com/', { method: 'GET' }), env, { waitUntil() {} });
  const link = response.headers.get('Link') ?? '';
  assert.match(link, /<\/llms\.txt>; rel="describedby"/);
  assert.match(link, /<\/sitemap\.xml>; rel="sitemap"/);
  assert.match(link, /<\/>; rel="alternate"; type="text\/markdown"/);
});
