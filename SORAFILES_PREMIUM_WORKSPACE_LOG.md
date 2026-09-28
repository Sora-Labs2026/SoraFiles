# SoraFiles Premium Adaptive Workspace Log

Updated: 2026-08-29 (Asia/Kathmandu)

## Objective

Replace cramped post-upload tool forms with one reusable, local-first adaptive workspace system. The file remains the dominant surface; controls become contextual and responsive rather than forcing one layout onto every tool.

## Architecture decisions

- `src/components/AdaptiveWorkspace.astro` is the single shell for Canvas, Preview, and Quick modes.
- Desktop Canvas workspaces use a 92–96vw floating work surface with a dimmed/blurred page behind it. Preview mode is narrower. Quick mode is a compact sheet.
- Phones use a full-screen surface and Canvas mode exposes `Pages | File | Adjust` bottom navigation. Touch targets grow instead of squeezing desktop columns into the viewport.
- The shell owns focus trapping, focus restoration, Escape handling, reduced-motion transitions, scroll locking, contextual zoom/undo commands, and dirty-state discard confirmation.
- Crawlable tool pages, headings, descriptions, structured content, and existing upload cards remain in the page. The workspace opens only after a validated local file is selected.
- No server processing, telemetry payloads, or new file-upload path was introduced. Saved signatures continue to use browser-local storage only.
- Existing SoraFiles tokens and typography are retained. The premium signature is a quiet document work surface: paper-like file canvas, compact ink controls, restrained SoraFiles color for selection and the single primary action, and minimal border noise.

## Shared components and primitives

- `AdaptiveWorkspace.astro` — Canvas/Preview/Quick geometry, header, backdrop, mobile panels, result surface, discard protection, accessibility, and motion.
- `VisualPdfWorkspace.astro` — reusable PDF page rail, lazy thumbnails, selection shortcuts, page actions, large center canvas, live overlay layer, and Sign PDF transform surface.
- `src/lib/pdf/visual-workspace.ts` — PDF workspace model, capped meaningful history, lazy thumbnail rendering, active-page rendering, zoom/fit commands, page rotation/selection/reorder, and cleanup.

## Tool migrations

### Canvas mode

- Sign PDF — reference implementation with large PDF canvas; direct click placement; transform-based dragging; four touch-sized resize handles; keyboard movement; duplicate/delete; meaningful undo/redo; Type/Draw/Upload creation; uploaded-signature cleanup; local save/clear; selected-page application; multiple visible fields in export.
- Watermark PDF — shared page rail and large live preview; direct drag snaps to the supported page positions; direct resize updates real text/logo size; opacity/rotation/selection remain live and native PDF output is preserved.
- Page Numbers — shared page rail, live page overlay, and visual six-position picker.
- Merge, Split, Rotate, Remove Pages — shared rail/canvas with lazy thumbnails, active-page preview, selection, range shortcuts, non-drag reorder alternative, rotation, duplicate/remove where appropriate, and native page processing.
- JPG to PDF — Canvas shell with the existing image ordering/rotation/export logic.
- Edit Image, Resize Image, Remove Background, Doc Scanner — shared Canvas shell applied while retaining their existing local image canvases, crop/corner handles, checkerboards, filters, export logic, and memory guards.

### Preview mode

- Compress PDF, Compress Image, HEIC to JPG, Image Converter, PDF to JPG, PDF OCR, PDF to Excel, Word to PDF, Excel to PDF, and PDF to Word use the shared large-preview/clean-options surface where their current engine exposes a preview.

### Quick mode

- Protect PDF, Unlock PDF, Repair PDF, and Metadata Remover use the compact adaptive sheet rather than a giant canvas.

## Performance findings

- PDF rail thumbnails remain `IntersectionObserver`-lazy and low resolution.
- The center PDF canvas renders only the active page; thumbnail and main render tasks are cancelled during replacement/cleanup.
- Signature drag and resize use temporary CSS transforms and commit normalized geometry only on pointer release.
- Undo records final page/object actions, not pointer-move frames, and histories are capped at 30 snapshots.
- Existing object URL revocation, PDF.js cleanup, image bitmap closing, abort controllers, pixel limits, and local-worker paths remain intact.

## Mobile and accessibility findings

- Canvas workspaces become full-screen below 768px with bottom panel navigation and larger signature handles.
- Preview/Quick tools become full-screen sheets on small phones without horizontal page overflow.
- Workspace dialogs have names, modal semantics, trapped focus, restored focus, visible focus styles, safe Escape handling, and a discard confirmation only after edits.
- Page selection and signature manipulation have buttons/keyboard alternatives; state is communicated with text/check marks as well as color.

## Verification

- `astro check` in a temporary Node 22 mirror: 126 files, 0 errors, 0 warnings, 0 hints.
- Focused workspace/native-PDF unit tests: 7/7 passed (`premium-workspace.test.mjs` and `pdf-workspace.test.mjs`).
- `git diff --check`: passed.
- Compatibility production build: 629 static pages generated successfully. The only build notices are the pre-existing ONNX runtime URL and large-chunk advisories; no new CSS optimizer warnings remain.
- Firefox/WebDriver Canvas smoke test: validated local two-page PDF upload, lazy page rail, large active-page canvas, typed signature, click placement, real pointer drag, four-handle resize, duplicate, undo, dirty-close confirmation/focus, mobile `Pages | File | Adjust` switching, and successful signed-PDF generation (`1 field · 1 page`).
- Firefox/WebDriver shell smoke tests: PDF-to-JPG Preview mode and Protect PDF Quick mode both opened, locked page scroll, initialized the shared behavior, and centered at the viewport midpoint. Desktop Canvas rendered at a 29px viewport margin; mobile Canvas filled the available viewport.
- Visual captures were inspected at desktop and phone widths. The final mobile inspector uses an opaque surface so page copy does not ghost through the control panel.
- The normal repository build still encounters the already-known Catalina `_SecTrustCopyCertificateChain` incompatibility in esbuild 0.28. Verification therefore used a temporary esbuild compatibility overlay; repository dependencies were not rewritten.

## Known limitations / follow-up

- Watermark direct movement intentionally snaps to the engine’s supported 3×3 native positions; true arbitrary native coordinates would require adding normalized coordinates to the watermark document model.
- Remove Background keeps the reliable installed matting engine and checkerboard result. Manual keep/erase brushes and feathering were not fabricated because the current engine does not provide a trustworthy editable mask contract.
- PDF OCR/PDF-to-Excel retain their current preview capabilities; no fake OCR/table editor controls were added.
- Doc Scanner uses the dedicated Pages/File/Adjust studio for normal work and keeps the proven full-screen four-corner editor as an explicit, focused adjustment step.

## Handoff

The adaptive workspace implementation and representative Canvas/Preview/Quick browser checks are complete.

## V2 mandatory real-browser audit

- Added a deterministic QA fixture generator plus a raw Firefox/geckodriver runner that drives the production routes, real file inputs, real controls, browser downloads, format parsers, pixel checks, network probes, screenshots, and responsive assertions.
- Completed all 26 production tools with 26 PASS results. Desktop, 900px tablet, and asserted 390 CSS-pixel phone layouts were covered.
- Exercised unsupported, zero-byte, invalid-signature, wrong-password, corrupted-file, cancellation, dirty-close, duplicate-merge, and no-page-selection recovery paths without false-success downloads.
- Found and fixed one P1: Edit Image exposed undo/redo but did not maintain edit history. The retest proved crop, rotate, flip, brightness, contrast, undo, redo, and changed-pixel WebP export.
- Full evidence and the per-tool validation matrix are recorded in `SORAFILES_END_TO_END_TOOL_AUDIT.md`.
- Production comparison initially found `PRODUCTION_DRIFT`: Rotate PDF matched local, but the live Edit Image route predated the V2 undo/redo fix. Deployment `c3e78984-d5d6-49c0-ae52-a227d369892a` resolved the drift; the post-deploy Firefox audit passed both routes.

## Production deployment

- V2 audit fixes deployed on 2026-08-29 as Worker version `c3e78984-d5d6-49c0-ae52-a227d369892a` through the `sorafiles` OAuth profile. Both custom domains and the `17 3 * * *` scheduled trigger remained active.
- Post-deploy HTTP checks returned 200 for the homepage, Edit Image, and Rotate PDF. The live Firefox audit passed Rotate PDF output validation and the previously drifting Edit Image undo/redo plus changed-pixel WebP export.
- Deployed on 2026-08-29 through the explicit Wrangler `sorafiles` OAuth profile to Cloudflare account `8f3adcfff74a52e95ed0989db6fc241e`.
- Activated Worker `sora-files` version `db51ae38-9952-4a07-9761-79fe3723b10d` on `sorafiles.com` and `www.sorafiles.com`; the `17 3 * * *` scheduled popularity refresh remains configured.
- Live HTTP verification passed for the homepage, Sign PDF, Protect PDF, sitemap, canonical URL, and `www` redirect. The sitemap exposes 627 localized URLs.
- A live Firefox upload check rendered both pages of the PDF fixture, opened the 480×621 signature canvas, centered the workspace at the viewport midpoint, and locked background scrolling.
- Search-engine submission was not run because it is optional and no additional owner-provided search credentials were needed for this application deployment.

## Doc Scanner, universal uploader, and background-removal follow-up

Status: implemented, deployed, and verified in production on 2026-08-29.

- Doc Scanner now opens directly into a dedicated three-panel studio after upload: page filmstrip and ordering on the left, dark document light table in the center, and crop/filter/export controls on the right. Phones expose the same structure through `Pages | File | Adjust` navigation.
- New scanner pages preserve the complete source image. Corner adjustment is opt-in through **Adjust corners**; upload, replacement, and additional pages no longer force the crop dialog. **Use full image** restores the source bounds at any time.
- Crop intent is persisted as `full` or `manual`. Legacy drafts without explicit crop intent reopen at full bounds instead of silently preserving an old automatic crop.
- Page rotation in both directions, replacement, reorder, delete, filters, PDF/JPG/PNG export, draft recovery, cancellation, dirty-state protection, and object-URL cleanup remain wired into the studio.
- Every primary tool family now uses the shared `sf-upload-dropzone` visual contract and localized “drop or browse / stays on device” language. Scanner, Resize Image, and Remove Background gained real drag/drop handling; existing uploaders retain their proven handlers.
- Remove Background now requests its IMG.LY metadata/model chunks through a cacheable same-origin Worker route first, then falls back to the vendor CDN. This avoids routine failure when browser privacy tooling blocks third-party model requests while preserving the local inference boundary.

### Follow-up verification

- Full CI passed: Astro diagnostics `126 files, 0 errors, 0 warnings, 0 hints`; production build `629 pages`; all SEO, i18n, content, branding, OCR, monetization, and optimizer gates passed; unit suite `70/70` passed.
- Firefox 154 / geckodriver passed the two-page Doc Scanner flow at a 390px viewport: full-image default, no forced crop, explicit corner adjustment, real handle movement, filter processing, mobile Adjust navigation, valid two-page PDF download, privacy probe, and no horizontal overflow.
- Firefox passed Remove Background with a real controlled image: the downloaded PNG decoded with meaningful transparent and opaque pixels.
- Direct Firefox `DragEvent` tests passed for Doc Scanner, Resize Image, and Remove Background, including drag-active styling and transition into each editor.
- The Worker same-origin model handler has a dedicated integration test covering upstream URL allowlisting, cache insertion, response body, cache policy, and `Cross-Origin-Resource-Policy`.
- Desktop and mobile screenshots were inspected. The design uses one deliberate signature element—the scanner light table—while the universal uploader stays visually quiet and consistent.
- Local Cloudflare `workerd` execution remains unavailable on this Catalina host because the installed binary requires macOS 13.5 libc++ symbols. The Worker handler test and real Firefox model-output test pass.

### Follow-up production deployment

- Deployed through the explicit Wrangler `sorafiles` OAuth profile as Worker version `300da085-1f41-47b4-8de8-762165569a77` with both custom domains and the `17 3 * * *` schedule preserved.
- Live HTTP checks returned 200 for the homepage, Doc Scanner, Remove Background, and the same-origin `__sf/background-removal/resources.json` route. The model manifest response was valid, cacheable, and protected with `Cross-Origin-Resource-Policy: same-origin`.
- The post-deploy Firefox audit passed Remove Background with meaningful transparent and opaque output pixels, confirming live same-origin model delivery and inference. Doc Scanner passed its multi-page workflow, full-image default, opt-in crop, mobile workspace, and PDF export.

## Manual image-adjustment follow-up

Status: implemented, deployed, and verified in production on 2026-08-29.

- Added a shared pixel-processing engine for exposure, highlights, shadows, contrast, brightness, black point, definition, sharpness, noise reduction, and saturation. Tonal changes, edge-aware smoothing, and local-detail passes preserve alpha and use bounded control ranges.
- Doc Scanner now exposes grouped **Light** and **Detail** sliders in the Adjust inspector. Values are stored per page, restored from local drafts, resettable individually or as a group, rendered into the live preview and thumbnails, and applied identically to PDF/JPG/PNG export plus searchable-PDF OCR input.
- Edit Image now uses the same complete light/detail stack, retains its presets and saturation control, participates in undo/redo, and applies the shared pixel math to both its live canvas and final JPG/PNG/WebP export.
- Added native adjustment labels for all 19 published languages. The inspector remains compact through collapsible groups, monospaced numeric readouts, keyboard-operable ranges, and an opaque editing surface for visual clarity.
- Verification passed: Astro diagnostics `128 files, 0 errors, 0 warnings, 0 hints`; unit suite `74/74`; production build `629 pages` with all content, localization, SEO, branding, OCR, monetization, and optimizer gates; `git diff --check`.
- Firefox 154 passed Doc Scanner on a 390px viewport with seven non-default manual controls, live preview completion, two-page adjusted PDF export, and no overflow. Edit Image passed ten manual light/detail controls, undo/redo, square crop, and changed-pixel WebP export. Final desktop and mobile control screenshots were visually inspected.
- Deployed through the explicit Wrangler `sorafiles` OAuth profile as Worker version `08eca978-a74f-4490-8d68-cd8eb73ef42a`; both custom domains and the `17 3 * * *` schedule remain active. Live HTTP checks confirmed the new controls on both routes, and the post-deploy Firefox audit passed the adjusted Doc Scanner PDF and Edit Image WebP workflows.

## V6 benchmark-decided workspace and engine upgrade — 2026-08-30

Status: implemented, verified, and deployed on 2026-08-30.

- Applied the frontend-design direction as a restrained “pocket workstation”: one premium uploader, direct file-to-canvas continuity, a focused contextual inspector, and explicit mobile panels. No cosmetic competitor clone or second design system was added.
- Benchmarked only the locked candidates. Current structural PDF, encryption, OCR, Office, HEIC, background removal, scanner, and visual-overlay paths remained because alternatives did not establish a material win.
- Adopted MozJPEG for materially smaller/higher-PSNR eligible JPEGs and OxiPNG for materially smaller lossless PNGs. Both are lazy, bounded at 12 megapixels, and fail safely to the existing native browser encoder.
- Kept native WebP because jSquash produced identical bytes/quality more slowly. Rejected AVIF after it exceeded the bounded five-minute mobile Firefox run.
- Added a source-level regression contract covering package pins, lazy imports, memory bounding, native WebP retention, integration points, and hard-target acceptance.
- Verification: Astro `129 files, 0 errors/warnings/hints`; unit `75/75`; build `629 pages`; full real Firefox `26/26`; negative paths `6/6`; all shared mobile workspace families at `390×844`; focused post-rebuild Sign PDF retry passed after one transient full-suite timing miss.
- License decisions and every rejected/unavailable candidate are recorded in `SORAFILES_ENGINE_LICENSE_MATRIX.md`. Engine metrics and UI/process decisions are recorded in the two final V6 benchmark reports.

Final V6 status: **VERIFIED WITH KNOWN LIMITATIONS**. The limitations are Safari availability, stable peak-memory instrumentation, unresolved/unavailable Unfleece packaging, and bounded rejection of non-winning candidates. No such limitation affects an adopted path.

### V6 production deployment

- Deployed through the authenticated Wrangler `sorafiles` profile as Worker version `75571fe2-bb74-480c-ae0c-dce9dc937d6d`.
- Both `sorafiles.com` and `www.sorafiles.com` custom domains and the `17 3 * * *` schedule were preserved.
- Live HTTPS checks returned 200 for the homepage, Image Converter, Compress Image, Remove Background, and Doc Scanner.
- Post-deploy Firefox 154 passed Image Converter (three conversion directions), Compress Image (normal and hard-target modes), Remove Background (meaningful foreground and transparency), and Doc Scanner (multi-page, manual adjustments, mobile workspace, adjusted export): **4/4 PASS**.
