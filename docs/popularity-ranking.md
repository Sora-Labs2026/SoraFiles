# Popular Tools ranking

The homepage displays exactly 10 tools from the canonical `liveTools` registry. All published tools remain available through homepage search, `/preview`, direct routes, localized routes, and the sitemap.

## Data and privacy

The browser emits one first-party `tool_process_success` event only when a real workbench result becomes ready. Its JSON body contains exactly `tool` and `event`. Production-only guards disable emission on localhost, preview origins, WebDriver, and marked E2E pages. The Worker validates the canonical origin, same-site fetch metadata, content type, a 192-character body ceiling, the exact two-key schema, the event name, and the canonical tool allowlist. Known automated user agents and verified bots are ignored.

Cloudflare D1 stores only daily success totals by tool identifier. It does not store file names, file sizes, contents, outputs, hashes, IP addresses, user-agent strings, cookies, or persistent user identifiers. Daily rows older than 120 days are deleted by the scheduled job.

## Ranking

The scheduled Worker runs daily at 03:17 UTC. It builds 7-, 30-, and 90-day success windows from aggregate rows, computes a deterministic outlier-resistant percentile score, writes one cached top-10 object, and prunes expired rows. Runtime homepage requests read only that cached object; they never aggregate raw event rows.

Active signal weights are:

- successful processing, 7 days: 45%
- successful processing, 30 days: 20%
- Search Console demand: 20% when safely configured
- authorized market-demand data: 15% when safely configured

Missing providers are omitted and the remaining weights are renormalized. Search Console and market-demand adapters are currently `unconfigured` because no safe server-side credentials/provider were found; browser sessions, cookies, and UI scraping are never used. A bounded 0.02 neutral prior prevents zero-data tools from being permanently buried, and a tiny near-tie hysteresis reduces daily churn without overriding measured demand.

Until 100 successful events exist in the last 30 days, a deterministic 10-tool bootstrap order is used without fabricated counts. New registry tools automatically enter the published allowlist and remain searchable/catalogued; the generator fills any missing bootstrap slot from registry order.

## Owner controls and diagnostics

Cloudflare environment values provide a small operational control surface:

- `POPULARITY_MODE=dynamic` enables measured ranking; any other value holds the bootstrap.
- `POPULARITY_PIN` is a comma-separated allowlisted sequence placed first.
- `POPULARITY_EXCLUDE` is a comma-separated allowlisted exclusion sequence.

The safe aggregate endpoint `GET /__sf/popularity/ranking` exposes the same visible top 10 plus mode, update time, aggregate window totals, active tool count, and provider status. It is cacheable for five minutes, marked noindex, and contains no user data. `npm run popularity:status` queries the owner D1 state through authenticated Wrangler access.

Run `npm run generate:popularity` whenever registry metadata changes. Production builds run it automatically and content validation fails if the generated registry differs from `liveTools`.
