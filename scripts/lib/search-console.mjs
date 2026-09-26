// RFC 4180-style parser: quoted commas/newlines/escaped quotes; fail on malformed rows.
export function parseCsv(source) {
  source = source.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; } else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw new Error(`Malformed CSV quote at character ${i}`);
      quoted = true;
    } else if (c === ',' || c === '\r' || c === '\n') {
      row.push(cell); cell = ''; closed = false;
      if (c !== ',') { if (c === '\r' && source[i + 1] === '\n') i++; if (row.some(v => v !== '')) rows.push(row); row = []; }
    } else { if (closed) throw new Error(`Unexpected text after quoted field at character ${i}`); cell += c; }
  }
  if (quoted) throw new Error('Unterminated CSV quote');
  if (cell || row.length || closed) { row.push(cell); rows.push(row); }
  if (rows.length < 1 || rows[0].some(v => !v.trim())) throw new Error('CSV needs a nonempty header');
  if (rows.some(row => row.length !== rows[0].length)) throw new Error('CSV rows have inconsistent column counts');
  return rows;
}
const normalize = v => v.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const headers = { query: ['query', 'queries', 'top queries', 'search query'], page: ['page', 'pages', 'top pages', 'landing page', 'url'], clicks: ['clicks', 'total clicks'], impressions: ['impressions', 'total impressions'], ctr: ['ctr', 'average ctr'], position: ['position', 'average position', 'avg. position'] };
export function importSearchConsole(source) {
  const [header, ...rows] = parseCsv(source);
  const normalized = header.map(normalize);
  if (new Set(normalized).size !== header.length) throw new Error('Duplicate CSV headers');
  const mapping = Object.fromEntries(Object.entries(headers).map(([key, aliases]) => [key, normalized.findIndex(h => aliases.includes(h))]));
  if (mapping.query < 0 && mapping.page < 0) throw new Error('CSV requires query or landing-page column');
  if (mapping.clicks < 0 || mapping.impressions < 0) throw new Error('CSV requires clicks and impressions columns');
  return rows.map((row, i) => {
    const get = key => mapping[key] < 0 || row[mapping[key]].trim() === '' ? null : row[mapping[key]].trim();
    const number = key => {
      const raw = get(key); if (raw === null) return null;
      const value = raw.replaceAll(',', '');
      if (!/^\d+(?:\.\d+)?%?$/.test(value) || (value.endsWith('%') && key !== 'ctr')) throw new Error(`Invalid ${key} on CSV row ${i + 2}`);
      const n = Number(value.replace('%', '')) / (value.endsWith('%') ? 100 : 1);
      if (!Number.isFinite(n) || ((key === 'clicks' || key === 'impressions') && !Number.isInteger(n)) || (key === 'ctr' && n > 1)) throw new Error(`Out-of-range ${key} on CSV row ${i + 2}`);
      return n;
    };
    return { query: get('query'), page: get('page'), clicks: number('clicks'), impressions: number('impressions'), ctr: number('ctr'), averagePosition: number('position') };
  });
}
export function analyzeSearchConsole(rows, { knownQueries = [], canonicalUrls = [], minimumImpressions = 100, maximumClicks = 5 } = {}) {
  const known = new Set(knownQueries.map(normalize)), canonical = new Set(canonicalUrls), queryPages = new Map();
  for (const row of rows) if (row.query && row.page && canonical.has(row.page)) {
    const key = normalize(row.query), pages = queryPages.get(key) ?? new Set(); pages.add(row.page); queryPages.set(key, pages);
  }
  return {
    thresholds: { minimumImpressions, maximumClicks, note: 'Configurable triage thresholds, not CTR benchmarks.' },
    opportunities: rows.filter(r => r.impressions !== null && r.clicks !== null && r.impressions >= minimumImpressions && r.clicks <= maximumClicks),
    unexpectedQueries: known.size ? [...new Set(rows.filter(r => r.query && !known.has(normalize(r.query))).map(r => r.query))] : [],
    possibleCannibalization: [...queryPages].filter(([, pages]) => pages.size > 1).map(([query, pages]) => ({ query, canonicalPages: [...pages] })),
    limitations: 'Query-only and page-only exports cannot establish query/page relationships. No cross-product joins are inferred. Noncanonical landing pages require review.',
  };
}
