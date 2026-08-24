import {
  POPULARITY_LIMIT,
  POPULARITY_MINIMUM_EVENTS,
  POPULARITY_SIGNAL_WEIGHTS,
} from './config.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function percentileScores(entries) {
  const positive = entries
    .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
    .sort((a, b) => a.value - b.value || a.id.localeCompare(b.id));
  if (!positive.length) return new Map(entries.map(({ id }) => [id, 0]));

  const scores = new Map(entries.map(({ id }) => [id, 0]));
  for (let start = 0; start < positive.length;) {
    let end = start;
    while (end + 1 < positive.length && positive[end + 1].value === positive[start].value) end += 1;
    const averageRank = ((start + end) / 2) + 1;
    const score = positive.length === 1 ? 1 : (averageRank - 1) / (positive.length - 1);
    for (let index = start; index <= end; index += 1) scores.set(positive[index].id, score);
    start = end + 1;
  }
  return scores;
}

const toSignalMap = (value) => value instanceof Map
  ? value
  : new Map(Object.entries(value || {}).map(([id, score]) => [id, Number(score) || 0]));

const parseList = (value) => [...new Set(String(value || '').split(',').map((item) => item.trim()).filter(Boolean))];

export function createBootstrapRanking(toolIds, bootstrapIds, now = new Date()) {
  const published = [...new Set(toolIds)];
  const publishedSet = new Set(published);
  const tools = [...new Set([...bootstrapIds, ...published])]
    .filter((id) => publishedSet.has(id))
    .slice(0, POPULARITY_LIMIT);
  return {
    version: 1,
    generatedAt: now.toISOString(),
    mode: 'bootstrap',
    tools,
    activeToolCount: published.length,
    observedSuccesses30: 0,
    windows: { days7: 0, days30: 0, days90: 0 },
    providers: { searchConsole: 'unconfigured', marketDemand: 'unconfigured' },
  };
}

export function computePopularityRanking({
  toolIds,
  bootstrapIds,
  usage = [],
  searchConsole = null,
  marketDemand = null,
  previousTools = [],
  mode = 'dynamic',
  pin = '',
  exclude = '',
  minimumEvents = POPULARITY_MINIMUM_EVENTS,
  now = new Date(),
}) {
  const published = [...new Set(toolIds)];
  const publishedSet = new Set(published);
  const excluded = new Set(parseList(exclude).filter((id) => publishedSet.has(id)));
  const eligible = published.filter((id) => !excluded.has(id));
  const pinned = parseList(pin).filter((id) => eligible.includes(id)).slice(0, POPULARITY_LIMIT);
  const usageMap = new Map(usage.map((entry) => [entry.id, {
    success7: Math.max(0, Number(entry.success7) || 0),
    success30: Math.max(0, Number(entry.success30) || 0),
    success90: Math.max(0, Number(entry.success90) || 0),
  }]));
  const stats = eligible.map((id) => ({ id, ...(usageMap.get(id) || { success7: 0, success30: 0, success90: 0 }) }));
  const observedSuccesses30 = stats.reduce((sum, entry) => sum + entry.success30, 0);
  const forceBootstrap = mode !== 'dynamic' || observedSuccesses30 < minimumEvents;

  if (forceBootstrap) {
    const fallback = createBootstrapRanking(eligible, bootstrapIds, now);
    fallback.tools = [...new Set([...pinned, ...fallback.tools])].slice(0, POPULARITY_LIMIT);
    fallback.activeToolCount = published.length;
    fallback.observedSuccesses30 = observedSuccesses30;
    fallback.windows = {
      days7: stats.reduce((sum, entry) => sum + entry.success7, 0),
      days30: observedSuccesses30,
      days90: stats.reduce((sum, entry) => sum + entry.success90, 0),
    };
    fallback.mode = mode === 'dynamic' ? 'bootstrap' : 'manual-bootstrap';
    return fallback;
  }

  const normalized = {
    success7: percentileScores(stats.map(({ id, success7 }) => ({ id, value: success7 }))),
    success30: percentileScores(stats.map(({ id, success30 }) => ({ id, value: success30 }))),
  };
  const external = {
    searchConsole: searchConsole === null ? null : percentileScores(eligible.map((id) => ({ id, value: toSignalMap(searchConsole).get(id) || 0 }))),
    marketDemand: marketDemand === null ? null : percentileScores(eligible.map((id) => ({ id, value: toSignalMap(marketDemand).get(id) || 0 }))),
  };
  const activeWeights = Object.entries(POPULARITY_SIGNAL_WEIGHTS)
    .filter(([key]) => key in normalized || external[key] !== null);
  const weightTotal = activeWeights.reduce((sum, [, weight]) => sum + weight, 0);
  const bootstrapIndex = new Map(bootstrapIds.map((id, index) => [id, index]));
  const previousIndex = new Map(previousTools.map((id, index) => [id, index]));
  const registryIndex = new Map(published.map((id, index) => [id, index]));

  const ranked = stats.map((entry) => {
    let score = 0;
    for (const [key, weight] of activeWeights) {
      const signal = normalized[key] || external[key];
      score += (signal?.get(entry.id) || 0) * (weight / weightTotal);
    }
    // A bounded neutral prior prevents a newly published zero-data tool from
    // being permanently buried without overpowering any measured demand.
    if (entry.success30 === 0) score += 0.02;
    // Tiny hysteresis only resolves near-ties; it cannot defeat real demand.
    const priorPosition = previousIndex.get(entry.id);
    if (priorPosition !== undefined) score += clamp((POPULARITY_LIMIT - priorPosition) * 0.0001, 0, 0.001);
    return { ...entry, score };
  }).sort((a, b) =>
    b.score - a.score
    || b.success7 - a.success7
    || b.success30 - a.success30
    || (bootstrapIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (bootstrapIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    || (registryIndex.get(a.id) ?? 0) - (registryIndex.get(b.id) ?? 0)
    || a.id.localeCompare(b.id));

  return {
    version: 1,
    generatedAt: now.toISOString(),
    mode: 'dynamic',
    tools: [...new Set([...pinned, ...ranked.map(({ id }) => id)])].slice(0, POPULARITY_LIMIT),
    activeToolCount: published.length,
    observedSuccesses30,
    windows: {
      days7: stats.reduce((sum, entry) => sum + entry.success7, 0),
      days30: observedSuccesses30,
      days90: stats.reduce((sum, entry) => sum + entry.success90, 0),
    },
    providers: {
      searchConsole: searchConsole === null ? 'unconfigured' : 'active',
      marketDemand: marketDemand === null ? 'unconfigured' : 'active',
    },
  };
}
