import { createSign } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { publishedLocales, localizedRoutePaths } from '../src/i18n/config.ts';

const siteUrl = 'https://sorafiles.com/';
const sitemapUrl = 'https://sorafiles.com/sitemap.xml';
const indexNowKey = 'fc1b21d84d0549ba9d2ab3bea5dc3845';
const indexNowKeyLocation = `${siteUrl}${indexNowKey}.txt`;
const expectedUrlCount = publishedLocales.length * localizedRoutePaths.length;
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const liveSitemap = args.includes('--live');
const strict = args.includes('--strict');
const indexNowOnly = args.includes('--indexnow-only');
const listSitesOnly = args.includes('--list-sites');
const sitemapStatusOnly = args.includes('--sitemap-status');
const submitSitemapOnly = args.includes('--submit-sitemap');
const inspectIndex = args.indexOf('--inspect-url');
const inspectionUrl = inspectIndex >= 0 ? args[inspectIndex + 1] : null;
const indexNowEndpointIndex = args.indexOf('--indexnow-endpoint');
const indexNowEndpoint = indexNowEndpointIndex >= 0 ? args[indexNowEndpointIndex + 1] : 'https://api.indexnow.org/indexnow';
const allowedIndexNowEndpoints = new Set(['https://api.indexnow.org/indexnow', 'https://www.bing.com/indexnow']);
const googleOnly = listSitesOnly || sitemapStatusOnly || submitSitemapOnly || Boolean(inspectionUrl);
const receiptPath = new URL('../.artifacts/search-submission-receipt.json', import.meta.url);

if (inspectIndex >= 0 && !inspectionUrl) throw new Error('--inspect-url requires a canonical sitemap URL.');
if (!allowedIndexNowEndpoints.has(indexNowEndpoint)) throw new Error('--indexnow-endpoint must be the IndexNow global or Bing endpoint.');

const receipt = {
  schemaVersion: 2,
  recordedAt: new Date().toISOString(),
  sitemapUrl,
  canonicalUrlCount: 0,
  mode: dryRun ? 'dry-run' : 'submit',
  operations: [],
};
const failures = [];

const record = (provider, status, details = {}) => receipt.operations.push({ provider, status, ...details });

async function request(url, init, label) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}.`);
  return response;
}

function locations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].replaceAll('&amp;', '&'));
}

async function sitemapXml() {
  if (!liveSitemap || dryRun) return readFile(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
  return (await request(sitemapUrl, { headers: { 'user-agent': 'SoraFiles-Search-Signals/3.0' } }, 'Live sitemap')).text();
}

function validateCanonicalUrls(xml) {
  const urls = locations(xml);
  const unique = new Set(urls);
  if (urls.length !== expectedUrlCount || unique.size !== expectedUrlCount) {
    throw new Error(`Search submission requires ${expectedUrlCount} unique sitemap URLs; found ${urls.length}/${unique.size}.`);
  }
  for (const value of unique) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'sorafiles.com' || url.search || url.hash) throw new Error(`Noncanonical sitemap URL rejected: ${value}`);
  }
  return [...unique];
}

async function runOperation(provider, operation) {
  try {
    await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${provider}: ${message}`);
    record(provider, 'failed', { message });
  }
}

async function validateIndexNowKey() {
  const content = liveSitemap && !dryRun
    ? await (await request(indexNowKeyLocation, { headers: { 'user-agent': 'SoraFiles-Search-Signals/3.0' } }, 'IndexNow key file')).text()
    : await readFile(new URL(`../public/${indexNowKey}.txt`, import.meta.url), 'utf8');
  if (content !== indexNowKey && content !== `${indexNowKey}\n`) throw new Error('IndexNow key file content does not exactly match the configured key.');
}

async function submitIndexNow(urlList) {
  await validateIndexNowKey();
  if (dryRun) {
    record('indexnow', 'planned', { urlCount: urlList.length, keyLocation: indexNowKeyLocation });
    return;
  }
  const response = await request(indexNowEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: 'sorafiles.com', key: indexNowKey, keyLocation: indexNowKeyLocation, urlList }),
  }, 'IndexNow');
  record('indexnow', 'accepted', { httpStatus: response.status, endpoint: indexNowEndpoint, urlCount: urlList.length, keyLocation: indexNowKeyLocation });
}

const base64url = (value) => Buffer.from(value).toString('base64url');

async function credentialFile() {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialPath) return null;
  let parsed;
  try {
    parsed = JSON.parse(await readFile(credentialPath, 'utf8'));
  } catch {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS could not be read as JSON.');
  }
  if (parsed.type === 'service_account' && parsed.client_email && parsed.private_key) {
    return { type: 'service-account', clientEmail: parsed.client_email, privateKey: parsed.private_key, tokenUri: parsed.token_uri || 'https://oauth2.googleapis.com/token' };
  }
  const oauth = parsed.installed || parsed.web;
  if (oauth?.client_id && oauth?.client_secret) return { type: 'oauth-client', clientId: oauth.client_id, clientSecret: oauth.client_secret };
  throw new Error('Google credential JSON is neither a supported service account nor OAuth client file.');
}

async function serviceAccountAccessToken(credential) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: credential.clientEmail,
    scope: 'https://www.googleapis.com/auth/webmasters',
    aud: credential.tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(credential.privateKey).toString('base64url')}`;
  const response = await request(credential.tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  }, 'Google service-account authentication');
  const result = await response.json();
  if (!result.access_token) throw new Error('Google service-account authentication returned no access token.');
  return result.access_token;
}

async function googleAccess() {
  if (process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN) return { token: process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN, credentialType: 'access-token' };
  const fileCredential = await credentialFile();
  if (fileCredential?.type === 'service-account') return { token: await serviceAccountAccessToken(fileCredential), credentialType: fileCredential.type };

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || fileCredential?.clientId;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || fileCredential?.clientSecret;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const supplied = [clientId, clientSecret, refreshToken].filter(Boolean).length;
  if (supplied === 0) return null;
  if (supplied !== 3) throw new Error('Google OAuth requires client ID, client secret, and refresh token together.');
  const response = await request('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  }, 'Google OAuth refresh');
  const result = await response.json();
  if (!result.access_token) throw new Error('Google OAuth refresh returned no access token.');
  return { token: result.access_token, credentialType: fileCredential?.type || 'oauth-environment' };
}

async function accessibleGoogleSites(token) {
  const response = await request('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { authorization: `Bearer ${token}` },
  }, 'Google Search Console site listing');
  const result = await response.json();
  return (result.siteEntry || []).map((entry) => ({ siteUrl: entry.siteUrl, permissionLevel: entry.permissionLevel }));
}

function selectGoogleProperty(sites) {
  const requested = process.env.GOOGLE_SEARCH_CONSOLE_PROPERTY;
  if (requested) {
    if (!sites.some(({ siteUrl: property }) => property === requested)) throw new Error(`Configured Search Console property is not accessible: ${requested}`);
    return requested;
  }
  for (const candidate of ['sc-domain:sorafiles.com', 'https://sorafiles.com/']) {
    if (sites.some(({ siteUrl: property }) => property === candidate)) return candidate;
  }
  throw new Error('No accessible sc-domain:sorafiles.com or https://sorafiles.com/ Search Console property was found.');
}

async function googleSitemapStatus(token, property) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
  const response = await request(endpoint, { headers: { authorization: `Bearer ${token}` } }, 'Google Search Console sitemap status');
  const status = await response.json();
  return {
    pending: Boolean(status.isPending),
    warnings: Number(status.warnings || 0),
    errors: Number(status.errors || 0),
    lastSubmitted: status.lastSubmitted || null,
    lastDownloaded: status.lastDownloaded || null,
  };
}

async function inspectGoogleUrl(token, property, url) {
  const response = await request('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ inspectionUrl: url, siteUrl: property, languageCode: 'en-US' }),
  }, 'Google URL Inspection');
  const result = await response.json();
  const index = result.inspectionResult?.indexStatusResult || {};
  return {
    url,
    verdict: index.verdict || null,
    coverageState: index.coverageState || null,
    robotsTxtState: index.robotsTxtState || null,
    indexingState: index.indexingState || null,
    googleCanonical: index.googleCanonical || null,
    userCanonical: index.userCanonical || null,
    lastCrawlTime: index.lastCrawlTime || null,
    referringUrls: index.referringUrls || [],
  };
}

async function runGoogleSearchConsole(canonicalUrls) {
  if (dryRun) {
    record('google-search-console', 'planned-or-skipped', { action: inspectionUrl ? 'inspect-url' : listSitesOnly ? 'list-sites' : sitemapStatusOnly ? 'read-sitemap' : 'submit-and-read-sitemap' });
    return;
  }
  const access = await googleAccess();
  if (!access) {
    record('google-search-console', 'skipped', { reason: 'credentials-not-configured', credentialType: 'unavailable' });
    return;
  }
  const sites = await accessibleGoogleSites(access.token);
  if (listSitesOnly) {
    record('google-search-console', 'accessible-sites', { credentialType: access.credentialType, sites });
    return;
  }
  const property = selectGoogleProperty(sites);
  if (inspectionUrl) {
    if (!canonicalUrls.includes(inspectionUrl)) throw new Error('URL Inspection is restricted to URLs in the validated canonical sitemap.');
    record('google-search-console', 'inspection-complete', { credentialType: access.credentialType, property, inspection: await inspectGoogleUrl(access.token, property, inspectionUrl) });
    return;
  }
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
  let submittedStatus = null;
  if (!sitemapStatusOnly) {
    const submitted = await request(endpoint, { method: 'PUT', headers: { authorization: `Bearer ${access.token}` } }, 'Google Search Console sitemap submission');
    submittedStatus = submitted.status;
  }
  record('google-search-console', sitemapStatusOnly ? 'status-read' : 'accepted', {
    credentialType: access.credentialType,
    property,
    httpStatus: submittedStatus,
    sitemap: await googleSitemapStatus(access.token, property),
  });
}

async function submitBingWebmaster() {
  if (dryRun) {
    record('bing-webmaster', 'planned-or-skipped', { action: 'submit-sitemap-feed' });
    return;
  }
  const apiKey = process.env.BING_WEBMASTER_API_KEY;
  if (!apiKey) {
    record('bing-webmaster', 'skipped', { reason: 'api-key-not-configured', indexNowActive: true });
    return;
  }
  const endpoint = `https://ssl.bing.com/webmaster/api.svc/json/SubmitFeed?apikey=${encodeURIComponent(apiKey)}`;
  const response = await request(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ siteUrl, feedUrl: sitemapUrl }),
  }, 'Bing Webmaster sitemap submission');
  record('bing-webmaster', 'accepted', { httpStatus: response.status });
}

const canonicalUrls = validateCanonicalUrls(await sitemapXml());
receipt.canonicalUrlCount = canonicalUrls.length;

if (!googleOnly) await runOperation('indexnow', () => submitIndexNow(canonicalUrls));
if (!indexNowOnly) await runOperation('google-search-console', () => runGoogleSearchConsole(canonicalUrls));
if (!indexNowOnly && !googleOnly) await runOperation('bing-webmaster', submitBingWebmaster);

await mkdir(new URL('../.artifacts/', import.meta.url), { recursive: true });
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');

if (failures.length) {
  const summary = `Search signal operation failed without retry:\n- ${failures.join('\n- ')}`;
  if (strict) throw new Error(summary);
  console.warn(summary);
}
console.log(`${dryRun ? 'Validated' : 'Processed'} ${canonicalUrls.length} canonical URLs; secret-free receipt written to .artifacts/search-submission-receipt.json.`);
