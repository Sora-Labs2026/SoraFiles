import { readFile } from 'node:fs/promises';

const host = 'sorafiles.com';
const key = 'fc1b21d84d0549ba9d2ab3bea5dc3845';
const keyLocation = `https://${host}/${key}.txt`;
const sitemap = await readFile(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>(https:\/\/sorafiles\.com\/[^<]*)<\/loc>/g)].map((match) => match[1]);

if (urlList.length === 0) throw new Error('IndexNow submission stopped because the built sitemap contains no canonical URLs.');

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation, urlList }),
});

if (!response.ok) {
  const detail = await response.text();
  throw new Error(`IndexNow returned ${response.status}${detail ? `: ${detail}` : ''}`);
}

console.log(`IndexNow accepted ${urlList.length} canonical URLs.`);
