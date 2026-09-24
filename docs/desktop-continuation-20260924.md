# Desktop continuation — 24 September 2026

Scope: native Edit with SoraFiles, desktop-only UI checks, all-OS packaging.
Unsigned Windows/Linux and ad-hoc macOS releases are authorized. Mac users may
approve installation in System Settings → Privacy & Security → Open Anyway.
Preserve the dirty main checkout and its ordinary index.

## Current implementation

- Default-on file-manager integration preserves an explicit opt-out. Shared
  whole-selection resolver uses local signed authorization and packaged tool
  inventory. Safe direct actions and interactive preloading share the main
  processing path. Unlock PDF remains excluded.
- Windows IExplorerCommand DLL with bounded separate menu broker, literal path
  forwarding, transactional per-user COM/verb migration and installer hooks.
- Finder Quick Action, Nautilus submenu and Dolphin action assets, with owned
  per-user installation. Linux AppImage registration retains the installed image
  path instead of an ephemeral mount path.
- Closing the window leaves the lightweight host; full Quit ends the process.
- Paid-period expiration, indefinite offline Lifetime validity, jittered online
  reconciliation, authenticated online denial, and offline tolerance on outage.
- Paid replacement with fixed six USD prices, provider payment verification,
  idempotent order/reconciliation, protected native state and desktop flow.
- Purchaser identity uses email, with no general account system. Server resolves
  email from Dodo customer/license records. Masked UI, ten-minute single-use
  eight-digit codes, HMAC storage, durable resend/attempt limits, scoped
  thirty-minute authorization. Payment cannot bypass verification. Renewing
  verification resumes the same paid order. See desktop/docs/paid-device-replacement.md.

## Verification at this checkpoint

- Full Node suite: 238 tests, 237 pass, zero fail, one optional HEIC fixture skip.
  Log: .artifacts/replacement-all-node.log.
- Native Windows Rust suite: 55 pass, zero fail, one unlocked credential-store
  test ignored. Log: .artifacts/replacement-native-tests.log.
- Desktop-only UI: 36 groups pass; additional complete replacement UI test passes.
  Uses a synthetic native bridge, not an installed-app certification.
- New combined real HTTP client/server tests prove email is required before
  checkout, payment alone cannot release the old activation, and renewed proof
  resumes the same paid order and performs signed activation without another charge.
- Actual local workerd SQLite tests cover the verification ledger and rate limits.
  External email and Dodo calls use test doubles, with external network forbidden.
- Windows DLL tests and real packaged menu broker previously passed, including
  single/multiple Unicode paths and existing-response preservation.
- Isolated processing pack verifies actual PDF, image, Office and OCR engines;
  native-menu probes found and fixed missing metadata/module packaging.
- Latest CI snapshot 9d5e680790ceddddcacdb1b55117ed0de52768df, run35954661205:
  macOS ARM package, ad-hoc inspection, exact payload/engine and window tests pass;
  Linux DEB/AppImage package, exact payload/engine and window tests pass.
  Windows failed one test comparing long vs8.3 paths; now fixed locally.
  macOS menu smoke selected files beneath /var symlink; fixture now canonicalizes.
  Linux broker initialized GTK without an event loop and timed out; broker now
  resolves Tauri resource/config paths without creating the GUI runtime.
  macOS Intel job was still packaging at this checkpoint.
- Latest local Windows installer is rebuilding with email and broker fixes:
  .artifacts/replacement-package.log. Earlier installers predate those fixes.
- Linux AppImage preservation wrapper skips RPATH mutation only for the four
  packaged upstream processing ELF files. All processing bytes remain exact;
  actual packaged Node/sharp/canvas execution passed CI. Other AppImage libraries
  still use the normal packager RPATH handling.

## Pending

- Finish current local package verification and next four-target CI run with
  email/broker fixes. Candidate artifacts are not yet a public release.
- Real installed Explorer/Finder/Nautilus/Dolphin interaction and per-OS secure
  storage/payment lifecycle checks. Automated component tests are narrower.
- Production desktop/releases/license-service.json still has no public keys.
  Provision the license backend/public verification keys before paid distribution.
- Email delivery adapter is implemented (Resend); sender/account/secret are not
  configured. Replacement products and deployment also need environment setup.
  Source config deliberately leaves replacement and redemption disabled.
- No live email, Dodo mutation/payment, Cloudflare/DNS deployment, public release
  or downloads deployment occurred in this continuation.

## Resume handles

Candidate branch: codex/desktop-native-candidates. Never force-push/reset main.
Snapshots use isolated GIT_INDEX_FILE; newest local index is
.artifacts/candidate-email-20260924.index based on9d5e680790ceddddcacdb1b55117ed0de52768df.
Build: desktop/scripts/native-cargo.ps1 package (private Rust and MSVC setup).
Tests: node --test desktop/tests/*.test.mjs; native-cargo.ps1 test.
## Later verification checkpoint

Candidate2dbe7c2ff05514fc8a6f0bd6a48e9d8da4bda740 / run35956151036:
macOS Intel, macOS Apple Silicon and Linux jobs all PASS, including packages,
exact engine payload/runtime, native window lifecycle and menu broker. Windows
passed237Node tests and55Rust tests but its PowerShell npm shim consumed the
Cargo argument separator. Workflow now invokes the pinned Tauri entrypoint with
Node directly. Latest candidate3453e39e4063cce2aecd3123d37bf3690cd4c2bf,
run35976479337, is in progress. Its only changes are the Windows invocation and
a passing isolated Classes-hive registry test; runtime source is unchanged.

Local Windows email/broker installer finished successfully:115132484bytes,
SHA-2565efa7a12afc2ac2d6e2c77f33eba00349d0f864271854b621b888dc4c930d6c1.
File:desktop/native/target/x86_64-pc-windows-msvc/release/bundle/nsis/SoraFiles Desktop_0.1.0_x64-setup.exe.
Payload equality PASS1990files; native window lifecycle PASS3loads/2reopens at
1180x900; actual Windows credential-store synthetic roundtrip PASS. Isolated
processing pack and replacement renderer QA PASS. Logs replacement-*.log.

Actual installer hooks migrated all14existing legacy Explorer entries, removed
only owned entries/class, reinstalled and repeated installation successfully.
Evidence:.artifacts/replacement-explorer-hooks.json. One earlier startup attempt
reported an update failure while packaging; it did not reproduce after packaging.
Do not conflate registry/COM/broker checks with real Explorer menu interaction.
Computer-use text observation worked; screenshot failed SetIsBorderRequired /
E_NOINTERFACE and Explorer keyboard navigation did not reliably take effect.
No complete native menu UI certification was obtained through that helper.

Three successful Unix artifact downloads were started under
.artifacts/replacement-platform-candidates-2dbe7c2/. AppleSilicon completed and
its DMG checksum matches the CI manifest; Intel/Linux downloads still in progress
at this checkpoint. Their current exec sessions87545and52425may need polling.

Pending user question: which email-delivery provider and verified sender to use,
and existing configuration location/secret name (never request raw secret text).
Default implemented adapter is Resend; no live mail or deployment has occurred.

## Final local handoff for this continuation

All five installer files are downloaded/built locally and their SHA-256 values
are verified. Index:.artifacts/desktop-candidates-20260924.md; machine-readable
manifest:.artifacts/desktop-candidates-20260924.json. All download sessions ended.

Latest run35976479337 for3453e39e4063cce2aecd3123d37bf3690cd4c2bf:
Windows, Linux and macOS Apple Silicon jobs PASS. Intel macOS is still running
its repeated native-test/build job. Its previous run35956151036 passed using the
same application runtime source; newest changes are workflow invocation and a
Windows-only registry test. No active local build or download remains.

Windows CI now confirms installer packaging, resource equality, native window
lifecycle and menu broker. Production email delivery/deployed activation/payment
checks remain blocked on server environment values, verified sender and products.
No release was published. The pending email-provider question remains unanswered.
