<!-- adversarial-ux-start -->
## Adversarial UI/UX review — 2026-09-10

Tools-directory feedback: replaced the oversized green banner with a semantic two-item list, using the existing privacy icons, independent labels, a subtle divider and natural wrapping. The two benefits no longer run together. Desktop/mobile, light/dark and narrow French/Arabic layout checks are recorded separately.

Latest homepage feedback: “See How It Works” now scrolls to the on-device section, with deferred layout resolved before navigation. The WebAssembly callout and source-inspection CTA were removed; offline and background-loading messages use plain language across 19 locales. Required license attribution remains on the Open Source page. The featured badge was removed at the user’s final request. The subtle creator credit remains. Desktop, narrow mobile, French and Arabic homepage checks cover the scroll destination, absence of the featured badge, and footer layout.

Hero feedback: replaced the ambiguous document-shaped symbol beside On Your Device with the same lock used in the trust row. The red Document.pdf tile now uses a clear PDF label. Both were checked in the rendered hero. The six Guides and hub passed 14 desktop/narrow-screen reading cases, including bounded scrollable tables, visible heading anchors, schema, links and published tool relationships.

This review gives workflow placement and discoverability separate evidence from engine correctness. All 26 tools completed arrival → file selection → configuration → processing → result inspection → download → reset on desktop and mobile. Journey screenshots and control geometry were recorded at each stage. Result contact sheets for all tools were visually reviewed, with full-size inspection of discovered friction and changed screens. No numerical UX score was assigned.

Final coverage: 26/26 desktop journeys, 26/26 mobile journeys; 52/52 additional long-filename/dark/reduced-motion checks at desktop 1440×900 and constrained 320×500. The short viewport probes reachability with reduced space; it is not a physical mobile keyboard or thumb-reach measurement. Frame settling was added to avoid reporting animation timing as a stale result or covered button.

| Tool | Concrete review / fix |
|---|---|
| Compress PDF | Strength and preserved-content guidance are grouped; preview/options tabs and result download remain distinct. Reset verified after the closing transition. |
| Merge PDF | Page reorder/duplicate/remove actions now wrap instead of hiding beyond a horizontal edge; 44px mobile targets. Adjust displays the page preview. |
| Split PDF | Custom groups and pages-per-file fields appear only for the selected split mode; no irrelevant settings in the default flow. |
| Rotate PDF | Page selection stays on Pages; Adjust now displays the affected page rather than duplicating the page rail. Duplicate mobile history controls removed. |
| Remove Pages | Page range stays beside the preview; page selection and output summary remain separate. No selected-state ambiguity was inferred from the range-based test. |
| PDF to JPG | Resolution, output format, page range and quality are grouped; result download is separate and reachable. |
| JPG to PDF | Mobile file cards put reorder/rotate/remove controls on a second row, preserving filename space and touch target size. |
| PDF to Word | Visible editable/appearance choices explain the result before conversion; output limitations remain beside the result download. |
| Word to PDF | Removed the empty Options journey; file and conversion action share one view. Desktop uses a compact surface. Mobile regression caught and corrected during retest. |
| Watermark PDF | Mobile Adjust retains the actual page and watermark preview above its settings; page rail no longer occupies that space. |
| Page Numbers | Mobile Adjust retains the actual page preview above numbering settings; final download remains reachable. |
| Sign PDF | Placement hint is constrained to its preview instead of covering mobile panel navigation. Signature upload/type/draw and result guidance retained. |
| Image Converter | Format/quality controls remain beside preview on desktop and in labeled mobile tabs; JPEG 2000 decoding and stale-file generations fixed. |
| Compress Image | Preview/options split remains; result download and before/after imagery stay together. Core strength setting is visible. |
| HEIC to JPG | Source and before previews now use decoded pixels rather than a HEIC blob unsupported by the browser. Copy describes conversion to JPG. |
| Edit Image | Desktop preview and independently scrolling settings are now side by side. Preview remains visible when changing adjustments and inspecting the result. |
| Remove Background | Explicit Original/Transparent result mobile controls replace the undiscoverable swipe-only comparison. Completion selects the result and puts download beside it. Tabs corrected to normal height after visual retest. |
| Protect PDF | Password/permission options remain grouped in a compact dialog; result action follows processing. Long filename and dark/narrow viewport checks pass. |
| Unlock PDF | File/password requirements precede processing; result and another-file action are adjacent. No new placement change was justified. |
| Repair PDF | Compact file/action/result flow retained, with recovery limitations attached to the output rather than a separate screen. |
| Metadata Remover | Detailed checkboxes appear only after choosing selective PDF details; default removal no longer exposes inactive choices. |
| PDF to Excel | Editable-table versus visual output is explicit before processing; result download remains beside its fidelity explanation. |
| Excel to PDF | Simple file-to-PDF flow retained; worker cancellation and retry now release the runtime. No extra settings/navigation added. |
| PDF OCR | Language/output requirements remain grouped before OCR; progress/cancel and result download stay in the same workspace. |
| Resize Image | Desktop preview remains alongside the independently scrolling dimension/crop controls. Mobile retains its preview above adjustments. |
| Doc Scanner | Page list, corner editor, preview, save format and output remain in their existing panels; mobile save/download proximity retained. Perspective output independently verified. |

Shared fixes: closing a workspace no longer restarts the page entrance animation; mobile history/zoom/close buttons are at least 44px; core SoraFiles tokens, typography, theme and native control styles were retained. Controls were not moved for visual novelty.

Footer: added exactly “Made with ❤️ by Drishya Thapa” as subtle secondary meta text. Only the name links to https://x.com/Dri_shy_a, with target="_blank" and rel="noopener noreferrer". Six checks passed (1440/390/320 × light/dark), including keyboard focus, wrapping and no horizontal overflow. Footer screenshots were visually inspected.

Evidence: tests/e2e/ux-journey.mjs with complex-quality-audit.mjs; tests/e2e/ux-stress.mjs; tests/e2e/footer-credit.mjs; ignored .artifacts/astra-ux-final-*/journeys, astra-ux-stress/results.json and astra-footer/results.json. All changed tools were rerun on both viewports with real exported outputs; independent validation is reported in the release section.

<!-- adversarial-ux-end -->

# SoraFiles deployed release validation — 2026-09-10

Deployed to https://sorafiles.com on 2026-09-10T15:13:57.837Z. Cloudflare version: `b803ace9-c222-4795-a156-09f707f793d3`. The user explicitly authorized deployment. This section supersedes the pre-release report below; its former “remaining” implementation items are resolved as described here. Six commissioned English Guides were published; see docs/guides-first-batch-review.md for scope and source review.

## Release and live verification

- Production build SHA-256: home `e7c6964517985a19460358e069357416ae81722b3e8433203c636c37c5ded574`; sitemap `50ab5a12a7d8ac098c7dc13d47b01c1b70d4d1a10dee33ff08298e6a5cc07a8d`. The existing uncommitted worktree was deployed directly; no commit or push was made.
- True final build: PASS, 636 generated pages; 634 canonical indexable routes. The six Guides and their populated hub are indexable. Metadata, canonicals, hreflang, schema, robots, guide publication gates, branding, OCR assets and optimizer checks pass.
- Astro diagnostics: PASS, 152 files, zero errors/warnings/hints. Unit tests: PASS, 110/110. Cloudflare packaging dry run: PASS; production deployment: PASS.
- Post-deployment crawl: 2/2 discovered public hosts checked, 634/634 canonical URLs crawled, 634 total URL fetches; 0 broken internal links, 0 internal links to redirects, 0 crawl/indexability errors.
- Actual deployed production tool benchmark: PASS, 26/26 desktop and 26/26 mobile using the same complex corpus described below. Independent output checks: PASS, 52/52. Functional evidence includes deployed Office isolation headers and background model proxy behavior.
- Six English Guides and their populated hub: PASS, 14/14 live desktop/narrow-screen reading checks; 20 internal link destinations return 200; 22/22 references return 200. Article/Breadcrumb data, canonical/indexability, publication dates, table scrolling, heading positioning and related-tool discovery were checked. The latest icon fixes were visually inspected and verified live.
- Search submission (2026-09-10T15:15:08.255Z): 634 canonical URLs. indexnow: accepted (HTTP 200); google-search-console: skipped (credentials-not-configured); bing-webmaster: skipped (api-key-not-configured). Acceptance confirms receipt, not indexing or rankings.
- Production benchmark network traces record processing requests and WebSockets; the passing tests require only GET/HEAD requests and no uncaught page errors. This covers browser-visible processing traffic, not every possible network side channel.
- The existing anonymous popularity event deliberately skips automated browsers, so this benchmark does not exercise that normal-use POST. Source review confirms the event contains only the tool identifier and success event; filenames, file contents and outputs are not included. The privacy page discloses this aggregate counting.

## Remaining defects resolved

- Production background-worker startup: the isolated page had a worker response without the matching embedder policy. Browser diagnostics recorded ERR_BLOCKED_BY_RESPONSE before inference. Added the required policy to the dedicated background worker response; a synthetic image exported successfully when the header was applied during diagnosis. A regression test checks the policy and ensures ordinary scripts remain unchanged.
- Office cancellation: each conversion owns a hidden browsing context. Cancellation, timeout and completion remove it and terminate its dedicated WASM workers. Both Writer and Calc tests observed workers start, close after cancellation, and successfully export on immediate retry. No stale downloads appeared. Final local conversion checks also applied the production CSP.
- Image converter: JPEG 2000 now uses the installed PDF.js/OpenJPEG decoder in a bounded dedicated worker. Gray, gray-alpha, RGB and RGBA output layouts are normalized to RGBA. Invalid files and 32MP limits reject before creating an output. TIFF/PSD declared dimensions are checked before decoding. Generation guards and decoder termination prevent old uploads/results resurfacing after replacement or reset.
- Format matrix: PASS, 18/18 cases: JPG, PNG, WebP, BMP, GIF, AVIF, TIFF, multipage TIFF, animated GIF, ICO, SVG, PSD and JP2; plus five corrupt variants. All 13 valid exports independently decode with Pillow and preserve the known colored region. TIFF uses the first page, GIF the first frame, PSD the flattened composite. This is representative variant coverage, not every possible encoding.
- Scanner geometry: real UI corner dragging on a known perspective image, PNG export, then independent marker detection. Maximum error was 4.90px desktop and 4.80px mobile (0.535% and 0.522% of the longest output dimension); both pass the declared 1.5% tolerance.
- Background removal: added optional “Clean solid background”, off by default, with descriptions and review guidance in all 19 locales. It derives a color key only from a nearly uniform opaque border and confident foreground colors. Matching background pixels and explainable blended edge pixels are refined at original resolution in bounded strips. Textured borders and pretransparent images keep the base mask. Because subject/background color can be ambiguous, the visible option warns that matching subject colors may disappear.

## Background cleanup evidence

Same eight synthetic fixtures, original 1600×1000 dimensions; values compare the new optional cleanup with the earlier base-mask results below. These are controlled synthetic measurements, not photographic portrait quality scores. The formerly retained logo opening is now transparent; dark/cyan composites were visually reviewed. Existing alpha increased at zero pixels in both pretransparent cases.

| Fixture | Alpha IoU | Alpha MAE | Edge MAE |
|---|---:|---:|---:|
| hair | 1 | 0.002 | 0.0261 |
| product | 1 | 0 | 0 |
| thin | 1 | 0 | 0 |
| logo | 1 | 0 | 0 |
| signature | 1 | 0 | 0 |
| soft | 0.9575 | 0.0109 | 0.0567 |
| soft-alpha | 0.991 | 0.0074 | 0.0357 |
| logo-alpha | 0.9999 | 0.0008 | 0.0198 |

Hair edge MAE fell from 0.0763 to 0.0261; logo IoU rose from 0.8688 to 1.0000 on this corpus. The default model still has difficult-edge limitations on some files. The optional cleanup does not claim universal hair/translucency reconstruction.

## Evidence and external limits

- Reproduction: tests/e2e/image-format-matrix.mjs; tests/e2e/office-cancellation.mjs; tests/e2e/scanner-perspective.mjs; scripts/verify-release-images.py; SORA_BG_CLEANUP=1 with background-ground-truth.mjs and background-ground-truth.py; SORA_BASE_URL=https://sorafiles.com and SORA_QA_PREFIX=astra-production with complex-quality-audit.mjs and verify-complex-outputs.py; scripts/crawl-public.mjs https://sorafiles.com.
- Browser scope: Edge desktop and mobile/touch emulation. WebKit and Firefox installation was attempted twice, including extended 180-second connection timeouts; distribution downloads failed. Physical Safari/iOS/Android and broad photographic matting quality remain unverified. No skipped registered tool in the Edge benchmark.
- Local workerd previously crashed on this Windows host; packaging/deployment and actual production browser tests now validate the deployed edge behavior. Certificate-transparency discovery and the supplied X design reference remained inaccessible.
- Current OCR searchable-PDF export remains limited to restricted Latin text encoding with nonaligned hidden text. This is explicitly disclosed in the new OCR Guide; TXT output and result inspection are recommended where applicable. Legacy translated visual-only Word explanations require translation review; the English page now explains both actual output modes.
- Earlier offline, keyboard/focus, reduced-motion and performance findings below remain scoped to their stated tests. No full-device or universal fidelity claim is made.
- Ahrefs recognition, warning counts, GEO/AI visibility, ranking and DR require a fresh external crawl. Deployment alone does not establish changes in those metrics.

<!-- pre-release-audit -->

# SoraFiles tool quality validation — 2026-09-10

This current audit supersedes the historical results below. PASS refers to the stated test contract; it does not mean every file, format, option or device has been exhaustively proven. No deployment, search submission, article publication or external metric change was performed.

## Environment and scope

- Tested repository HEAD: `8385e8c2cf76975d58670ec91cfa4b73d3575575`, branch main, with existing uncommitted user work plus this implementation. This is not a clean commit/release attestation. Existing work and earlier reports were preserved.
- Windows, Node 24.19.0, Astro 7.2; Edge 152.0.4191.66 via Playwright. Desktop 1440×1000; mobile 390×844 with touch/mobile emulation. Mobile emulation is not an iOS/Safari or physical low-memory-device test.
- Live production was crawled read-only as a baseline. Functional outputs were tested against the local Astro production preview at 127.0.0.1:4321. Preview adds COOP/COEP needed by Office. The Cloudflare local runtime crashed with Windows access violation 0xc0000005; deployed edge behavior was not emulated successfully.
- Final production build was run after all application fixes, including the final broken-badge correction. The complete tool benchmark was rerun after the processing fixes; the final subsequent change only replaced the external footer badge with a text link. Final HTML crawl and Guides visual checks were rerun after that change.
- Build fingerprints: home SHA-256 `197031f641a06d7854880f87b729d0d0d25b9e30752c9713015623431b00ff31`; sitemap SHA-256 `a1cbdf5ec0e8a8cc143889750a3a87d982ca7603f68baaab964dd8ba88b179a6`.

## Coverage gate

| Check | Result |
|---|---|
| First-party hosts discovered / tested | 2 / 2: sorafiles.com and www.sorafiles.com |
| Live canonical indexable URLs discovered / crawled | 627 / 627 |
| Live URL fetches | 629; includes discovery/nonindexable checks |
| Final local canonical URLs discovered / crawled | 627 / 627 |
| Final local URL fetches | 628: 627 indexable plus empty Guides hub |
| Distinct registered tools | 26 |
| Desktop functional / mobile functional | 26 / 26 each |
| Complex or challenging representative fixture / independent output validation | 26 / 26 each; 52 desktop/mobile result sets |
| Processing network inspection | 26 / 26 on both viewports |
| Empty-file rejection, valid-file recovery, Tab and Escape | 26 / 26 at 390px |
| Additional session checks | 8 / 8 |

Host discovery used the deployed route configuration, crawl links/canonicals, and public search. These revealed only the apex and www; www returned 301 to the apex. Certificate-transparency discovery at https://crt.sh/?q=%25.sorafiles.com&output=json was unavailable. This is not an assertion that undisclosed hosts cannot exist. No subdomain brute-force scan was performed.

Both crawls found zero broken internal links, links to redirects, or sitemap/indexability mismatches in their discovered sets. Built checks additionally validate unique metadata, canonical and hreflang reciprocity/targets, robots and visible JSON-LD facts across all generated pages. No production redirect defect was reproduced or claimed fixed. Googlebot, bingbot, GPTBot, OAI-SearchBot and ChatGPT-User header probes returned 200 on the live homepage; these do not simulate crawler IP reputation or prove indexing.

## Per-tool benchmark and claim contracts

All rows have PASS for desktop, mobile, independent parsing/decoding, and the shared boundary test. The evidence column states what was actually checked.

| Tool | Desktop | Mobile | Independent evidence |
|---|---|---|---|
| Compress PDF | PASS | PASS | every expected native page marker appears on its correct page; mixed page dimensions preserved; PDF: 36 pages, 30143 text characters |
| Merge PDF | PASS | PASS | every expected native page marker appears on its correct page; mixed page dimensions preserved; PDF: 48 pages, 36254 text characters |
| Split PDF | PASS | PASS | exactly the 3 selected pages in ZIP |
| Rotate PDF | PASS | PASS | every expected native page marker appears on its correct page; PDF: 36 pages, 30143 text characters |
| Remove Pages | PASS | PASS | every expected native page marker appears on its correct page; mixed page dimensions preserved; PDF: 35 pages, 29318 text characters |
| PDF to JPG | PASS | PASS | all 36 page JPEGs independently decode with nonuniform pixels |
| JPG to PDF | PASS | PASS | PDF: 2 pages, 1 text characters |
| PDF to Word | PASS | PASS | all 36 source-page markers in DOCX document body/tables |
| Word to PDF | PASS | PASS | all 8 sections and final table cell survived; PDF: 16 pages, 6631 text characters |
| Watermark PDF | PASS | PASS | every expected native page marker appears on its correct page; mixed page dimensions preserved; PDF: 36 pages, 31043 text characters |
| Page Numbers | PASS | PASS | every expected native page marker appears on its correct page; mixed page dimensions preserved; PDF: 36 pages, 30638 text characters |
| Sign PDF | PASS | PASS | every expected native page marker appears on its correct page; mixed page dimensions preserved; PDF: 36 pages, 30143 text characters |
| Image Converter | PASS | PASS | WEBP: independently decoded 2400x1600 |
| Compress Image | PASS | PASS | JPEG: independently decoded 2400x1600 |
| HEIC to JPG | PASS | PASS | JPEG: independently decoded 1280x854 |
| Edit Image | PASS | PASS | WEBP: independently decoded 1600x2400 |
| Remove Background | PASS | PASS | PNG: independently decoded 1600x1000 |
| Protect PDF | PASS | PASS | every expected native page marker appears on its correct page; mixed page dimensions preserved; PDF: 36 pages, 30143 text characters |
| Unlock PDF | PASS | PASS | every expected native page marker appears on its correct page; mixed page dimensions preserved; PDF: 36 pages, 30143 text characters |
| Repair PDF | PASS | PASS | every expected native page marker appears on its correct page; mixed page dimensions preserved; PDF: 36 pages, 30143 text characters |
| Metadata Remover | PASS | PASS | every expected native page marker appears on its correct page; mixed page dimensions preserved; PDF: 36 pages, 30143 text characters |
| PDF to Excel | PASS | PASS | all 300 distinct table-row identifiers in editable cells |
| Excel to PDF | PASS | PASS | last row and computed value from all 3 source sheets survive; PDF: 9 pages, 11036 text characters |
| PDF OCR | PASS | PASS | known OCR numbers independently extractable; PDF: 2 pages, 103 text characters |
| Resize Image | PASS | PASS | JPEG: independently decoded 1200x800 |
| Doc Scanner | PASS | PASS | PDF: 4 pages, 3 text characters |

Corpus: mixed 36-page native PDFs with portrait/landscape/variable sizes, known text on every page, images, URL annotations, bookmarks and metadata; a 48-page merge; AES-256 protected copy; 12 table pages with 300 unique rows; an 8-section DOCX with tables and pictures; a 3-sheet, 100-row-per-sheet XLSX with formulas and Unicode; 2400×1600 detailed raster; real repository-permitted libheif HEIC; soft/transparent images; two image-only OCR pages with known numbers and skew; a four-page synthetic photo scanner run; 36MP boundary raster; zero-byte and corrupt signatures. Fixtures and downloads remain ignored under .artifacts. Synthetic signatures and passwords were used exclusively.

Independent validators: pypdf for page count/order/rotation/dimensions/text/metadata/encryption, PDFium for first/last-page rendering, python-docx and openpyxl for editable Office content, Python ZIP CRC checks and Pillow/NumPy for actual image decoding/alpha/pixel differences. All 36 JPG page exports decode independently. The comprehensive output reader also identified the two old all-transparent background files from pre-fix runs; those are historical failures, not final passing outputs.

Additional UI option runs covered PDF reorder, split selection, rotate undo/redo/zoom, watermark text/image drag/resize, numbering, saved synthetic signatures, image conversion directions, compression strengths, crop/resize, wrong passwords, metadata and OCR PDF/TXT. They do not cover every combination of every option.

## Background-removal benchmark

The worker uses a bounded 1024-square letterboxed inference image, crops the mask back to the source aspect, preserves original output dimensions and multiplies existing source alpha. Worker termination cancels inference and releases the session. GPU/CPU attempts have static-asset fallback, a compact CPU-model fallback, nonempty-mask validation and bounded waits. No remote image processing was introduced.

Masks below are synthetic geometric ground truth, not a photographic portrait dataset. IoU uses alpha ≥ 0.5; MAE compares normalized alpha, with a 9px morphology band for edge error. These metrics do not establish a universal quality percentage or quantify improvement over the prior production model.

| Fixture | Alpha IoU | Alpha MAE | Edge-band MAE | Technical result |
|---|---:|---:|---:|---|
| hair | 0.9886 | 0.0065 | 0.0763 | TECHNICAL PASS |
| product | 0.9991 | 0.0022 | 0.0962 | TECHNICAL PASS |
| thin | 0.9004 | 0.0018 | 0.0878 | TECHNICAL PASS |
| logo | 0.8688 | 0.0185 | 0.1602 | TECHNICAL PASS |
| signature | 0.8512 | 0.0024 | 0.093 | TECHNICAL PASS |
| soft | 0.9481 | 0.0186 | 0.0936 | TECHNICAL PASS |
| soft-alpha | 0.991 | 0.0074 | 0.0357 | TECHNICAL PASS |
| logo-alpha | 0.9999 | 0.0008 | 0.0198 | TECHNICAL PASS |

All eight outputs kept 1600×1000 dimensions. Existing alpha increased at zero pixels in the two pretransparent cases. White, dark and cyan composites were produced; visual review found retained background inside the opaque logo opening and light fringes around thin strands. This remains a quality limitation. English copy now tells users to review hair, thin lines, openings and result edges. Other localized background marketing copy has not had an equivalent expert language/quality review.

## Defects fixed and public-claim verification

- Guides: empty typed registry, static English-only publishing gate, escaped content blocks, title/query/canonical collision validation, overlap warnings, real tool references, dates/assets/headings, Article/Breadcrumb metadata, hub/noindex and absent draft/localized-placeholder routes. No articles or invented keyword metrics were added.
- SEO/content operations: tool descriptions use complete existing localized sentences; IndexNow uses the real canonical registry, filters aliases/private/noindex/unknown URLs, deduplicates/batches, and treats 202 as pending key validation. GSC CSV parser and ignored local storage preserve missing metrics and never invent query/page joins. llms.txt links factual open-source/repository identity.
- Blank background downloads: rejected empty masks and added compact CPU fallback. Original dimensions and preexisting transparency are validated; cancellation terminates the worker and suppresses stale results. Invalid replacements clear the previous result.
- Hidden errors: ExtraToolWorkbench invalid-file errors were inside a closed workspace. They now appear outside it until an editor is open. Background initial-upload errors have the same correction. Processing generations prevent late results after replacement/reset; OCR reset/reopen is tested.
- Mobile toolbar: undo/redo/zoom controls were hidden at small widths. They now occupy a visible second header row. Background removal omits unsupported history/zoom controls. Tabs/disclosures are opened through real UI controls in the tests.
- Office: bounded initialization, cancellation while waiting for the engine, document close in finally, and generic error messages rather than upstream document-derived exception payloads. Ongoing synchronous Office work is not proven to terminate immediately after cancellation.
- Compression copy: English image-compression descriptions/FAQ advertised removed Auto/target-KB modes. They now describe the actual strength slider, retained dimensions and original-file retention. Exact size targets are not promised.
- Offline: page and static caches now have separate bounds; responses are cloned before asynchronous cache opening. Uncached routes no longer substitute home content. The offline banner and feature detail in all 19 locales state that uncached engines/models require a connection.
- Visual footer: a failed third-party badge image is now a plain existing-site link. Native SoraFiles shell/tokens retained; DESIGN.md replaces an unrelated imported Vercel extraction.

Network observations across the 52 complex runs contain only GET/HEAD requests: no processing POST, WebSocket, password, synthetic filename or known document-text marker appeared in captured URLs. Static engines/models are downloaded; local operation does not mean zero network traffic. No third-party request bodies or user-file contents were stored. Context-level request monitoring covered page/worker requests; this is not an OS-level packet capture or proof against every possible side channel.

Offline: a previously visited rotate route was explicitly service-worker registered in local HTTP QA (the production registration requires HTTPS), warmed, reloaded with the context offline, and exported a separately validated three-page PDF. This establishes that cached workflow, not full offline support for all tools. Blocked background assets yielded a visible error; cancellation/replacement did not expose stale downloads; 4GB simulated memory rejected a 36MP image with the 12MP limit; the compressor rejected that image at its 32MP limit. A run with Navigator.prototype.gpu removed exercised CPU-only fallback.

## Performance, motion and accessibility

Latest measurement: 2026-09-10T01:49:50.285Z. Local production preview, Edge/Chromium, 4× CPU slowdown, 80ms latency, 4Mbps download, third-party requests blocked. This is one laboratory sample per scenario, not field Core Web Vitals or a browser/device population.

| Scenario | LCP ms | CLS | Initial transfer bytes | Overflow |
|---|---:|---:|---:|---|
| mobile-home | 2021 | 0 | 108970 | No |
| mobile-tool | 1385 | 0 | 104057 | No |
| desktop-home | 1951 | 0 | 108970 | No |
| desktop-rtl-tool | 2896 | 0 | 130978 | No |

Warnings: desktop-rtl-tool: LCP is above the 2500ms good-experience target. Hard failures: none. An earlier concurrent sample measured desktop-home LCP at 2806ms; no universal loading-speed improvement is claimed.

At 390px, every tool recovered after an invalid file, kept Tab focus in its opened workspace and handled Escape by closing or presenting discard. Reduced-motion emulation found zero running nontrivial animations on the home page and no overflow. PDF/scanner/signature/editor screenshots were reviewed, including mobile Guides and background composites. Full WCAG certification, screen-reader announcements across all 19 languages, every dark/light combination and physical iOS/Android testing were not performed.

## Validation and reproduction

Run the build before tests that read dist, and do not rebuild while browser crawls are running. Production preview must be available at 127.0.0.1:4321 with the configured isolation headers. Node tests use the installed Edge channel; Python checks use the available PDF/image/Office libraries.

| Check | Result | Reproduce / evidence |
|---|---|---|
| Production build after application fixes | PASS | node scripts/build-production.mjs; .artifacts/astra-final-build.log |
| Types/templates | PASS, 147 files / 0 errors | node node_modules/astro/bin/astro.mjs check |
| Unit and validator tests | PASS, 105 / 105 | node scripts/run-unit-tests.mjs |
| Guide validation / hub / absent drafts / escaped block rendering | PASS | node scripts/validate-guides.mjs; node tests/e2e/guides-shell.mjs; node tests/e2e/guide-template.mjs |
| Metadata / canonicals / schema / sitemap / robots / hreflang | PASS | production-build validators; final local crawl |
| IndexNow canonical filtering and protocol errors | PASS | unit tests; node tests/e2e/indexnow-protocol.mjs (all fetches mocked); no external submission |
| Full route crawl | PASS | node scripts/crawl-public.mjs https://sorafiles.com; node scripts/crawl-public.mjs http://127.0.0.1:4321 |
| All-tool complex desktop/mobile | PASS, 26 / 26 each | node tests/e2e/complex-quality-audit.mjs; repeat with SORA_QA_MOBILE=1 |
| Independent complex output validation | PASS, 52 / 52 | python scripts/verify-complex-outputs.py |
| Broader independent parse/render history | Historical failures retained | python scripts/independent-output-check.py |
| Boundary/recovery/focus | PASS, 26 / 26 | node tests/e2e/boundary-quality-audit.mjs |
| Offline / cancellation / failures / limits / reduced motion | PASS, 8 / 8 | node tests/e2e/session-quality-audit.mjs |
| Background mask metrics | TECHNICAL PASS; fidelity limitations above | node tests/e2e/background-ground-truth.mjs; python scripts/background-ground-truth.py |
| Source diff whitespace | PASS | git diff --check; no staging, commit, push or deploy |

Generate the ignored corpus with tests/fixtures/generate-complex.py and tests/fixtures/generate-sorafiles-qa.mjs. The preexisting real-UI audit generates the additional controlled OCR raster. Final detailed JSON/logs and screenshots live under ignored .artifacts/astra-*; no benchmark binaries were added to public routes or committed.

## Remaining limits and release interpretation

The discovered-route and every-tool representative functional coverage gates pass. Exhaustive file-format/option/fidelity coverage remains PARTIAL: not every advertised converter format (for example PSD/JP2/TIFF variants), pathological Office layout, malformed format, translated interaction, device memory condition or browser engine was exercised. Scanner perspective was manipulated through the UI and its multi-page output validated, but quantitative homography/reprojection error was not measured. Background photographic hair, reflections and translucent subjects need broader evidence; the synthetic logo-opening/fringe defects above remain. There is no justified “perfect quality” or general “100% validated” claim.

Cloudflare local worker execution and real Safari/iOS/Android tests are unverified environment coverage. The source and Astro preview pass, but no deployed production change was tested. Certificate-transparency discovery was unavailable. Office cancellation can suppress delivery while underlying synchronous work finishes. The provided X design-reference post was inaccessible (403; exact-ID search did not recover it), so no instructions or attribution were invented from it.

Future approved Guide content still requires editorial review; infrastructure intentionally contains zero articles. Guides-related keyword volumes, difficulty, CTR opportunities and query/page pairs were not fabricated. Mock IndexNow success/error responses are protocol tests only.

Ahrefs follow-up requires a fresh third-party crawl after a separate authorized deployment: internal redirect-link warnings, IndexNow recognition, AI-crawler warnings, metadata counts, GEO/AI visibility and DR. No expected score, ranking, traffic or authority change is stated.

Implementation references: [IMG.LY installed API documentation](https://github.com/imgly/background-removal-js/blob/main/packages/web/README.md), [IndexNow protocol](https://www.indexnow.org/documentation). Guides/editorial documentation: docs/guides-system.md and docs/content-editorial-policy.md.

<!-- historical-verification-report -->

# Sora Files tool verification report

## Test environment

- Date: 2026-08-11
- Browser: installed Microsoft Edge, controlled headlessly with Playwright
- App target: Astro production build served by Astro preview in background mode
- Validation rule: downloaded files are reopened with an independent parser or decoder

## PDF to Word

### Basic two-page text PDF

- Fixture: `tests/fixtures/text-two-page.pdf`, generated with pdf-lib
- Result before changes: PASS
- Download: valid DOCX package
- Independent inspection: Mammoth extracted both `Sora Files page one` and `Sora Files page two`

### External CMap PDF

- Fixture: `tests/fixtures/mozilla-cmap-gbkp-euc-h.pdf`
- Provenance: Mozilla PDF.js test corpus, `test/pdfs/issue3521.pdf`
- Expected text: `我们都是黑体字`
- Result before changes: FAIL
- Visible status: `No selectable text was found. Scanned PDFs need OCR, which is not available locally yet.`
- Browser evidence: PDF.js logged `Ensure that the cMapUrl API parameter is provided.`
- Root cause: the shared PDF.js loader configured a worker and a WASM path, but did not configure or deploy packed CMaps. PDFs whose fonts rely on an external CMap therefore appeared to contain no selectable text.

### Repair hypothesis

Deploy the packed CMaps from the installed `pdfjs-dist` version and pass their URL to `getDocument`. The same failing browser test must then produce a valid DOCX containing the expected Chinese text.

### Repair result

- Packed CMaps deployed under `/pdfjs/cmaps/`: 169 files, 1,167,747 bytes
- Loader now passes `cMapUrl` and `cMapPacked: true`
- External CMap fixture after repair: PASS; valid DOCX independently reopened with the expected Chinese text
- Basic two-page fixture regression: PASS
- Blank-page/no-OCR recovery: PASS; no download is exposed

## Document action matrix

| Tool | Download inspected | Independent result |
| --- | --- | --- |
| Merge PDF | `merged-sora-files.pdf` | PASS: valid PDF, 2 input files, 2 output pages |
| Split PDF | `text-two-page-pages.zip` | PASS: valid ZIP, 2 numbered PDFs, 1 valid page in each |
| Rotate PDF | `text-two-page-rotated.pdf` | PASS: valid 2-page PDF, every page rotated 90 degrees |
| JPG to PDF | `images-sora-files.pdf` | PASS: valid 1-page PDF with positive page dimensions |
| PDF to JPG | `text-two-page-jpg.zip` | PASS: valid ZIP, 2 numbered JPGs, both decoded with positive dimensions |
| PDF to Word | `text-two-page.docx` | PASS: valid DOCX with both expected page strings |
| Word to PDF | `single-paragraph.pdf` | PASS: valid PDF; PDF.js independently extracted `Walking on imported air` |

All seven document routes also rejected extension-matching files with invalid magic bytes and exposed no result download.

## All-in-one image converter

| Flow | Download inspected | Independent result |
| --- | --- | --- |
| JPG to PNG | `sample-converted.png` | PASS: PNG signature; decoded at 960 × 540 |
| JPG to WebP | `sample-converted.webp` | PASS: RIFF/WebP signature; decoded at 960 × 540 |
| JPG to JPG | `sample-converted.jpg` | PASS: JPEG signature; decoded at 960 × 540 |
| HEIC to JPG | `libheif-example-converted.jpg` | PASS: JPEG signature; decoded at 1280 × 854 |

Corrupt HEIC, unknown binary, camera RAW, and INDD inputs were rejected with format-specific recovery text and no result. The visible format claims remain aligned with actual behavior: RAW and INDD are explained as unsupported; JPEG 2000 remains explicitly browser-dependent.

## Compress and resize images

| Mode/input | Result | Independent inspection |
| --- | --- | --- |
| Auto JPG | 87.9 KB → 59.5 KB (32% smaller) | PASS: decoded output; exceeds the promised 20% minimum saving |
| Target 40 KB WebP | 87.9 KB → 38.6 KB | PASS: under the 38.8 KB safety-margin target |
| Reduce by 25% WebP | 87.9 KB → 65.6 KB | PASS: reduction is based on source bytes |
| Target selected from PNG Auto | 1.26 MB → 240 KB | PASS: control immediately switches to target-capable WebP |
| Auto opaque PNG | 1.26 MB → 802 KB (37% smaller) | PASS: valid opaque PNG, resized only after full-size encoding was insufficient |
| Auto transparent PNG | 1.36 MB → 1.00 MB (26% smaller) | PASS: valid PNG with transparent pixels preserved |
| HEIC through HEIC route | 718 KB → 495 KB (31% smaller) | PASS: valid JPG decoded independently |

The previously reported “Auto made the file larger” and weak PNG behavior do not reproduce in the current engine. Regression tests now fail if Auto presents a result above 80% of the source for these representative fixtures, or if PNG transparency is lost.

## Compress PDF

- Rasterization acknowledgement: PASS; processing does not start until the user confirms that text, links, forms, signatures, bookmarks, and accessibility structure will be flattened.
- Image-heavy three-page PDF: PASS; 1.37 MB → 403 KB (71% smaller), valid three-page output, then rendered through PDF-to-JPG and independently decoded.
- Efficient two-page text PDF: PASS; valid two-page output, clearly labeled larger than the original, recommends keeping the original, and independent extraction confirms the flattened result has no selectable text.
- JPEG 2000 page: PASS after decoder repair; valid output with zero `/pdfjs/wasm/` 404 responses.
- Invalid signature, corrupt PDF body, and password-protected PDF: PASS; clear recovery text and no stale result.

### JPEG 2000 decoder repair

The first JPEG 2000 run completed only after 404 responses for `openjpeg.wasm` and `openjpeg_nowasm_fallback.js`. The installed PDF.js decoder files are now deployed under `/pdfjs/wasm/`; the same browser test passes without failed asset requests.
