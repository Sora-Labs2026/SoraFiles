import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { readApprovedBrand, renderBrandPng } from './generate-brand-icons.mjs';
import { localizedPath } from '../src/i18n/config.ts';

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
const readText = (path) => readFile(path, 'utf8');

const source = await readFile('favicon.png');
const sourceMetadata = await sharp(source).metadata();
check(sourceMetadata.format === 'png', 'favicon.png must remain a valid PNG.');
check(sourceMetadata.width === sourceMetadata.height, 'favicon.png must remain square.');
const { source: approvedSource } = await readApprovedBrand();
check(hash(source) === hash(approvedSource), 'Root favicon must be the locked V10 app icon.');
const renderPng = size => renderBrandPng(source, size);

const pngAssets = new Map([
  ['public/favicon-16x16.png', 16],
  ['public/favicon-32x32.png', 32],
  ['public/favicon-48x48.png', 48],
  ['public/favicon-96x96.png', 96],
  ['public/apple-touch-icon.png', 180],
  ['public/icon-192.png', 192],
  ['public/favicon.png', 512],
  ['public/icon-512.png', 512],
]);

const expectedBySize = new Map();
for (const size of new Set(pngAssets.values())) expectedBySize.set(size, await renderPng(size));
for (const [path, size] of pngAssets) {
  check(existsSync(path), `${path} is missing.`);
  if (!existsSync(path)) continue;
  const actual = await readFile(path);
  const metadata = await sharp(actual).metadata();
  check(metadata.width === size && metadata.height === size, `${path} must be ${size}x${size}.`);
  check(hash(actual) === hash(expectedBySize.get(size)), `${path} is not the deterministic derivative of root favicon.png.`);
}

check(existsSync('public/favicon.ico'), 'public/favicon.ico is missing.');
if (existsSync('public/favicon.ico')) {
  const ico = await readFile('public/favicon.ico');
  const count = ico.readUInt16LE(4);
  const expectedSizes = [16, 32, 48];
  check(count === expectedSizes.length, 'favicon.ico must contain 16, 32, and 48 pixel frames.');
  for (let index = 0; index < Math.min(count, expectedSizes.length); index += 1) {
    const entry = 6 + (16 * index);
    const declaredSize = ico.readUInt8(entry) || 256;
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    const frame = ico.subarray(offset, offset + length);
    const metadata = await sharp(frame).metadata();
    check(declaredSize === expectedSizes[index], `favicon.ico frame ${index + 1} has the wrong declared size.`);
    check(metadata.width === declaredSize && metadata.height === declaredSize, `favicon.ico frame ${index + 1} has invalid dimensions.`);
    check(hash(frame) === hash(expectedBySize.get(declaredSize)), `favicon.ico frame ${declaredSize} is not derived from root favicon.png.`);
  }
}

check(!existsSync('public/favicon.svg'), 'The obsolete public/favicon.svg must not return.');
check(!existsSync('public/reddit-avatar.svg'), 'The obsolete document-logo social SVG must not return.');
const socialAvatar = await sharp(await readFile('public/reddit-avatar.png')).metadata();
check(socialAvatar.width === 512 && socialAvatar.height === 512 && socialAvatar.hasAlpha, 'Social avatar must preserve the approved 512px app icon.');
const ogImage = await sharp(await readFile('public/og-image.png')).metadata();
check(ogImage.width === 1200 && ogImage.height === 630, 'Open Graph image must be the canonical 1200x630 brand image.');

const manifest = JSON.parse(await readText('public/site.webmanifest'));
check(manifest.name === 'SoraFiles', 'Manifest name must be SoraFiles.');
check(manifest.short_name === 'SoraFiles', 'Manifest short_name must be SoraFiles.');
check(Array.isArray(manifest.icons) && manifest.icons.length === 2, 'Manifest must contain exactly the 192 and 512 icons.');
for (const [src, sizes] of [['/icon-192.png', '192x192'], ['/icon-512.png', '512x512']]) {
  const icon = manifest.icons?.find((item) => item.src === src);
  check(icon?.sizes === sizes && icon?.type === 'image/png' && icon?.purpose === 'any', `Manifest entry ${src} is invalid.`);
}
check(!(manifest.icons ?? []).some((item) => String(item.purpose).includes('maskable')), 'Official icons are not approved as maskable.');

const layoutSource = await readText('src/layouts/Layout.astro');
check(layoutSource.includes('PERMANENT SORAFILES SEARCH BRANDING INVARIANT'), 'Central branding invariant comment is missing.');
check(!layoutSource.includes('/favicon.svg'), 'Layout must not reference the obsolete SVG favicon.');

const html = await readText('dist/index.html');
const iconTags = [...html.matchAll(/<link[^>]+rel=["']icon["'][^>]*>/gi)].map((match) => match[0]);
const iconHrefs = iconTags.map((tag) => tag.match(/href=["']([^"']+)["']/i)?.[1]).filter(Boolean);
const requiredHrefs = ['/favicon-48x48.png', '/favicon-96x96.png', '/favicon.png', '/favicon.ico'];
check(iconHrefs.length === requiredHrefs.length, `Homepage must have exactly ${requiredHrefs.length} complementary rel=icon declarations.`);
check(new Set(iconHrefs).size === iconHrefs.length, 'Homepage has duplicate rel=icon declarations.');
for (const href of requiredHrefs) check(iconHrefs.includes(href), `Homepage is missing ${href}.`);
check(/<link[^>]+rel=["']apple-touch-icon["'][^>]+sizes=["']180x180["'][^>]+href=["']\/apple-touch-icon\.png["']/i.test(html), 'Homepage Apple touch icon is invalid.');
check(/<title>SoraFiles\b/i.test(html), 'Homepage title must begin with SoraFiles.');
check(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']SoraFiles["']/i.test(html), 'og:site_name must be SoraFiles.');
check(/<meta[^>]+name=["']application-name["'][^>]+content=["']SoraFiles["']/i.test(html), 'application-name must be SoraFiles.');
check(/<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/sorafiles\.com\/["']/i.test(html), 'Homepage canonical URL is missing.');
check(/<link[^>]+hreflang=["']x-default["'][^>]+href=["']https:\/\/sorafiles\.com\/["']/i.test(html), 'Homepage x-default is missing.');
check(!html.includes('/favicon.svg'), 'Built homepage references the obsolete SVG favicon.');
check(!html.includes('Sora Files') && !html.includes('Sora-Files'), 'Built homepage must use the exact SoraFiles brand spelling.');

const schemas = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  .flatMap((match) => {
    const value = JSON.parse(match[1]);
    return Array.isArray(value?.['@graph']) ? value['@graph'] : [value];
  });
const websites = schemas.filter((item) => item?.['@type'] === 'WebSite');
const organizations = schemas.filter((item) => item?.['@type'] === 'Organization');
check(websites.length === 1 && websites[0].name === 'SoraFiles', 'Homepage must contain one WebSite named SoraFiles.');
check(websites[0]?.alternateName === undefined, 'WebSite must not expose an alternate product name.');
check(organizations.length === 1 && organizations[0].name === 'Sora Labs', 'Homepage must contain one Organization named Sora Labs.');
check(websites[0]?.publisher?.['@id'] === 'https://sorafiles.com/#organization', 'WebSite publisher must reference Sora Labs.');
const applications = schemas.filter((item) => ['WebApplication', 'SoftwareApplication'].includes(item?.['@type']));
check(applications.length <= 1, 'Homepage must not publish competing application entities.');
check(applications.every((item) => item.name === 'SoraFiles'), 'Application schema must use the exact SoraFiles product name.');
check(applications.every((item) => item.alternateName === undefined), 'Application schema must not expose an alternate product name.');
check(!applications.some((item) => item.review || item.aggregateRating), 'Application schema must not manufacture review-gated rating or review evidence.');

const localizedHtml = await readText('dist/ja/index.html');
const localizedCanonical = new URL(localizedPath('ja', '/'), 'https://sorafiles.com').toString();
check(/<title>[^<]*SoraFiles/i.test(localizedHtml), 'Representative localized title must use SoraFiles.');
check(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']SoraFiles["']/i.test(localizedHtml), 'Representative localized og:site_name must use SoraFiles.');
check(localizedHtml.includes(`<link rel="canonical" href="${localizedCanonical}">`), 'Representative localized canonical URL is missing.');
check(/<link[^>]+hreflang=["']x-default["'][^>]+href=["']https:\/\/sorafiles\.com\/["']/i.test(localizedHtml), 'Representative localized x-default is missing.');

const robots = (await readText('public/robots.txt')).replaceAll('\r\n', '\n');
check(robots.includes('User-agent: *\nAllow: /'), 'robots.txt must keep the homepage and static assets crawlable.');
check(robots.includes('User-agent: Googlebot-Image\nAllow: /'), 'robots.txt must allow Googlebot-Image.');
check(robots.includes('Sitemap: https://sorafiles.com/sitemap.xml'), 'robots.txt must reference the authoritative sitemap.xml URL.');
check(existsSync('dist/sitemap.xml'), 'dist/sitemap.xml is missing.');
check(!existsSync('dist/sitemap-index.xml'), 'dist/sitemap-index.xml must not return.');

if (failures.length > 0) {
  console.error(`Search branding verification failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('Search branding verification passed: approved V10 favicon derivatives, SoraFiles site identity, Sora Labs organization identity, and multilingual crawl signals are intact.');
