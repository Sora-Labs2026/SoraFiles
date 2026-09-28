# SoraFiles V10 integration audit

## Authority and boundaries

### 27 September owner correction — strict frontend copy

The owner rejected retained legacy homepage content and requires the website frontend to copy the supplied prototype exactly, with no added or omitted sections. This supersedes the earlier adaptations below. `AGENTS.md` records the rule. Existing engines and service connections remain authoritative. Desktop has no supplied app prototype: its frontend should use the website design language, with backend and working connections preserved.

The homepage extra processing steps, workflow explanations and FAQ were removed. Exact privacy/promo sections, registry labels/icons, header/footer, search behavior and hero result copy are now connected. A local reference runs from the original prototype source at port4397; production preview stays on port4395. The homepage parity test passed for light/dark at1440 and390 pixels, checking section/card copy, search results, scene copy and main panel dimensions. This is bounded homepage evidence, not a claim that every page is pixel-identical.

Current website correction is still in progress for tool workspaces, Desktop public pages, guides/contact and remaining visual details. Informational pages and the tools directory are being ported to original component markup/CSS. The last complete production gate passed before these latest two page-family changes; repeat before deployment.

Desktop changes in this correction are presentation only: distinct prototype tool icons replace generic icons. Full Desktop renderer QA and16 compact-card checks passed. No engine, license, payment or IPC logic changed in this correction.

CI36261569188 at1f7fcd7 passed Windows, both macOS architectures and Linux. These packages precede subsequent frontend corrections and must not be described as final frontend packages. Public downloads remain0.1.0 until a final immutable0.1.1 publication is verified.

The owner-supplied `sorafiles-tools-desktop-subpages-prototype-launchit-inspired-v2.zip` is the locked visual reference. SHA-256: `a86b9565f9666a7ec6826dd59d34e2436064bcb8e768e98fe5be8cc93dc09e0f`.
The production Astro/TypeScript tool engines and native Rust/JavaScript contracts remain the functional source. No prototype processing or checkout stubs were imported. Existing legal wording and translations are retained.

## Component mapping

| Prototype | Production integration | Status |
| --- | --- | --- |
| Semantic tokens, atmosphere | v10-tokens.css, v10-atmosphere.css, Layout.astro | Imported exact palette/radii/type, route-family atmosphere |
| Brand assets | public/brand, deterministic icon generator | Exact handoff artwork; generated existing platform sizes |
| PageShell | Layout, Header, Footer | Real navigation/languages, system theme with saved overrides |
| HomeHero / ProductWindow | LocalizedHome / HeroVisualization | Search-first layout, real tools, four controllable scenes, visibility/focus/reduced-motion pause |
| ToolsPage / ToolPage | LiveToolsHub / LocalizedToolPage / v10-workspaces.css | Search/filter directory and full-width existing processing workbench |
| InfoPage / ContactPage | LiveInfoPage | Readable document columns/TOC; real form retained |
| Desktop pages | DesktopLayout and desktop routes | Two plan cards, real checkout, manifest downloads, checksum disclosure, help/releases |
| Desktop demonstration | desktop/_Workflow.astro | Illustrative file selection/menu/processing/output with controls |
| Guides | guides data, GuideBody, guide routes | Six Desktop guides added; absent publication dates omitted |
| Desktop app | desktop/ui token and component layers | Neutral utility shell and compact quick-action card; real handlers preserved |

## Functional changes and preserved behavior

- V10 supersedes the previous Windows installation-start trial policy. Fresh trials now begin at first app launch on every OS. Existing deadlines are preserved.
- Direct native actions remain silent; actions needing options use the compact window. Full app expansion is explicit.
- License identity, device binding, verification, replacement authorization and exact fee consent remain unchanged. Unlock PDF stays web-only.
- All 26 browser tools retain their real routes and engines. Compression safety and dimension-preservation controls remain.
- Six live checkout targets remain unchanged. Sensitive purchase/redemption page protections remain.
- No payment, DNS, email sender or merchant configuration changed during this UI pass.

## Deliberate adaptations

- Astro and native architecture retained instead of importing the prototype's CRA app.
- Existing localized content preserved. English homepage uses the approved category labels; other locales retain reviewed translated category labels.
- Tool card descriptions retain production capability wording where prototype claims differ.
- Public download metadata remains 0.1.0. A local version bump is not evidence that 0.1.1 packages are published.

## Verification ledger

- Astro check: 166 files, zero errors/warnings/hints after integration.
- Browser shell: 52 route/theme/viewport combinations; no overflow or JavaScript errors; real links, search/filter, preview, billing toggle and theme persistence passed. Evidence: `.artifacts/v10-shell.log` and `.artifacts/v10-review/report.json`.
- Desktop renderer: 38 full UI checks, 16 compact UI checks, replacement flow and 6 license-host tests passed. See v10-desktop-progress.md.
- Real browser engine flows: 71 passing checks in `.artifacts/v10-tool-flows.log`, including all 26 route smoke checks, document outputs, image/text watermarking, signing, Office conversions, image conversion/compression, PDF compression and malformed-file recovery. Shared styles had collapsed radio controls; the minimum-size/flex fix restored image-watermark selection and its output checks passed.
- That combined run stopped at an obsolete editor test selector: canvas editing intentionally hides the generic selected-file list. The test now waits for the editor preview. The focused extra-tools rerun has nine passing checks in `.artifacts/v10-extra-flows.log`: edited image dimensions/format, protect/unlock/repair, metadata removal, Excel/PDF conversions, OCR text and searchable PDF. This is combined evidence across two runs, not a claim that the original combined run completed successfully.
- Remaining dedicated browser flows now passed against the V10 preview: resize-image generated 320×180 outputs at 320/390/1024/1440 widths and passed cancellation; doc-scanner passed opt-in crop/drag handles, draft recovery, retake, filter, JPG/PNG ZIP/two-page PDF exports and no non-GET/HEAD requests. Evidence: `.artifacts/v10-chapter3.log`. These are website responsive checks, not mobile Desktop app support.
- Standalone remove-background produced a decodable RGBA PNG with transparent pixels (`.artifacts/v10-background.log`). Dedicated heic-to-jpg produced a valid 1280×854 JPEG with no uploads or page errors (`.artifacts/v10-heic-route.log`; `tests/e2e/heic-route.mjs`). All 26 public tool routes now have processing evidence across the focused runs. These fixtures establish regression coverage, not exhaustive quality across arbitrary customer files or every browser/OS.
- Full production build passed: 649 routes, content truth, positioning, i18n (19 languages × 33 routes), built SEO, approved branding, advertising-free checks, 29 OCR asset hashes and optimizer contracts. Evidence: `.artifacts/v10-build.log`.
- Unit suite: 119 passed, zero failed/skipped. Evidence: `.artifacts/v10-unit.log`.
- OCR static asset newline/hash drift detected in this checkout; regenerated from pinned installed packages using the existing sync script.
- Native Windows compile check passed (`check --locked`), using the existing shared toolchain. Evidence: `.artifacts/v10-native-check.log`. Full local Rust tests and Windows packaging stopped with disk-space errors during compilation; they are not passing test/build results. Evidence: `.artifacts/v10-native-tests.log` and `.artifacts/v10-windows-package.log`.
- Remote CI [36256280892](https://github.com/Sora-Labs2026/SoraFiles/actions/runs/36256280892), source `b48d3495dddc1b85cfdf6c0c63338822880a9710`: macOS ARM, macOS Intel and Linux matrix jobs passed; Windows built and uploaded a candidate but failed **Verify Windows resource staging**. The overall run failed. Windows failure diagnosis and candidate verification remain release gates; upload alone is not release approval.
- Follow-up source `1f7fcd7` corrects the obsolete Windows verification assertion that still required installation-time trial initialization. The assertion now enforces the first-launch policy. CI [36261569188](https://github.com/Sora-Labs2026/SoraFiles/actions/runs/36261569188) was started for this correction; its final result must be recorded before publication.
- Native View release notes now opens the fixed public release-notes page; the stale “No releases published” response was removed. This is a navigation correction, not an automatic updater.
- Prototype source/docs and supplied screenshots inspected; no claim of a locally running CRA reference.

## Remaining release gates

Confirm the corrected Windows resource-staging gate and verify final package checksums and installed native behavior. Browser fake-bridge tests do not prove OS integration, first-launch trial behavior or silent/compact native actions in the final installed packages. Successful CI targets still need their publication checks.

Publish new immutable 0.1.1 artifacts for all supported targets and update download metadata only after verification. The current V10 website changes are local until an explicit deployment and live verification are recorded. This audit does not certify a new deployment or paid-card payment processing.
