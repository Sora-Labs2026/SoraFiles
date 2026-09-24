# Desktop continuation — 24 September 2026

Current scope is the user's native **Edit with SoraFiles** continuation. Preserve
the existing dirty main checkout. Desktop UI checks use `--desktop-only`.
Unsigned Windows/Linux and ad-hoc macOS candidates are authorized; macOS users
may approve the app in System Settings → Privacy & Security → Open Anyway.
Signing is not a requirement to resume candidate builds.

## Implemented in the current source

- Default-enabled file-manager integration with an optional saved preference;
  an explicit disabled setting survives upgrades and unrelated preference edits.
- Shared selection/action resolver with whole-selection compatibility, local
  entitlement checks, actual packaged tool inventory, direct safe defaults and
  interactive preloading. Unlock PDF remains excluded.
- Windows x64 IExplorerCommand DLL, isolated bounded menu broker, literal path
  forwarding, per-user COM/verb registration, transactional migration from both
  earlier single-file registrations, installer post-install and uninstall hooks.
- Finder Quick Action, Nautilus Python submenu and Dolphin action assets, with
  per-user ownership checks and native Settings integration. Actual Unix
  file-manager runtime behavior still needs validation.
- Direct native actions use the same `run_processing` path as the main app.
  Closing the view leaves the lightweight host; engines run on demand.
- Signed paid-period expiration, indefinite Lifetime time validity, jittered
  background validation, signed context-bound online denial, and silent failure
  when the network/authority is unavailable.
- Paid replacement server ledger, proof-bound request/status endpoints,
  ownership verification contract, exact six USD prices, verified payment
  reconciliation, duplicate/race handling and preserved replacement history.

## Verification so far

- Initial combined Node suite: 226 pass, one failure, one optional HEIC skip.
  The failure was an obsolete promotional 31-day expiry expectation. The updated
  test verifies the full signed period and exact expiry boundary; all five
  promotion tests pass. A complete rerun is in progress.
- Native Rust suite: 52 pass, zero fail, one explicitly ignored OS credential
  store test. Includes real transactions inside isolated registry UUID subtrees.
- Windows DLL builds; protocol bounds, Unicode/literal quoting, COM lifecycle,
  async state and fallback enumeration tests pass.
- Real packaged Windows broker passes single/multiple Unicode/space-path
  selections and preserves an existing response. Approximately 192–219 ms in
  this run. It correctly offers setup without a configured paid entitlement.
- Broker testing found a missing bundled `tool-metadata.json`; the packaging
  manifest now includes it and the validation/action modules. The isolated
  processing-pack verifier now also checks authorized JPG/PDF menus and the
  unlicensed menu through the private pipe.
- Last desktop-only browser suite: 36 passing groups; this is an explicit fake
  native bridge, not an OS integration certification.
- Previous CI commit `9d52a437d2ecce8e1f38e423b5a3c2624e84039a`, run
  `35914995364`: both macOS architecture jobs succeeded, Windows failed an LF
  normalization check, Linux built packages but failed strict payload equality.
  Those macOS artifacts precede the new native workflow.
- Linux artifact inspection confirmed four changed ELF binaries in AppImage,
  with appended `$ORIGIN` library paths. The new verifier independently applies
  the expected patch to original files with the same explicitly selected
  `/usr/bin/patchelf`, then compares exact bytes. It also runs packaged image
  codecs. This needs the next Linux CI run; it is not locally certified.
- Windows production packaging is rebuilding after the discovered dependency
  omission. Do not treat the first installer from this continuation as final.

## Outstanding work / external dependencies

- Complete latest packaging, isolated pack checks, native window smoke, DLL
  staging verification, artifact hashes and all-platform CI.
- Real installed Explorer selection/upgrade/uninstall checks; real Finder,
  Nautilus and Dolphin checks. Current automated checks are narrower.
- Customer Manage Devices / Replace Device UI and account handoff remain
  unfinished. The server identity-verification binding and six production Dodo
  products are not configured. Existing support-only UI copy is stale.
- Production `desktop/releases/license-service.json` has no public verification
  keys. A usable paid release needs the configured license service and public
  signing keys; never insert private signing keys into the app.
- No live Dodo products, payment transactions, Cloudflare deployment, public
  release or download deployment was performed by this continuation.
- Agent delegation failed with "Your workspace is out of credits." Local tools
  remain usable; work has continued locally.

## Workspace safety / resume handles

- Main and its ordinary index are unchanged. Candidate snapshots use an isolated
  `GIT_INDEX_FILE`; current candidate index is
  `.artifacts/candidate-edit-20260924.index`, based on `9d52a437...`.
- Candidate branch: `codex/desktop-native-candidates`. Never force-push or reset
  the user's main checkout.
- Build wrapper: `desktop/scripts/native-cargo.ps1 package`; it selects the
  existing private Rust toolchain and Visual Studio compiler environment.
- Logs: `.artifacts/edit-package-final-20260924.log`,
  `.artifacts/edit-all-node-final-20260924.log`,
  `.artifacts/dynamic-registry-tests-20260924.log`,
  `.artifacts/shell-broker-smoke-20260924.log`.
