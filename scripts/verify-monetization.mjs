import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = (path) => readFileSync(path, 'utf8');
const walk = (root) => readdirSync(root, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(root, entry.name)) : [join(root, entry.name)]);
const activeFiles = [...walk('src'), 'worker.js'].filter((path) => /\.(?:astro|ts|js|mjs)$/.test(path));
const activeSource = activeFiles.map((path) => read(path)).join('\n');
check(!/acscdn\.com\/script|runAutoTag|zoneId:\s*['"]ag86oktn3r|highperformanceformat|effectivecpmnetwork/i.test(activeSource), 'Active source still contains an advertising runtime.');
check(!read('wrangler.jsonc').includes('ads.sorafiles.com'), 'The obsolete advertising subdomain route must be absent.');
check(!existsSync('src/components/AdcashAutoTag.astro'), 'The paused Adcash component must be absent.');
check(!existsSync('src/components/AdsterraSlot.astro'), 'The obsolete Adsterra slot component must be absent.');
check(!existsSync('src/pages/ad-frame/[unit].astro'), 'Obsolete ad-frame routes must be absent.');

const publicPages = walk('dist').filter((path) => path.endsWith('.html'));
const staleAdvertisingCopy = /Adcash|Adsterra|Advertisement|Ad-light|ads may not load|Los anuncios pueden no cargarse|Os anúncios podem não carregar|publicités?[^.]{0,40}(?:charg|affich)|Werbung[^.]{0,40}(?:lad|anzeig)|広告[^。]{0,30}(?:読み込|表示)|광고[^.]{0,30}(?:로드|표시)|广告[^。]{0,30}(?:加载|显示)|廣告[^。]{0,30}(?:載入|顯示)|विज्ञापन[^।]{0,30}(?:लोड|दिख)|โฆษณา[^.]{0,30}(?:โหลด|แสดง)|إعلانات?[^.]{0,30}(?:تحميل|عرض)|реклам[^.]{0,30}(?:загруз|показ)/i;
check(!staleAdvertisingCopy.test(activeSource), 'Active source still contains obsolete advertising copy.');
for (const path of publicPages) {
  check(existsSync(path), `${path} is missing.`);
  if (!existsSync(path)) continue;
  const html = read(path);
  check(!/acscdn\.com\/script|runAutoTag|zoneId:\s*['"]ag86oktn3r|highperformanceformat|effectivecpmnetwork|data-ad-placement|data-sf-ad-slot|data-ad-frame|googletagmanager|google-analytics|G-GQ973RY74K|data-sf-google-analytics|\bgtag\s*\(/i.test(html), `${path} must remain free of advertising and Google Analytics runtime code.`);
  check(!staleAdvertisingCopy.test(html), `${path} still contains obsolete advertising copy.`);
  check((html.match(/https:\/\/analytics\.ahrefs\.com\/analytics\.js/g) ?? []).length === 1, `${path} must contain exactly one Ahrefs Web Analytics loader.`);
}

if (failures.length) { console.error(failures.map((failure) => `- ${failure}`).join('\n')); process.exit(1); }
console.log('Monetization verification passed: all public pages are advertising-free and no advertising runtime remains.');
