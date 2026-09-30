# Office engine feasibility

September 23 implementation: `desktop/office-host` now contains a separate,
development-only WebView2 component using an exact URL resource allowlist, pinned
local asset hashes, a private diagnostic profile and cross-origin isolation.
`node desktop/scripts/probe-office-component.mjs` compiled and ran it successfully:
the resulting Writer and Calc PDFs were independently parsed and retained known
invoice text and the spreadsheet formula result (84). Sources remained unchanged.
The first spreadsheet fixture used a too-narrow column and clipped its text; the
fixture now specifies column widths, and this is not claimed as an engine repair.

Import uses typed UNO short values for `MacroExecutionMode=0` and
`UpdateDocMode=0`, read-only/hidden loading and an abort-only interaction handler.
The policy is based on LibreOffice's [MediaDescriptor](https://api.libreoffice.org/docs/idl/ref/servicecom_1_1sun_1_1star_1_1document_1_1MediaDescriptor.html),
[MacroExecMode](https://api.libreoffice.org/docs/idl/ref/namespacecom_1_1sun_1_1star_1_1document_1_1MacroExecMode.html)
and [UpdateDocMode](https://api.libreoffice.org/docs/idl/ref/namespacecom_1_1sun_1_1star_1_1document_1_1UpdateDocMode.html).
The Web loader is unchanged. A focused policy test verifies typed properties and
abort selection. `--malformed` verifies a corrupt DOCX is rejected specifically
during Writer import with zero outputs, rather than counting initialization
failure as success. Runtime checks require an unlisted local URL to return 403
and a matching `connect-src` security-policy violation for external fetch.

This is real synthetic conversion evidence, not a shipped Desktop tool. Production
license/queue integration, native file pinning/publication, cancellation and crash
cleanup, broader hostile/fidelity fixtures, current font/source notices and other
platforms remain unfinished. Office assets are still excluded from the installer.
Evidence is under `.artifacts/office-component/` and dated recovery logs.

September 23 read-only recheck: all four cached payloads still match the probe's
pinned sizes and hashes (262,261,407 bytes). The VFS metadata contains 137 fonts,
55,213,848 bytes total. Asset absence is not the blocker. No engine/font license
texts or exact supplier build/source provenance were identified in the examined
cache metadata and repository notice records; redistribution remains unresolved.

The next implementation candidate is a separate on-demand system-WebView Office
component. Reuse `src/lib/office-wasm` conversion logic and the local-resource
interception approach in `desktop/prototypes/NativeProbe.cs`, but not its direct
output writes, fixed proxy or permissive path checks. The main Tauri renderer's
CSP must remain separate. The component needs cross-origin isolation, workers and
OffscreenCanvas, hash-pinned allowlisted resources, denied external network and
navigation, explicit macro/external-link/update/interaction policy, and native
job-scoped bytes, cancellation and validated publication. The current Web loader
supplies `Hidden` only; that is not evidence of safe unattended Office import.
No current conversion or cross-platform support is claimed by this audit.

September 17, 2026, Windows x64. Word-to-PDF and Excel-to-PDF remain unported.
Historical WebView prototype success does not certify a current processing route.

The recovered ZetaOffice payload is 262,261,407 bytes before compression:
858,124 bytes JS, 161,667,499 bytes WASM, 99,520,604 bytes virtual filesystem data,
215,180 bytes metadata. `scripts/probe-office-node.mjs` pins the four recovered
SHA-256 values and verifies every byte before copying to an ignored probe directory.
It does not download assets, enter the shipping pack or expose file uploads.

The Emscripten module contains a Node loader and a virtual filesystem. With a
local-only metadata-request adapter it initializes under Node 24.21.0. The direct
headless DOCX conversion probe, however, fails to start its main worker: the build
requires transferring `#qtcanvas` to a browser OffscreenCanvas, even with headless
arguments. It reports `document is not defined`, then reaches the bounded timeout.
No PDF output is produced. Initialization is not document conversion.

Do not bundle a second browser merely to satisfy this runtime. Next viable
investigations are an isolated on-demand system-WebView processing host using the
existing OS runtime, or a supported headless/native LibreOffice distribution with
quality/size/source/font comparison. A Node loader flag alone cannot provide the
browser canvas API. A full source build with appropriate headless options is a
separate toolchain and provenance task.

Any selected path must run independently after the main window closes, receive
only authorized file bytes, disable macro execution/external links, stop workers
on cancellation, validate every PDF and retain source files. Benchmark realistic
DOCX and spreadsheets including charts, formulas, print areas, page breaks and
multilingual fonts against the Web output. Font redistribution and the exact
cached supplier/source/license grant remain release gates. The mutable original
`zetaoffice_latest` URL is not a sufficient production asset identity.
