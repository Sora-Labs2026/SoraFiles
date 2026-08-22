import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = (path) => readFile(path, 'utf8');
const count = (text, token) => text.split(token).length - 1;

const units = {
  native: {
    key: 'e64ba76560a59a8652ea3c5504009c7c',
    url: 'https://pl30950304.effectivecpmnetwork.com/e64ba76560a59a8652ea3c5504009c7c/invoke.js',
    frame: 'https://ads.sorafiles.com/ad-frame/native',
  },
  desktop: {
    key: '70a4fb276bf6ae0d7991a271ba576aae',
    url: 'https://www.highperformanceformat.com/70a4fb276bf6ae0d7991a271ba576aae/invoke.js',
    frame: 'https://ads.sorafiles.com/ad-frame/desktop',
  },
  mobile: {
    key: '75b5c758697745d4fa0f23560ae6d3d2',
    url: 'https://www.highperformanceformat.com/75b5c758697745d4fa0f23560ae6d3d2/invoke.js',
    frame: 'https://ads.sorafiles.com/ad-frame/mobile',
  },
  rectangle: {
    key: '620aced0385b8490a1344af907d1d151',
    url: 'https://www.highperformanceformat.com/620aced0385b8490a1344af907d1d151/invoke.js',
    frame: 'https://ads.sorafiles.com/ad-frame/rectangle',
  },
};
const authorizedKeys = new Set(Object.values(units).map(({ key }) => key));

for (const path of ['public/ads.txt', 'public/bbd8dc6c771660df9481.txt', 'bbd8dc6c771660df9481.txt', 'dist/ads.txt', 'dist/bbd8dc6c771660df9481.txt']) {
  check(!existsSync(path), `${path} must be removed.`);
}

const worker = await read('worker.js');
check(worker.includes("'/ads.txt'") && worker.includes("'/bbd8dc6c771660df9481.txt'"), 'The worker must tombstone removed advertising paths.');
check(/REMOVED_AD_PATHS\.has\(url\.pathname\)[\s\S]*?status:\s*404/.test(worker), 'Removed advertising paths must return an explicit 404.');
check(worker.includes("const AD_FRAME_HOST = 'ads.sorafiles.com'"), 'The isolated ad documents must use the dedicated ads origin.');
check(worker.includes("url.hostname === AD_FRAME_HOST && url.pathname === '/robots.txt'"), 'The ads origin must serve a dedicated robots policy.');
check(worker.includes('Allow: /ad-frame/') && worker.includes('Disallow: /'), 'The ads robots policy must allow only isolated frame resources.');
check(/AD_FRAME_HOST[\s\S]*?X-Robots-Tag', 'noindex, nofollow, noarchive'/.test(worker), 'Isolated ad documents must be noindex at the edge.');
check(worker.includes("frame-ancestors https://${CANONICAL_HOST}"), 'Only the canonical site may embed isolated ad documents.');

const componentPath = 'src/components/AdsterraSlot.astro';
check(existsSync(componentPath), 'The centralized AdsterraSlot component must exist.');
check(!existsSync('src/components/AdsterraBanner.astro'), 'The obsolete AdsterraBanner component must be removed.');
const component = await read(componentPath);
for (const { key, url } of Object.values(units)) {
  check(component.includes(key) && component.includes(url), `AdsterraSlot must preserve authorized unit ${key}.`);
}
check(component.includes("frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-top-navigation-by-user-activation')"), 'Every provider snippet must execute in the approved cross-origin sandbox.');
check(component.includes("const frameOrigin = 'https://ads.sorafiles.com'"), 'The component must target the dedicated cross-origin frame host.');
check(component.includes('frame.src = source'), 'Real browsers must load the dedicated provider document rather than about:srcdoc.');
check(component.includes("frame.loading = priority ? 'eager' : 'lazy'"), 'Primary ads must load eagerly while lower placements remain lazy.');
check(component.includes("frame.setAttribute('fetchpriority', 'high')"), 'Primary ads must receive high fetch priority.');
check(!component.includes('allow-popups'), 'Advertising frames must not be allowed to create popups.');
check(component.includes("matchMedia('(min-width: 768px)')"), 'Responsive horizontal ads must select a single unit at the 768px breakpoint.');
check(component.includes("matchMedia('(min-width: 1024px)')"), 'The rectangle must be gated to desktop widths.');
check(component.includes('navigator.webdriver'), 'Automated verification must not request live advertising.');

const sourceFiles = [];
const collect = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (['.astro', '.ts', '.js', '.mjs', '.html'].includes(extname(entry.name))) sourceFiles.push(path);
  }
};
await collect('src');
if (existsSync('public')) await collect('public');
const activeSource = `${await Promise.all(sourceFiles.map(read)).then((parts) => parts.join('\n'))}\n${worker}`;
const discoveredProviderKeys = [...activeSource.matchAll(/(?:effectivecpmnetwork|highperformanceformat)\.com\/([a-f0-9]{32})\/invoke\.js/g)].map((match) => match[1]);
check(discoveredProviderKeys.length === 4, `Active source must contain exactly four provider loaders; found ${discoveredProviderKeys.length}.`);
check(discoveredProviderKeys.every((key) => authorizedKeys.has(key)), 'Active source contains an unauthorized Adsterra loader key.');
check(!/adsbygoogle|pagead2\.googlesyndication\.com|ca-pub-|hilltopads|popunder|smartlink|social[ -]?bar|in[ -]?page[ -]?push/i.test(activeSource), 'Active source contains an obsolete or prohibited advertising integration.');

const assertPage = async (path, { slots, present, absent = [] }) => {
  const html = await read(path);
  check(count(html, 'data-ad-placement=') === slots, `${path} must contain exactly ${slots} rendered ad slots.`);
  for (const name of present) check(count(html, units[name].frame) === 1, `${path} must contain exactly one isolated frame source for the ${name} unit.`);
  for (const name of absent) check(!html.includes(units[name].frame), `${path} must not contain the ${name} frame.`);
  for (const { url } of Object.values(units)) check(!html.includes(url), `${path} must not expose a provider loader in the parent document.`);
  check(!/<script[^>]+src=["']https:\/\/(?:[^"']*effectivecpmnetwork|[^"']*highperformanceformat)/i.test(html), `${path} must not execute provider scripts in the parent document.`);
  check(!/adsbygoogle|pagead2\.googlesyndication\.com|ca-pub-|hilltopads/i.test(html), `${path} contains an obsolete advertising integration.`);
  return html;
};

for (const [name, { url }] of Object.entries(units)) {
  const path = `dist/ad-frame/${name}/index.html`;
  const html = await read(path);
  check(count(html, url) === 1, `${path} must contain exactly one approved ${name} loader.`);
  check(count(html, '/invoke.js') === 1, `${path} must contain only one provider loader.`);
  check(/<meta name="robots" content="noindex, nofollow, noarchive"/.test(html), `${path} must remain noindex.`);
  check(!/<section\b[^>]*\bdata-sf-ad-slot\b/i.test(html), `${path} must contain only the provider document, not an application ad slot.`);
  const providerOrigin = new URL(url).origin;
  check(html.includes(`rel="preconnect" href="${providerOrigin}"`), `${path} must preconnect to its exact provider origin.`);
}

for (const path of ['dist/index.html', 'dist/es/index.html', 'dist/ja/index.html', 'dist/ar/index.html']) {
  const html = await assertPage(path, { slots: 3, present: ['native', 'desktop', 'mobile', 'rectangle'] });
  const primary = html.indexOf('data-ad-placement="home-primary"');
  const tools = html.indexOf('id="tools"');
  const secondary = html.indexOf('data-ad-placement="home-secondary"');
  const lower = html.indexOf('data-ad-placement="home-lower-desktop"');
  check(primary >= 0 && primary < tools && tools < secondary && secondary < lower, `${path} ad placements must follow the approved home content boundaries.`);
  check(html.includes('rel="preconnect" href="https://ads.sorafiles.com"'), `${path} must preconnect to the isolated ad origin.`);
  check(html.includes('rel="preconnect" href="https://www.highperformanceformat.com"'), `${path} must preconnect to the horizontal provider.`);
  check(html.includes('data-ad-priority="true"'), `${path} must prioritize its primary horizontal ad.`);
}

for (const path of ['dist/pdf/index.html', 'dist/compress-image/index.html', 'dist/ja/pdf/index.html']) {
  const html = await assertPage(path, { slots: 2, present: ['native', 'desktop', 'mobile'], absent: ['rectangle'] });
  const workbench = html.indexOf('id="workbench"');
  const primary = html.indexOf('data-ad-placement="tool-after-workbench"');
  const native = html.indexOf('data-ad-placement="tool-before-related"');
  check(workbench >= 0 && workbench < primary && primary < native, `${path} ads must remain after the workbench and before related content.`);
  check(html.includes('rel="preconnect" href="https://ads.sorafiles.com"'), `${path} must preconnect on monetized tool routes.`);
  check(html.includes('data-ad-priority="true"'), `${path} must prioritize its primary horizontal ad.`);
}

for (const path of ['dist/privacy/index.html', 'dist/about/index.html', 'dist/contact/index.html']) {
  const html = await assertPage(path, { slots: 0, present: [], absent: ['native', 'desktop', 'mobile', 'rectangle'] });
  check(!html.includes('rel="preconnect" href="https://ads.sorafiles.com"'), `${path} must not contact ad origins on ad-free routes.`);
}

if (failures.length) {
  console.error(`Monetization verification failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('Monetization verification passed: only the four authorized Adsterra units exist in dedicated cross-origin sandbox documents, responsive selection and density rules are guarded, placements remain outside file workflows, and obsolete/prohibited integrations are absent.');
