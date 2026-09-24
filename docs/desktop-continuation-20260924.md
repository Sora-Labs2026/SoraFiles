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