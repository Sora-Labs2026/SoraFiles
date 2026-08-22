import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const urls = {
  native: 'https://pl30950304.effectivecpmnetwork.com/e64ba76560a59a8652ea3c5504009c7c/invoke.js',
  desktop: 'https://www.highperformanceformat.com/70a4fb276bf6ae0d7991a271ba576aae/invoke.js',
  mobile: 'https://www.highperformanceformat.com/75b5c758697745d4fa0f23560ae6d3d2/invoke.js',
  rectangle: 'https://www.highperformanceformat.com/620aced0385b8490a1344af907d1d151/invoke.js',
};
const frames = {
  native: 'https://ads.sorafiles.com/ad-frame/native',
  desktop: 'https://ads.sorafiles.com/ad-frame/desktop',
  mobile: 'https://ads.sorafiles.com/ad-frame/mobile',
  rectangle: 'https://ads.sorafiles.com/ad-frame/rectangle',
};
const count = (text, token) => text.split(token).length - 1;

test('obsolete advertising verification files and component are removed', async () => {
  await assert.rejects(access('public/ads.txt', constants.F_OK));
  await assert.rejects(access('public/bbd8dc6c771660df9481.txt', constants.F_OK));
  await assert.rejects(access('src/components/AdsterraBanner.astro', constants.F_OK));
});

test('centralized component preserves and isolates exactly four authorized units', async () => {
  const source = await readFile('src/components/AdsterraSlot.astro', 'utf8');
  for (const url of Object.values(urls)) assert.ok(source.includes(url));
  assert.match(source, /const frameOrigin = 'https:\/\/ads\.sorafiles\.com'/);
  for (const frame of Object.values(frames)) assert.ok(source.includes(new URL(frame).pathname));
  assert.match(source, /frame\.setAttribute\('sandbox', 'allow-scripts allow-same-origin allow-forms allow-top-navigation-by-user-activation'\)/);
  assert.match(source, /matchMedia\('\(min-width: 768px\)'\)/);
  assert.match(source, /navigator\.webdriver/);
  assert.match(source, /has\('ad-test'\)/);
  assert.match(source, /frame\.src = source/);
  assert.match(source, /frame\.loading = priority \? 'eager' : 'lazy'/);
  assert.match(source, /fetchpriority', 'high'/);
  assert.match(source, /sorafiles-ad-frame/);
  assert.match(source, /collapseAdSlot/);
  assert.match(source, /dataset\.adState/);
  assert.doesNotMatch(source, /allow-popups|allow-top-navigation(?:\s|'|")/);
});

test('home contains three separated placements and all four isolated frame sources', async () => {
  const html = await readFile('dist/index.html', 'utf8');
  assert.equal(count(html, 'data-ad-placement='), 3);
  for (const frame of Object.values(frames)) assert.equal(count(html, frame), 1);
  for (const url of Object.values(urls)) assert.equal(count(html, url), 0);
  assert.ok(html.indexOf('data-ad-placement="home-primary"') < html.indexOf('id="tools"'));
  assert.ok(html.indexOf('id="tools"') < html.indexOf('data-ad-placement="home-secondary"'));
  assert.ok(html.indexOf('data-ad-placement="home-secondary"') < html.indexOf('data-ad-placement="home-lower-desktop"'));
  assert.match(html, /rel="preconnect" href="https:\/\/ads\.sorafiles\.com"/);
  assert.match(html, /data-ad-placement="home-primary"[^>]+data-ad-priority="true"/);
  assert.doesNotMatch(html, /<script[^>]+src=["']https:\/\/(?:[^"']*effectivecpmnetwork|[^"']*highperformanceformat)/i);
});

test('tool pages contain two placements after the workbench and no rectangle', async () => {
  const html = await readFile('dist/pdf/index.html', 'utf8');
  assert.equal(count(html, 'data-ad-placement='), 2);
  assert.equal(count(html, frames.native), 1);
  assert.equal(count(html, frames.desktop), 1);
  assert.equal(count(html, frames.mobile), 1);
  assert.equal(count(html, frames.rectangle), 0);
  for (const url of Object.values(urls)) assert.equal(count(html, url), 0);
  assert.ok(html.indexOf('id="workbench"') < html.indexOf('data-ad-placement="tool-after-workbench"'));
  assert.match(html, /rel="preconnect" href="https:\/\/ads\.sorafiles\.com"/);
  assert.match(html, /data-ad-placement="tool-after-workbench"[^>]+data-ad-priority="true"/);
});

test('each dedicated provider document contains one approved unit and is noindex', async () => {
  for (const [name, url] of Object.entries(urls)) {
    const html = await readFile(`dist/ad-frame/${name}/index.html`, 'utf8');
    assert.equal(count(html, url), 1);
    assert.equal(count(html, '/invoke.js'), 1);
    assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive"/);
    assert.match(html, /sorafiles-ad-frame/);
    assert.match(html, /MutationObserver/);
  }
});

test('information pages remain advertising-free', async () => {
  const html = await readFile('dist/privacy/index.html', 'utf8');
  assert.equal(count(html, 'data-ad-placement='), 0);
  for (const url of Object.values(urls)) assert.equal(count(html, url), 0);
  assert.doesNotMatch(html, /rel="preconnect" href="https:\/\/ads\.sorafiles\.com"/);
});
