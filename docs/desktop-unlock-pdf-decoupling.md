# Desktop Unlock PDF decoupling — September 17, 2026

Unlock PDF is intentionally excluded from SoraFiles Desktop and Dodo-powered paid
offerings for payment-provider compliance. Free Web remains independent.

| Boundary | Implementation and evidence |
| --- | --- |
| Registry/UI/search | `desktop/shared/tool-policy.mjs` allowlists 25 IDs. Generated `tool-metadata.json` contains eligible metadata only. Search, All Tools, selection suggestions and shared shell-menu definitions derive from it. |
| Processing | `JobQueue.add` and job start enforce the allowlist even if a host injects an excluded engine. Native Node adapter also checks it. Rust IPC keeps its strict implemented-tool allowlist; native launch accepts only literal file selections, no tool deep links. |
| License/trial/promo | Signer and verifier permit only `features: ['process']`; this cannot override product eligibility. Tests cover trial, all six plans and all eight promo variants, including correctly signed legacy tokens with excluded feature IDs. |
| Dodo | Local product verifier rejects excluded public feature names/metadata. No dashboard access or changes; exact live product, checkout/receipt and entitlement copy still requires authorized inspection. |
| Marketing | Desktop pages and popup contain no excluded capability. Old Windows image displayed “All 26 tools”; removed from overview, retained as historical asset. Existing original 3:4 SVG is explicitly labeled a concept. No fake OS screenshot created. |
| Dependencies | Desktop processing dependency closure does not include the free Web unlock engine or `@pdfsmaller/pdf-decrypt`. Internal audit retains Web dependency records with explicit product availability. |
| Shell platforms | Shared menus exclude the capability. Current installed Explorer/Finder/Linux integration is not certified; no claim of native-platform PASS. Direct processing and reserved CLI/deep-link inputs are refused. |
| Free Web | Existing 26-tool Web registry, route, engine and dependency preserved. No tool-page Desktop upsell existed. Built Web route and synthetic known-password output regression run separately. |

Tests: `desktop/tests/tool-policy.test.mjs`, `catalog.test.mjs`, UI QA, full Desktop
suite, and `web-unlock-qa.mjs`. Current results and any remaining gates are recorded
in `desktop-implementation-status.md`; historical screenshots and old reports are
not current evidence. No production deploy, Dodo product mutation, license issuance
or customer transaction was performed.
