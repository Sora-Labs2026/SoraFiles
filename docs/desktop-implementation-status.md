September 23 owner clarification: proceed with Windows/macOS/Linux builds and launch without waiting for Apple notarization. Mac users may approve the app through System Settings → Privacy & Security → Open Anyway. This supersedes the September 17 notarization-only release policy. Ad-hoc Mac releases must disclose their signing status, include the first-party instructions and disable automatic updates. Functional results and pending platform checks remain reported separately.

Current Windows build completed with exit 0: **115,025,320 bytes (115.03 MB)**, unsigned, SHA-256 `ba41e14a9539eca5b00acfebafe7ef9cb3eb86d94d585a2b43037fead89b65e1`. Native lifecycle passes at 1180 × 900; 1,989 resources match the generated pack byte-for-byte (316,228,434 bytes). The native executable is 4,804,096 bytes. Controls and opt-in Explorer source are included; the development Office component is excluded. No installed Explorer certification is claimed. Evidence: `desktop/audit/compact-candidate-shell-20260923.json`.

# September 23, 2026 — recovered source and active continuation

Latest owner steering: stop mobile-view checks and focus on the desktop app,
Windows packaging and native behavior. The narrow screenshot shown during
recovery was the website's `/desktop` page, not a mobile app implementation.
No mobile-specific app changes were made in that check.

## Continued implementation after the installer checkpoint

The full Node Desktop suite now passes **190 tests, zero failures/skips**.
Watermark and page-number forms now expose the existing engine controls for
selection, placement, size, colour, margin, opacity/angle and numbering format/
skip. Real browser FormData is exercised through the PDF engines; selected-page
text, Roman/total labels and malformed options are checked. The UI has an explicit
`--desktop-only` QA mode: 900, 1180, 1440 and 1920 CSS pixels. Its latest **36 groups
pass** in both themes with keyboard and 200% scaling checks, including the new
Explorer opt-in control. This uses a mock bridge, not installed Explorer evidence.

`desktop/office-host` is a new development-only isolated WebView2 component.
The synthetic DOCX and XLSX runs produced independently parsed PDFs preserving
invoice text and a formula result. It uses hash-pinned local resources, explicit
UNO import restrictions and no local HTTP server. A malformed DOCX is rejected
specifically at Writer import with zero outputs. Resource denial and external
`connect-src` CSP violation are checked. Two diagnostic false positives found by
review (generic error stages and ambiguous fetch failure) were corrected and both
normal/negative runs pass. This is not yet a licensed tool route or shipping asset;
publication/cancellation integration, broad fidelity and redistribution remain.

Windows install preflight is implemented and read-only. The verified candidate
has no existing registered install/startup conflict, but existing app WebView data
was found and preserved. Clean installed validation belongs in a disposable
account/VM. Native Explorer registration is being integrated as an explicit opt-in
setting, with transactional ownership checks and uninstall cleanup; no real menu
registration has been performed. Native tests now pass **44**, with one optional
OS credential-store test ignored. Six registry tests use fresh UUID test keys,
including rollback, mixed ownership and uninstall preservation. The current source installer rebuild has completed successfully.

The 115.03 MB installer below **predates these control and Explorer changes**.
Do not call it current source or claim the Office component is included. Evidence:
`recovery-20260923-desktop-next.log`, `-ui-shell.log`, `-office-component.log`,
`-office-malformed.log` under `.artifacts`; Office details in
`desktop/docs/office-engine-feasibility.md` and install preflight details in
`desktop/docs/windows-install-validation.md`.

Canonical source remains `C:\Users\Drishya\Desktop\SoraFiles`, branch `main`,
HEAD `8385e8c`, configured remote `Sora-Labs2026/SoraFiles`. Current filesystem,
Git and execution tools are verified. The 67 pre-existing modified tracked files
and substantial untracked Desktop source are preserved; no source recreation,
reset, commit, push, deployment or installer execution occurred. Scoped pre-edit
copies and status are in `.artifacts/recovery-20260923/integration-before/`.
An old external worktree registration is prunable; it was not removed or treated
as recovered source. No applicable AGENTS.md was found in this workspace.

Fresh baseline: Desktop **173 passed, 0 failed, 1 skipped** (HEIC fixture was not
selected); Web **119 passed, 0 failed**. Logs are
`.artifacts/recovery-20260923-desktop-baseline.log` and
`.artifacts/recovery-20260923-web-baseline.log`. The September 17 23:18 entry below
is the last recovered implementation checkpoint, not current build proof.

Completed source work: Office-container metadata cleanup and native/UI/package
integration; Windows publication filename termination fix; bounded, filtered
redemption responses and synthetic workerd service-binding validation.
Fresh full Desktop suite: **184 passed, zero failures/skips**, including the
opt-in local HEIC fixture. Windows Rust: **38 passed, one opt-in credential-store
test ignored**. The new Office publication test exposed the missing UTF-16 NUL
in the pre-existing rename buffer; the fix and multiple-length/Unicode/collision
regression pass. Existing inputs/outputs are preserved.

Office DOCX/XLSX/PPTX cleanup matches the Web property scope in synthetic
fixtures, preserves non-property entries and retains real generated Word text
and XLSX values/formulas. It rejects malformed/encrypted/signed/macro/oversized
archives. Existing xmldom 0.8.15 (MIT) is pinned directly and packaged, without
downloading a dependency. This is not redaction or full Office rendering parity.
Source tests and copied-runtime verification both pass. Runtime pack: **316,228,434
bytes / 1,989 files**, 31.62% below the original 462,457,716-byte baseline.

Playwright mock-bridge UI: **34 groups PASS** on Edge, both themes, keyboard,
five widths, contrast tokens and 200% CSS scaling. Web production build: **643
pages and all validators PASS**. Astro check: **0 errors/warnings/hints across
164 files**. Worker dry build: **78.33 KiB / gzip 19.58 KiB**, no deployment.
The first dry-build output path was rejected outside the workspace; retry used
an absolute in-project path. Website Playwright QA now passes **26 groups**, and
the built free Web Unlock PDF processed the known-password synthetic protected
fixture with independently parsed, unencrypted output and no Desktop upsell.
The initial NSIS attempts were interrupted before completion. The current native
release executable has now built and passed a real Windows lifecycle diagnostic
at 1180 x 900: three loads, two close/reopen cycles, no UI errors or overflow.
NSIS completed with exit **0**: **115,034,145 bytes (115.03 MB)**, unsigned,
SHA-256 `e953d13937333ec4dbf86441c38f21cd5b9fef86c799de4046f703f7f3560fcb`.
Evidence: `desktop/audit/compact-candidate-20260923.json`; no installer execution
or publication occurred. The build automatically
replaced a mis-hashed cached NSIS utility from Tauri's release URL and validated
its hash; no application runtime dependency was added.

NSIS resource staging passes byte-for-byte verification: 1,989 files,
316,228,434 bytes; native executable 4,787,712 bytes; combined staged payload
321,016,146 bytes. This is not extracted/installed footprint verification.
The hidden native diagnostic observed the first view within 925 ms, total 6,589
ms; host-only sampling excludes WebView processes, cold start and sustained idle.
Logs: `recovery-20260923-native-smoke`, `-payload` and `-native-metrics`.

Native smoke validation now rejects a lifecycle-only report when a background job
was requested. One additional regression test passes; the earlier full 184-test
run predates this test. Release executables do not include the development-only
background fixture, so they cannot certify that behavior via the normal smoke.

Evidence logs under `.artifacts/recovery-20260923-*`: `desktop-final`,
`native-publication-fixed`, `targeted`, `pack-verify`, `pack-size`, `ui-qa`,
`web-build`, `astro-check`, `cloudflare-redemption`, `worker-dry-build`.
These do not certify installed shell actions, native DPI or other OS targets.

The built-in browser control is available but returned no tabs; binding the
ambient Dodo home URL failed. No Dodo or Cloudflare dashboard inspection occurred.
Dodo onboarding is complete **per owner**, while six live products/currency,
webhooks, deployment and live checkout remain independently unverified. No
browser credentials, customer records or signing secrets were accessed.

Release gates remain: two Office-to-PDF engines, full visual editors and complete
Web parity, installed Windows validation, current macOS/Linux testing, source/
redistribution clearance, signing/notarization and authorized external setup.
V4 exclusion tests passed in the fresh Desktop suite; free Web remains independent.
Existing permanently offline Lifetime grants cannot be remotely revoked.

All four public design repository pages were rechecked as accessible September 23:
Emil, Impeccable, Taste and Dick Wu. They are available but not applied to this
engine/security pass; the scoped September 17 use record remains separate.
No external skill, font or aesthetic asset was installed or shipped. Figma tool
discovery returned no callable Figma tool, and a scoped source/docs search found
no relevant design/file/prototype link. No Figma review is claimed. The project
Playwright runner provides current browser evidence.

Next: implement a safely isolated Office-to-PDF host, finish Desktop visual
editors, and validate installed native integration. Resolve identity/operator/
legal/signing/account gates before launch. Follow the latest owner instruction
to focus on Desktop and stop mobile-view checks.

Delegation was actually used, but quota/session interruptions prevented complete
initial agent results. The lead took over the partial Office module and finished
integration, review and tests. A later bounded read-only Office port audit completed:
all four cached payload hashes match (262,261,407 bytes), including 137 fonts in
the VFS (55,213,848 bytes). Assets exist; safe conversion-host integration and exact
source/license provenance remain missing. See `desktop/docs/office-engine-feasibility.md`.
No unsupported claim of completed initial parallel audits is made.

---

# Historical checkpoint - September 17, resumed continuation

Latest verified: **166 Desktop Node tests**, **119 Web unit tests** (Web suite
unchanged by native-only work), **37 Windows Rust tests** with one opt-in OS-store
test ignored (passed separately earlier), and **32 UI QA groups** on Edge/Chrome.
Evidence: recovery-desktop-background-full.log, recovery-web-excel-final.log,
recovery-startup-native-tests-final.log, recovery-background-ui.log and
recovery-background-modern-ui.log under .artifacts.

Windows now serializes job acceptance with window closure, retains public job
results across a busy close, and clears them on a later idle close. The real
background diagnostic passed PDF rotation with the WebView destroyed and its
synthetic license service stopped, then verified saved-output ID retention.
Evidence: recovery-background-real-smoke.log. Windows process-tree cleanup uses
kill-on-close Job Objects; a real parent/worker termination test passes.

Native Windows output publication now locks staged output, verifies size/SHA-256
against engine-validated bytes and renames that same open file without replacement.
Tests cover collisions, tampering, open writers, escaped paths/streams and real
offline single/batch processing. Non-NTFS, macOS/Linux native equivalents and
crash recovery remain unfinished. See desktop/docs/native-publication.md,
process-cleanup.md, background-processing.md and windows-file-pins.md.
Publication-enabled resources/build and both smoke diagnostics pass. Final
Word/startup native tests/build and all three smoke diagnostics PASS; see the
latest checkpoint below. No active Cargo build remains.

Source has **23 processing and 22 basic UI workflows** out of 25 eligible Desktop
tools. Two engines and full visual editors remain. Support-approved replacement
is implemented; server revocation prevents future entitlement issuance but cannot
disable an existing permanently offline Lifetime entitlement. Free Web Unlock
stays independent and excluded from every Desktop boundary.

No production change, campaign issuance or real replacement occurred. Dodo
onboarding is verified per owner; live products/currency, checkout and webhooks
remain independently unverified here. Production Mac releases require signing
and notarization. Historical inventories below are earlier scoped evidence.

Next three tasks: continue remaining engines/editors; finish installed shell and
login/uninstall integration work; finish hosting, legal, signing and platform
gates before launch. No release or paid checkout is enabled.

### Word/startup continuation checkpoint

PDF-to-Word added: editable selectable text, source page breaks, explicit RTL/LTR,
no layout/image preservation, rejects any blank/scanned/encrypted page. Core and
adapter checks pass. Latest complete Desktop suite: **153 passed**
(recovery-desktop-word-full.log). UI: **26 groups** Edge/Chrome before the final
startup-disabled guard. Coverage: **18 processing/17 basic UI** of 25 eligible;
seven engines remain. Existing MIT docx 9.7.1 added to packaged dependency closure.
The packager now resolves package paths with a trailing slash because
readable-stream needs userland string_decoder despite its built-in name.

Windows startup is now opt-in through a per-user Run entry and --background
tray-only launch. No actual Run entry enabled. Tests use an isolated temporary
registry key, and the NSIS pre-uninstall hook checks ownership before removal.
New startup Rust code and installer hook are still under validation. Current
native suite/build session **91311** includes Word/startup changes; its build
script is copying resources. Isolated package session **53827** runs separately.
Latest UI session (see recovery-startup-ui-final.log) checks startup and disabled-platform behavior.
After collection, rebuild native UI resources for the latest startup checkbox
and rerun the native suite/build and smoke if its compiled source predates edits.
Prior publication-enabled Windows native build and real background-PDF smoke PASS
(recovery-publication-background-smoke.log). git diff --check PASS with normal
repo CRLF configuration; forcing core.autocrlf=false falsely marked CRLF lines.

Next: collect these runs and fix failures; validate tray-only launch/uninstall
cleanup with local fixtures; continue the remaining engines/editors and shell
integration. Production service, identity/live Dodo setup, source/legal review,
signing and other OS validation remain release gates.

### Metadata port checkpoint

Added `desktop/core/metadata*.mjs`, native/UI routes, pack validation and scoped
tests. Supports unencrypted PDFs and still JPG/PNG/WebP up to 64 MB. PDF document
properties/XMP are removed and unreachable objects pruned; content, forms and
attachments remain. Images are oriented and re-encoded without metadata; JPEG
and WebP are not claimed lossless. Office formats remain unsupported. UI explains
that metadata cleanup is not redaction. Existing encrypted PDFs are refused.
Four core tests and six adapter tests pass; UI QA has 22 passing groups on Edge
and Chrome. The complete suite passed 145 tests before one additional passing
resource-name regression; the latest test file is recovery-metadata-resources.log.
PDF.js 6 attachment content uses a separate API; the original assertion was fixed
after independent before/after inspection confirmed the attachment remained.

The Windows executable including pinning/ranges/output actions passed 3 native
loads and 2 close/reopen cycles (`recovery-native-current-smoke.log`). Final
metadata-enabled build and pack PASS. The final resource-name correction was
copied into the generated pack and native resources after compilation, then the
isolated pack was checked again (recovery-metadata-pack-final.log). Drive-letter
aliases are checked using
GetDriveTypeW so mapped network volumes cannot bypass the local-folder rule.

---

# Desktop recovery and continuation

## September 17, 2026 — Phase A recovery

Canonical workspace: `C:\Users\Drishya\Desktop\SoraFiles`. Windows 10 Pro x64
10.0.19045; Node 24.21.0, npm 12.0.2. Git exists at
`C:\Program Files\Git\cmd\git.exe` but is absent from PATH. Branch `main`,
HEAD `8385e8c`. No applicable AGENTS.md found. Rust/Cargo/MSVC have not been
found on PATH; native build readiness is unverified. No authenticated browser
integration is available in this session; Brave credentials were not accessed.

The owner's September 17 recovery prompt is authoritative over older repository
notes. Preserve the 67 pre-existing modified tracked files and substantial
untracked work, including the entire Desktop implementation. No reset, clean,
commit, push, deployment, real transaction or campaign issuance is authorized here.
Pre-edit file copies and Git status: `.artifacts/recovery-20260917/`.

| Component | Recovered state and evidence |
| --- | --- |
| Web | Astro 7, Cloudflare Worker, 26 tools. Baseline 115/115 unit tests pass. |
| Desktop | Tauri 2/Rust native host, separate Vite UI, on-demand Node engine process. Present; native build unverified on this PC. |
| Capabilities | 26 inherited web tools before V4; 14 allowlisted processing workflows, with 11 additional eligible ports needed after exclusion. UI presence is not processing support. |
| Processing | PDF editing/creation, images, raster and OCR code with fixture tests. Baseline Desktop suite 116/116 passes. Native file-handle output, batches, editors and complete engine coverage remain partial. |
| Native platforms | Historical Windows experiments/captures and older CI candidates exist. Neither proves current Windows/macOS/Linux installation, shell actions, offline lifecycle or release readiness. |
| License service | Node HTTP + SQLite, signed device proofs, Ed25519 offline grants, webhooks, Dodo authority, concurrent activation tests. Not a Cloudflare Worker: local SQLite/HTTP runtime requires a deliberate hosting adaptation. |
| Dodo | Product Info, Identity and Bank onboarding VERIFIED per owner. Old notes claim six test products; this session has not independently checked products/currency/live credentials/webhooks/emails/portal or purchases. |
| Promotions | Atomic code claims, encrypted imported keys and recovery tests exist; real Dodo import and verified recipient identity remain unverified/unconfigured. No actual campaign or licenses issued. |
| Website | Prelaunch Desktop routes, disabled homepage popup, original 3:4 SVG, historical Windows image. No published release artifacts or active checkout. Redeem page absent. |
| Legal | Project and Rust host declare AGPL-3.0-only. Audit includes copyleft/model/codec risks; redistribution clearance remains unresolved. |
| Release | Manifest empty. Existing ad-hoc Mac release exception conflicts with current signed/notarized requirement. |

### Baseline commands

- `node --test --test-reporter=spec desktop/tests/*.test.mjs`: 116 pass, 0 fail.
- `npm.cmd run test:unit`: 115 pass, 0 fail.
- Logs: `.artifacts/recovery-desktop-baseline.log`, `.artifacts/recovery-web-baseline.log`.

### Conflicts requiring reconciliation

- Unlock PDF is still inherited into Desktop UI/search/relevance. V4 requires
  exclusion at capability, job, entitlement and marketing boundaries; Web stays free.
- Old code permanently consumes device seats and has no transfer route. Current
  requirement allows device replacement; cannot claim this is implemented.
- Old Mac policy allows ad-hoc/manual Gatekeeper distribution. Current prompt
  requires production signing/notarization; publication must fail closed.
- Old notes disable the popup until launch and omit giveaway redemption UI.
  Prelaunch publishing and checkout must stay honest; original promo can be
  reviewed locally without production changes.
- Old bank-onboarding blockers are obsolete. Only actual billing configuration,
  infrastructure, live verification and approvals remain external gates.

### Next three actions

1. Complete V4 product allowlist and adversarial regression tests; preserve Web.
2. Rebuild UI/processing assets, audit screenshots and verify production build.
3. Reconcile release/owner setup, review remaining licensing and engine gaps,
   and continue independently executable implementation work.

## September 17 — Phase B complete in source; validation continuing

- Added `desktop/shared/tool-policy.mjs`: 25 eligible Desktop IDs, applied to
  metadata generation, UI/search/selection, queue enqueue/start, native processing
  adapter, signing and verification. Trial/paid/promotional grants allow only
  `process`, which cannot bypass product eligibility. Unknown aliases are refused.
- Desktop UI no longer imports the entire Web registry/copy. Web retains 26 tools
  and its untouched Unlock PDF engine. Filtered metadata is generated and checked.
- Dodo catalog verification rejects excluded feature names in public product and
  entitlement copy/metadata. Actual dashboard copy is still unverified.
- Removed old Windows screenshot from `/desktop` because it visibly claimed
  “All 26 tools”; retained the original file as historical evidence. Current page
  uses the existing original SVG explicitly labeled as an illustration.
- Restored production Mac signing/notarization gate. Ad-hoc builds remain CI/local
  candidates only. Updated ten-code giveaway template to Personal Lifetime;
  no campaign was created.
- 119 Desktop tests passed before the replacement work; UI has 15 passing groups
  on Edge 92, including both themes and 200% zoom. Added older-WebView CSS fallback
  after reproducing a compact file-picker overflow. No container-query support
  in this PC's old Edge; modern browser validation remains separate.
- Isolated Windows x64 processing pack PASS: synthetic private-pipe entitlement,
  independently decoded PDF rotation, image resize, PDF raster dimensions and
  OCR invoice recognition with bundled language data.
- Full web/native builds initially failed on missing Microsoft runtime DLLs.
  Official `vc_redist.x64.exe` downloaded from Microsoft, Authenticode validated
  (Microsoft Corporation), installed silently with no restart, exit 0. Builds
  retried after repair. No dependency tree reset/reinstall was performed.

## September 17 — Phase E support replacement steering

Owner explicitly selected support-approved device replacement. Old server
activation must be revoked, new seat limits enforced, and history retained.
Permanent offline Lifetime entitlements cannot be remotely disabled; retain that
limitation in UI/docs and test it explicitly. No periodic Lifetime check was added.

Implementation in `desktop/license-service/replacements.mjs`, store migration,
server-operator CLI and `desktop/docs/device-replacement.md`. Reserve the old seat
until provider deactivation succeeds; reserve the released seat for the named new
device. Default support review threshold: two replacements/seat/365 days and
seven-day replacement-chain review, with distinct audited exception ticket.
Initial tests pass; restart/concurrency and final regression are in progress.
Native support-details bridge exposes only a public-key-derived device ID.

Current next tasks: finish replacement and UI validation; complete web production
build and free Web Unlock regression; update final compliance/design/status notes.

## Owner pause — September 17
Work paused at the owner's request. Latest verified: web production build 642 pages and all gates PASS; free Web Unlock PDF real protected fixture PASS; website QA 26 groups PASS; Desktop UI 16 groups PASS on Edge 92 and modern Chrome; replacement restart/concurrency tests PASS. Microsoft VC runtime installed successfully. Microsoft C++ Build Tools installation was still running when pause was requested; do not terminate it mid-install. Native tests previously blocked on missing cl.exe and need retry after installation. Latest full Desktop suite is being stopped/collected at pause; do not assume completion. No production actions or real replacement executed. Resume by checking installer result, current test logs, reviewing replacement security and native support-ID bridge, then update final compliance/evidence notes. Existing unfinished engine/native/hosting work remains documented above.

## September 17 — resumed native validation and batching

Microsoft C++ Build Tools finished successfully (installer exit 0). Native Cargo
now compiles using the workspace Rust toolchain and installed MSVC environment.
First resumed run: 23 Rust tests passed, one opt-in OS credential-store test
ignored; private-pipe trial, encrypted persistence and real offline PDF processing
passed. No production credential or customer license was used.

Replacement review expanded to 12 passing tests, including in-flight refresh after
support revocation, malformed provider validation, mismatched keys, revoked/expired
authority and refund during provider release. Existing offline Lifetime grants
remain valid by design. No actual replacement executed.

Added sequential batches for connected per-file tools through the native processing
adapter, Rust response validation and UI. Each job rechecks offline entitlement;
malformed files fail individually; cancellation retains published output and skips
remaining files. Output stays beside each original unless another destination was
selected. Combine/signature jobs keep their grouped-input semantics. UI lists each
saved, failed or cancelled input. Verified decoded output, source preservation,
collisions across source folders and cancellation after publication.

Latest Node Desktop suite: **135 passed, 0 failed**
(`.artifacts/recovery-desktop-resumed.log`). Desktop UI: **17 QA groups PASS** on
Edge 92, including batch result escaping and 200% layout
(`.artifacts/recovery-ui-batches.log`). Final native bridge/pack rebuild and native
lifecycle smoke remain in progress. Tool coverage remains 14 processing workflows
and 13 basic UI workflows out of 25 eligible tools; this batch improvement does
not add new engines or certify installed native shell integration.

Next: collect final native tests and perform synthetic OS key-store roundtrip;
rebuild and smoke-test current native executable; finish remaining local
functionality while preserving publication, platform and live-service gates.

### Native/pack checkpoint
Final Rust batch suite: 24 passed, one opt-in test ignored; separate synthetic
Windows credential-store roundtrip: 1 passed. Web regression suite: 115 passed.
Isolated processing package: PASS for PDF/image/raster/OCR. Evidence:
`.artifacts/recovery-native-batches.log`, `recovery-os-vault.log`,
`recovery-web-resumed.log`, `recovery-processing-pack-resumed.log`.

Packaging review found recovered macOS optional binaries included in Windows
resources, and OCR notices missing. Fix now filters declared package OS/CPU,
removes only validated incompatible generated package copies, copies the existing
OCR notices and adds exact upstream Node license notices for local v24.21.0 and
CI v24.19.0 with recorded SHA-256/source. Rebuild and isolated verification are
in progress. This improves notice completeness; corresponding-source/provenance
clearance remains unresolved. Native executable build is still running; do not
launch the old September 13 executable as current evidence.

### Native smoke and redemption checkpoint
Current Windows debug executable built successfully. Native smoke PASS: three
window loads, two close/reopen cycles, no UI errors/overflow
(`.artifacts/recovery-native-smoke.log`). This is UI lifecycle evidence, not
installed shell/signing or full platform certification. Updated isolated pack
PASS includes current-platform dependencies, Node/OCR notices and real batch PDF
outputs (`.artifacts/recovery-pack-notices-verified.log`).

Added `/desktop/redeem` with disabled prelaunch state and enabled-flow client,
explicit key reveal/copy, memory-only secret handling, sensitive-page cache and
referrer protection. Added an optional first-party session adapter to promotion
HTTP; fails closed without a verified account provider. Fixed promotion runtime's
Buffer rate-secret compatibility. No campaign created, license issued, account
provider configured, deployment or publication performed. Nine targeted
redemption/privacy/HTTP checks passed. Full production build/browser QA ongoing.

### Production website verification and Protect PDF port
Website now builds 643 pages; all production validators pass
(`.artifacts/recovery-redemption-production-gates.log`), website QA 26 groups
PASS, enabled redemption browser fixture PASS, free Web Unlock PDF real fixture
PASS. No deployment. Verified identity/campaign activation stays disabled.

Protect PDF port is being added using the already-installed MIT encryption
library and isolated worker. It rejects encrypted sources, writes AES-256 only,
checks password requirement before publication, and supports normal offline batch
jobs. Source count is now 15 processing/14 basic UI workflows, but validation is
still in progress: password/cancellation/batch tests pass; form-field preservation
assertion needs investigation before claiming this engine verified. Rebuilds are
running. No Unlock processing capability was added.

### Latest full regression checkpoint
Desktop Node suite: **139 passed, 0 failed** (`recovery-desktop-final.log`).
Web unit suite: **118 passed, 0 failed** (`recovery-web-final.log`). Protect PDF
now passes correct/wrong/missing password checks, AES-256 revision/length checks,
page text and form widget value preservation, Unicode and malformed input,
cancellation, and offline batch source preservation. The initial form assertion
looked at a parent entry; independent inspection confirmed the child widget value
is unchanged. Desktop UI **18 QA groups PASS** on Edge 92, including password
confirmation and clearing. Final native/isolated pack/modern UI checks ongoing.
15 processing workflows, 14 basic UI workflows out of 25 eligible tools.

### Atomic entitlement issuance correction
Review found the final device-state check and signing were separated by a SQLite
transaction boundary. A second service process could revoke/replace during that
small interval. Signing now executes synchronously inside the final write
transaction for activation completion, completed retries and refresh. Failed
signing rolls back permanent binding; revoked state cannot produce an entitlement.
37 targeted licensing/replacement/deployment tests PASS. A real independent
SQLite-connection race test is being added. This changes only future server
issuance, never revokes a disconnected Lifetime entitlement.

Protect PDF isolated package PASS, including actual required-password verification.
Modern Chrome Desktop UI also passes all 18 groups. Current native suite is still
running; final native executable must be rebuilt after those source changes.

### Saved output actions
Added native output ledger and Open result / Open containing folder controls.
Only opaque IDs from completed outputs enter renderer requests; arbitrary paths,
unknown IDs, executables and changed outputs are rejected. Windows uses direct OS
file association, macOS/Linux have argument-vector adapters pending platform QA.
The bounded ledger expires on window close. Post-save registration failure leaves
processing success intact. UI contract: **19 groups PASS**. Rust output tests and
current native UI rebuild ongoing; actual viewer launch is not certified yet.

Independent SQLite signing/revocation race PASS. Latest fully collected native
suite before output-action addition: 24 passed, one ignored. The complete Node
suite after atomic signing is running. Do not report older counts as final.

### September 17 - metadata validation and resource edge case

Full Desktop suite: 145 passed, no failures (recovery-desktop-metadata-final.log).
Current Rust: 31 passed, one opt-in OS-store test ignored. UI: 22 groups PASS
on Edge 92 and Chrome. Isolated package including metadata, protection, OCR,
image and PDF workflows PASS. Native executable rebuild/smoke is running.

Review then found a legitimate PDF resource can be named /Metadata. Cleanup now
removes standard metadata entries/streams without deleting an image with that
resource name. Four metadata tests pass, including the new independent resource
check (recovery-metadata-resources.log). This last change must be copied into the
pack after the running native build completes. The earlier full-suite result
predates this extra regression; do not claim a full 146-test run yet.

The old C# prototype was corrected to request directory read access too. It is
a reference only; current Windows Rust tests establish the observed rename
protection. No live service, release or campaign was changed.

### Enlarged workspace correction

The additional 200% workspace check exposed overflow in selection rows with
ordering controls. Rows now wrap and preserve the paired ordering buttons. Edge
UI QA passes 23 groups (recovery-ui-workspaces-final.log). Final native resources
are being rebuilt for this CSS change. Full Node engine suite need not be repeated
for CSS; current metadata resource-name regression passed separately.

### Background-job continuation in progress

Added native in-memory job status, result retention when closing a busy window,
reconnection polling/cancellation in a new renderer, and a tray-unavailable close
guard. Files/options/passwords are not persisted in job status; only basenames
and public result IDs survive the busy close. Ordinary later close clears them.
Browser QA passes 25 groups including recreated-view recovery. Rust job status
test passes in the 32-test suite. A debug native background-job smoke was added
to verify actual window destruction/retention; final resources/build and this
new diagnostic still need running. No background engine claim from the synthetic
job diagnostic alone. See desktop/docs/background-processing.md.

Excel-enabled full suites pass: 149 Desktop, 119 Web. Isolated Excel pack PASS
(recovery-excel-pack.log); current native build session 12903 is still being
collected. After it finishes, rebuild resources for background UI and compile
latest native source, run both normal and --background-job smoke.

### Latest collected startup/Word evidence

Windows Rust 37 passed, one opt-in OS-store test ignored
(recovery-word-native-tests.log). This run includes isolated startup registry
checks; a later added real DOCX publication assertion still needs the final run.
Isolated Word-enabled processing pack PASS (recovery-word-isolated-pack.log);
DOCX XML was actually checked though the printed check list omitted that label.
Desktop full suite 153 PASS; UI 27 groups PASS Edge and Chrome
(recovery-startup-ui-final.log, recovery-startup-modern-ui-final.log).

Native build session 91311 remains active. Native UI pack predates final startup
checkbox edits. After it exits, regenerate only native UI (processing pack already
built), rerun native tests/build with latest real DOCX assertion and startup-smoke
code, then normal/background/startup-helper smoke. No actual Run key changed.
NSIS uninstall hook is configured and source-reviewed, not install-tested.

### Final native/startup collection in progress

Current sequential session **17182**: native UI-only refresh, Rust tests (including
real offline DOCX publication), build, normal smoke, real background-PDF smoke,
and --startup-helper smoke. The engine pack is already verified and unchanged.
Do not start a competing Cargo build. Logs are recovery-startup-native-*-final.log
and recovery-startup-*-smoke-final.log. Previous Word/startup build and background
smoke passed (recovery-word-native-build.log / recovery-word-native-smoke.log).
The latest state-value fix stops preference updates resetting the renderer's
license state; pending job acceptance also checks quitting. Final startup smoke
source was added before this compile; read results rather than assuming success.

Edge 92 CSS-zoom click probe showed pre-zoom getBoundingClientRect values caused
Playwright clicks to target the sidebar. A real click at the scaled physical
position opens Word correctly, then all 27 QA groups pass
(recovery-zoom-physical-click.log). No product layout workaround was added.
Actual native DPI remains unverified.

### Native output + startup final test result

Final Rust suite **37 passed, 0 failed, one opt-in ignored**, including real DOCX
publication under Windows file pins/Job Object and offline synthetic entitlement
(recovery-startup-native-tests-final.log). Current session 17182 is rebuilding the
executable, then runs normal, background-job, startup-helper diagnostics. Do not
claim startup-helper PASS before its log exists. The current public UI has 18
processing/17 basic UI tools, 153 Desktop tests and 27 browser groups on Edge and
Chrome. Free Web remained unchanged in this continuation; prior 119 tests and
643-page production build evidence remains scoped to that unchanged source.

HEIC next-port investigation only: installed heic-to 1.5.2 LGPL-3.0 includes
libheif 1.22.2 / libde265 1.0.16. Its Node path uses require/__dirname but exposes
an ESM export; .artifacts/heif-probe.cjs tests a wrapper adaptation. Nothing added
to the product or release pack yet. No HEIC fixture is present in searched local
directories. Corresponding-source/codec clearance is still a release gate.

### Collected final native lifecycle - PASS

Session 17182 completed successfully. Final Windows debug build PASS; normal,
real offline background-PDF, and tray-only startup diagnostics all PASS, each
with three window loads and two close/reopen cycles. Startup reports
trayOnlyStartup=true after verifying no WebView existed before opening controls.
Logs: recovery-startup-native-build-final.log,
recovery-startup-normal-smoke-final.log,
recovery-startup-background-smoke-final.log,
recovery-startup-helper-smoke-final.log. Latest native UI includes startup disabled
state and Word controls. Rust 37 pass (including real DOCX publication), Desktop
153 pass, UI 27 Edge/Chrome, isolated Word package PASS. No production deployment,
real replacement, campaign, payment, installer execution or actual Run entry change.

Next: continue seven remaining engines and visual editors; finish installed shell
and uninstall/login tests; hosting, legal/source, live keys/catalog and signed
platform releases remain launch gates. HEIC probe initializes libheif in Node,
but there is no processing port or validated HEIC fixture yet.

### HEIC port validation in progress

Added heic worker/queue, native/UI routes and generated decoder sync. Source has
19 processing/18 basic UI workflows; six engines remain. Real upstream primary
photo converted to a visually inspected 1280x854 JPG. Fixture checks pass for
JPEG/source colour MAE < 8 and PSNR > 28 dB, dimensions, metadata absence,
additional-image warning, offline batches/collisions/source preservation and
license refusal. Malformed boxes, wrong formats, timed sequences and cancellation
are rejected. Evidence: recovery-heic-tests.log (10 pass including imported
adapter tests); fixture helper was subsequently split out to avoid duplicate tests.
UI 28 groups PASS Edge (recovery-heic-ui.log); Chrome/new full suite pending.

Decoder source SHA-256 pinned in sync-heif-decoder.mjs. Generated CommonJS wrapper,
LGPL package license and provenance copy into the processing pack. Actual decoder
source/legal clearance remains a release gate. External example remains only in
.artifacts, hash pinned in optional SORA_HEIC_TEST_FIXTURE test. Do not count this
fixture as redistributed or all HEIF/HDR/orientation support.

Current asset build session **65506** is still copying dependency resources.
After it completes, run HEIC-enabled isolated pack with SORA_HEIC_TEST_FIXTURE,
then native tests/build and smoke; run full Desktop suite with fixture enabled
and modern UI. No Cargo build is active at this checkpoint. Prior startup/Word
native test/build and all three lifecycle smokes passed. Keep the broad master
prompt task active; substantial engine/editor/shell/service/release work remains.

### HEIC full regression collected

Desktop full suite **155 passed, zero failed/skipped**, with the explicit upstream
HEIC fixture enabled (recovery-desktop-heic-full.log). UI **28 groups PASS** Edge
and Chrome. Complete HEIC asset pack built (recovery-heic-native-assets.log).
Latest native test/build/background smoke and isolated HEIC pack checks launched;
collect active sessions before editing resources or running more Cargo builds.
Remaining engines: compress-pdf, word-to-pdf, remove-background, repair-pdf,
excel-to-pdf, doc-scanner. Visual Sign PDF UI and richer editors/previews also remain.

### Structural PDF compression port in progress

Installed qpdf WASM 12.2.0 initializes offline. Added isolated structural compression
worker/queue and UI/native routes. It refuses encrypted/signed inputs and warning
exit status; verifies page geometry; saves exact original bytes when no smaller
result is found. Pixel-exact before/after render, text, form, attachment and
metadata tests pass. Licensed batch tests pass. Source now has 20 processing/19
basic UI workflows; five engines remain (word-to-pdf, excel-to-pdf,
remove-background, repair-pdf, doc-scanner), plus visual editors/signature UI.
Compression adapter session 45553 and UI session 21702 are being collected.

qpdf package wrapper says ISC, but runtime --copyright reports qpdf Apache-2.0.
Added qpdf-NOTICE.txt and Apache license copying. Exact wrapper notice/build
provenance and complete release legal clearance remain gates. Processing pack
script now includes qpdf; it has NOT yet been rebuilt for this compression port.

HEIC-enabled native tests passed 37, one ignored. Native build/background-smoke
session **43823** remains active. Isolated HEIC pack PASS (recovery-heic-isolated-pack.log).
Full Desktop before compression: 155 passed, including explicit HEIC fixture;
UI before compression: 28 groups Edge/Chrome. Do not report these as final
compression-enabled pack/build evidence. After current native build finishes,
rebuild full resources, run latest tests/native compile/smoke and isolated pack.

### Compression final regression running

Compression core/adapter 11 checks PASS (recovery-compression-adapter-tests.log),
UI 29 groups PASS Edge. Signature rejection now traverses direct nested PDF
objects too; full Desktop session **79163** includes that regression and the HEIC
fixture. Chrome UI session **3202** running. Latest HEIC native build/smoke session
**43823** still active; do not compete with Cargo or overwrite active resources.
Next after collection: rebuild compression-enabled assets and native executable,
verify isolated qpdf and HEIC package, collect full suites, update current banner.

### Full compression suite - PASS

Desktop **158 passed** with HEIC fixture enabled (recovery-desktop-compression-full.log).
UI **29 groups PASS** Edge/Chrome. HEIC native tests/build/background smoke and
isolated pack PASS. Current compression resource/test/build/background-smoke run
is active; logs recovery-compression-native-*.log. Added actual native private-pipe
compression fixture to the Rust integration test. Isolated compression pack must
be run after assets finish. No existing failure in the collected checks.

### Repair core and UI checkpoint

Fixed PDF.js Buffer rejection by passing a plain Uint8Array. Repair rewrites readable
PDF structure; damaged startxref fixture preserves pixels, text, forms and attachments.
Encrypted, signed, truncated and over-limit inputs are refused. Core/adapter/compliance
15 checks PASS (recovery-repair-adapter-tests.log); 30 UI groups PASS on Edge/Chrome.
Source now has 21 processing/20 basic UI workflows. Compression native 37 tests,
build and real offline background smoke PASS; isolated compression pack PASS.
Repair full suite and assets are running. A scanner port reuses existing Web filters
and is under core validation, NOT yet connected or counted. No Web source changes.

Next: collect repair full suite, build native resources and test repair publication;
validate/connect scanner; continue remaining Office/background-removal engines and
visual editors. Installed shell, hosting, legal and release gates remain.

### Scanner full regression - PASS

Imported-image scanner reuses Web filters, creates ordered image-only PDF pages,
applies rotation and A4/Letter/image-sized layout. No camera, perspective crop or
searchable-text claim. 12 MP per image keeps the adaptive-threshold sum in uint32.
Core/licensed tests PASS; full Desktop suite **164 pass** with HEIC fixture; UI
**31 groups PASS** Edge/Chrome. Logs recovery-desktop-scanner-full.log and
recovery-scanner-*.log. Coverage: 22 processing/21 basic UI out of 25 eligible.
Remaining engines: word-to-pdf, excel-to-pdf, remove-background; visual editors remain.

Repair native 37 pass/one opt-in ignored, build/background smoke and isolated pack
PASS. Scanner resource rebuild is running (recovery-scanner-native-assets.log),
then native tests/build and isolated scanner need validation. No Cargo operation
is active at this point. No Web source, actual startup setting or production state
changed. Existing cached IMG.LY model assets found; background port remains unimplemented.

### Background-removal port in progress

Scanner native 37 tests PASS/one opt-in ignored; build/background lifecycle and
isolated scanner package PASS. Background worker now uses ONNX Runtime Web Node
WASM, one CPU thread, pinned 44,348,940-byte ISNET uint8 model assembled from the
existing verified cache. Processing is entirely local; no runtime download.
Known synthetic subject rendering visually inspected on grey. Real-model licensed
batch test preserves RGB, multiplies existing alpha, checks collisions/originals
and license refusal. Malformed/oversize/cancellation tests pass. UI 32 groups PASS
Edge; Chrome/full Desktop and new resources are running. Background is connected
in source: 23 processing/22 basic UI workflows, leaving Word-to-PDF and Excel-to-PDF
plus visual editors unfinished. Do not use prior scanner suite as final evidence.

New files: core/background*.mjs, shared/background-model.mjs,
scripts/sync-background-model.mjs, tests/background.test.mjs, scoped docs/notices.
Build script includes ONNX/model; CI prepares checksum-pinned assets explicitly.
Model sha256 d1ca3535c21b53d08fa3b640e5949389f82e764f6376a0502d44982c35cae482.
Supplier reports MIT but exact transformed-model source/build and license copyright
remain release gates. No production action, new global install or Web source edit.

Active: assets session 8915; full suite 76335; Chrome UI 34839 (use log if session
number differs). No Cargo active. After assets finish verify isolated background
pack, then native tests/build/smoke. Office investigation found cached ZetaOffice
WASM and browser-only orchestration; no system LibreOffice. Continue remaining
engines, editors and shell/hosting/release gates; broad master task remains active.

### New owner steering: parity, resources and compact installers

Read Downloads/SoraFiles_Codex_Combined_Design_Skills_Figma_Playwright_Engine_Parity_Compact_Installers_Steering_Prompt.txt in full. Additive to master.
Added desktop/docs/web-desktop-parity.md: all 25 eligible tools, scope/versions/gaps.
No full parity claim. design-resources-current.md: four repositories reachable,
entrypoints inspected, none installed here; Figma/Playwright MCP unavailable,
project Playwright working. No redesign or shipped skill dependency.

Current full Desktop 166 PASS before latest WebP change; UI 32 Edge/Chrome PASS;
website refresh 26 PASS. Browser scanner parity: all seven filters match final
Desktop PDF pixels exactly (MAE/max difference 0), scoped opaque sRGB fixture.
Evidence .artifacts/parity/scanner-filters.json.

Pack baseline 462,457,716 bytes/4,026 files, Node 93,580,104 and ONNX 96,395,633.
audit/pack-size-baseline.json and compact-distribution.md. Historical 1,321,295-byte
NSIS candidate is September 13, NOT current engine package. Version-pinned generated
pruning implemented but NOT applied/verified yet. Wait for Cargo before changing
resources; preserve notices/CPU fallbacks, isolated checks and before/after required.

Upstream DIS LICENSE.md at pinned revision is Apache-2.0; IMG.LY says MIT. Both
retained; quantized-model grant/source release gate unresolved. No production action.
Latest edits add still WebP to scanner/background; tests running in
recovery-parity-webp-tests.log. Background native test/build/smoke session 48387
active (37 tests pass, build underway); unpruned isolated pack PASS (session 2968).
After build: prune/reverify pack, refresh resources for WebP, update matrix/counts;
continue remaining Web gaps, editors, Office and installer/platform gates.

### Compact pack first validation and current active runs

Pruning removed 146,518,291 bytes (31.68%), resource pack 315,939,425 bytes before
restoring a required nested dependency. Isolated verifier found pdf-lib nested
tslib package removed by parent pruning policy. Fixed policy to retain every
nested node_modules dependency; build regeneration restores it. Do NOT claim
pruned package PASS yet. Full unpruned background pack previously passed.

Current native background tests/build/offline smoke PASS (37 tests, one opt-in
ignored). WebP scanner/background tests passed except animated-fixture setup
and sync-throw assertion; fixture now uses distinct frames and still decoder
returns async rejection. Individual still-image final test PASS. Full affected
suite session 71268 is running. Current unsigned Windows NSIS package session
59046 regenerates latest resources and tests packaging; never execute installer
or claim signed/installed support. It uses existing local Tauri CLI 2.11.4.
Logs recovery-compact-windows-package.log and recovery-parity-webp-final.log.
After assets regenerate, verify reduced isolated pack again, record actual final
size/installer hashes, update docs. Broad master + newest steering remain active.

### September 17, 22:22 NPT: compact candidate and measured parity improvements

Existing work preserved. Corrected reduced pack passes isolated processing,
including real background inference and OCR. Size: 315,984,793 bytes / 1,973 files,
31.67% below 462,457,716-byte baseline. All six retained Tesseract CPU/SIMD cores
recognize a known synthetic invoice from a copied package; no repository fallback.
New scripts/verify-ocr-fallbacks.mjs and tests/fixtures/ocr-core-probe.cjs, included
in native CI. Initial probe cleanup API was corrected; final six variants PASS.

First current Windows x64 NSIS candidate: 114,955,736 bytes; SHA-256
e1c607320cc1cae98cc6b837de338fef39bf45559b1356e6d870847ca5e54d4e; NotSigned.
Build log completed one bundle but outer session 59046 returned 1; reconcile
wrapper status on next build. No installer execution/publication. Audit record
desktop/audit/compact-candidate-first-build.json. Candidate predates changes below.

OCR now accepts still WebP through the isolated decoder; licensed Unicode-name
fixture verifies recognized invoice and untouched original. Affected 5 tests PASS.
Source full suite: 168 PASS/no skips (recovery-compact-full.log). Edge UI: 32 PASS;
Chrome session 64012 running. No Web source edits this checkpoint.

Actual Web/Desktop CPU uint8 comparison measured initial alpha MAE product .474,
hair .709, soft-alpha .964; no full parity claim. Native Canvas preprocessing
matches browser within 1 channel unit across three fixtures. Background worker
now uses Canvas sampling and Web mask quantization. New full-worker comparison
session 23476 running: product .0906, hair .1867, both improved but edge differences
remain. Keep synthetic fixture / CPU model scope explicit. Rebuild resources only
after all active checks finish, then verify isolated pack and native lifecycle.

Design resources: all four inspected, available but no new design skill audit
applied during engine/package work; see design-resources-current.md. Figma MCP
unavailable/no relevant file; project Playwright supplies actual browser evidence.
Latest website QA 26 PASS; installed Explorer/login/upgrade/uninstall and other
platforms remain unverified. Legal/source/model grant, signing/notarization and
production license/payment/Cloudflare gates remain. Support replacement revokes
future issuance only; existing permanently offline Lifetime copies stay usable.

Next: finish parity results and final pack/candidate validation; add missing Web
controls and remaining Office engines; continue native shell/hosting and release
gates. Broad master and combined steering remain active.

### September 17, 22:34 NPT: final compact build, output comparison and site checks

Final Windows NSIS rebuild exits 0: 114,970,410 bytes, SHA-256
e42d4f0f00b97d60385e11efc0b92c3c307a61f7187ad2320db9a67725ee3799, NotSigned.
Local only, never installed/published. Current audit record compact-candidate-current.json.
Resource staging is byte-identical to tested pack (1,973 files, 315,985,262 bytes);
with native executable 320,772,462 bytes. Solid LZMA; shared WebView2 may need a
Microsoft bootstrapper download on clean systems. Packaged OCR/model are included.

Release native diagnostic: 3 view loads/2 closes PASS, observed first load <=2104ms,
host working-set peak 25,436,160 bytes. Excludes child processes, cold-cache and
sustained idle. Scripts measure-windows-candidate.ps1 and verify-windows-payload.mjs;
reports in desktop/audit. Current Rust suite: 37 PASS/one opt-in key-store ignored.
Source suite: 168 PASS/no skips. Reduced isolated current pack PASS. All six OCR
CPU variants independently recognize a fixture. UI 32 groups PASS Edge and Chrome.

Background Canvas comparison complete: alpha MAE .0906/.1867/.7467; foreground
IoU .9983/.9963/.9918. Max differences 124/128/160; no full parity claim. Ground-truth
mask scoring finds similar shared errors: soft alpha loses ~3.22% of intended mass.
Both outputs/montage visually inspected; fine-edge and photograph limitations stay.
Fixture hashes/provenance and before/after in background-removal.md and audit JSON.

Corrected stale public platform status on /desktop/download and stale prototype
count on /desktop; added WebView2 prerequisite disclosure. Production build PASS,
643 pages plus content/SEO/i18n/asset checks. Refreshed website QA 26 PASS; free Web
Unlock protected fixture PASS and stays independent. No public release/checkout.
Normal git diff --check PASS. No format-only rewrite or work reset.

Four external design repositories inspected/available as previously recorded;
no new design-skill audit claimed for copy/engine work. Figma unavailable/no file;
Playwright uses existing project runner. All platform/install/legal/account gates
remain. Device replacement policy unchanged and permanent offline limitation explicit.

Office feasibility: cached ZetaOffice has Node paths but browser-oriented metadata
loader. New development-only scripts/probe-office-node.mjs checks all four hashes,
uses local metadata shim and disables fetch. Total raw assets 262,261,407 bytes.
Initialization probe not yet successful; no engine count change. It is outside
shipping pack, no new dependency/browser. Latest diagnostic in progress; continue
Office feasibility/conversion before selecting architecture, plus other parity
controls and native shell/Cloudflare adaptation. Broad work remains active.

### September 17, 22:45 NPT: image adjustment parity and Office finding

Office WASM initializes under Node with a local metadata shim, but direct headless
conversion requires transferring #qtcanvas to browser OffscreenCanvas and times out
with document undefined. No PDF generated. 262,261,407 raw asset bytes; verified
hashes; no browser/dependency downloaded or shipped. office-engine-feasibility.md
and audit/office-node-feasibility.json record the result. No engine count change.

Image editor now reuses actual Web manual-adjustments.ts, generated by
sync-image-adjustments.mjs. Ten bounded controls, neutral defaults, disclosure/reset
in current form. Processing after geometry/before encoding, alpha preserved.
All 12 browser-vs-decoded-PNG cases pixel-exact (MAE/max 0); affected 8 tests PASS.
Source full suite session 99545 running; current resources session 69146 rebuilding.
Add adjustment check to isolated verifier, then validate latest native resources.
114.97 MB candidate predates this image-adjustment addition; do not claim it contains it.

Emil emil-design-eng skill at pinned MIT revision now used for scoped disclosure,
neutral-default/reset review; Before/After table in image-engine.md. No skill
installed/shipped. Other three resources remain inspected but unused for this step;
Figma unavailable. Chrome UI 33 groups PASS. Edge 92 initially could not click at
200% CSS zoom: isolated screenshot/hit test confirms old DOMRect pre-zoom vs visual
hit-test coordinate discrepancy. Test checks real target at scaled coordinates,
never force-clicks through obstruction. Edge rerun session 69813 pending.
Live image preview, interactive crop/signature and full Web parity still missing.

### September 17 continuation: adjustment candidate and Cloudflare foundation

Preserved all existing modified/untracked work. The image-adjustment candidate
build completed with exit 0: 114,955,350 bytes, SHA-256
5d72dd18f7e045ea90743614747077ec62d9822021f098e374076b3e16a8656d, NotSigned.
No installer executed or published. NSIS staging: 1,974 resources, 315,993,683 bytes,
31.67% below initial baseline; native executable 4,787,712 bytes; total 320,781,395.
Isolated adjustment pack PASS. Native release lifecycle: 3 loads/2 closes PASS,
first view <=1910 ms, 7811 ms total, host working-set peak 20,992,000 bytes over
61 samples. Excludes WebView children, installed state, cold cache and steady idle.
Current and historical audit JSON separated; compact-distribution.md updated.

Image source suite 170 PASS; expanded Chrome UI 33 groups PASS at five widths
and both themes, screenshots inspected. Existing Edge 33-group PASS retained.
No UI changes in hosting phase; website 643-page build/26-group QA/free Unlock
fixture remain latest evidence. Emil used for prior adjustment disclosure review;
Impeccable/Taste/Dick Wu inspected but unused in this hosting phase. Figma MCP
unavailable; installed project Playwright supplies browser evidence only.

Extracted license-service/ledger.mjs without changing existing Node entrypoint.
Added cloudflare/ SQLite transactionSync adapter, Fetch proof boundary, durable
HMAC rate limits, raw-signature webhook receipt/alarm transaction, resumable
bounded reconciliation and route-free Wrangler config. Actual local workerd
tests exercise signed grants, restart persistence, replay/limits, replacement,
encryption, all six plan caps, provider outage/redirect handling and real local
alarm failure/retry. Both integration groups PASS, no real provider calls.
Existing affected Node 41 tests PASS; full Desktop 172 PASS/no skips. Final
Worker follow-up tests PASS after webhook outage improvement. Wrangler dry build
PASS, 50.55 KiB / gzip 13.17 KiB; no deployment. Rust 37 PASS/one opt-in ignored;
direct-spawn wrapper captured exit 0 (PowerShell redirection wrapper returned 1
despite passing tests, so direct result is authoritative). git diff --check PASS.

Cloudflare foundation remains partial: support operator binding and redemption
identity/HTTP not wired, production load/backup/platform/account gates pending.
No production secrets, account sessions, DNS, payment, signing or publication.
New docs/cloudflare-license-adapter.md records architecture, evidence and gaps.
Permanent offline Lifetime copies still cannot be remotely revoked; replacement
blocks future issuance and reserves the approved seat. Free Web Unlock unchanged.

Next: finish private authenticated Cloudflare support operations; adapt redemption
hosting with verified identity; continue Office/editor/parity and installed native
validation. Master and combined steering remain active, not complete or paused.

### September 17, 23:10 NPT: private Cloudflare replacement binding

Added SupportOperations named RPC with no HTTP admin route, Ed25519 operator
proofs, two-minute expiry, durable nonces, server-derived operator and explicit
override role. SUPPORT_OPERATORS_JSON absent means disabled. Replacement uses
the existing ledger and provider flow; optional registered promotion authority
uses the existing encryption key. No deployed caller/real staff keys configured.

Actual second local Worker service binding tests PASS: tampering, expiry, replay,
unauthorized review overrides, idempotent fresh-proof retry, reserved replacement
activation and unchanged verifiability of old offline Lifetime copy. Holding a
refresh at provider validation while replacing the device proves final atomic
issuance refuses the stale valid response. Updated support/cloudflare docs.
Final dry build PASS; prior full 172-test result plus final affected integration
PASS. No extra packages or production operations. Next independent parity item:
metadata removal currently re-encodes every JPEG/WebP below Web's lossless subset.

### September 17, 23:18 NPT: lossless metadata parity and selected PDF images

Metadata now reuses actual Web segment/chunk logic when sRGB images need no
orientation/profile conversion. It decodes both sides and accepts the lossless
path only when pixels/dimensions match and checked metadata is absent. Re-encoding
fallback and per-result disclosure retained. Generator/shared module added without
new runtime dependency. Actual Chrome Web output bytes match Desktop JPEG/PNG/WebP
exactly, decoded max difference 0; provenance/hashes in audit/metadata-parity.json.
Five metadata tests PASS, full Desktop 173 PASS, Chrome UI 33 groups PASS. Generated
metadata pack 315,999,347 bytes/1,975 files; isolated pack PASS. Direct UI build exit 0.
The current 114,955,350-byte installer predates metadata/range additions.

PDF image export now accepts selected ranges plus JPG quality in the form; engine
validates actual source bounds, sorts by source order and retains original page
numbers in ZIP entries. Selected rendering budget with whole-source preflight.
Affected raster/OCR 10 tests PASS. Expanded 34-group Chrome UI running in session
73064. Latest verifier includes ZIP range/dimension assertions; rebuild generated
pack before running that new assertion. docs/pdf-image-export.md records scope.
No complete Web/cross-platform certification, installer execution or publication.

Cloudflare support dry build PASS at 74.25 KiB/gzip 18.65 KiB. No staff signing
keys, caller deployment or account changes. All four design sources retain prior
inspection status; no new aesthetic review, Figma remains unavailable. Existing
SoraFiles form controls used; keyboard/responsive/theme checks in project Playwright.
Next: complete current range UI/pack verification, refresh candidate when current
engine changes stabilize, continue missing Office/editors and redemption hosting.
