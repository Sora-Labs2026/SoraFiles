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

All four final CI jobs PASS (run35976479337). See desktop/docs/release-readiness-20260924.md. Final Windows CI artifact downloaded and SHA256 verified; index updated. Six existing Dodo TestMode licenseproducts reverified by read-only API. Six replacementproducts absent; exact definitions prepared in .artifacts/replacement-products-review.json and approval requested. Cloudflare browser signed in, licenseWorker absent, dashboard warns of5USD overdue balance; no payment attempted. CLI credential absent. Updated backend dry-run buildPASS. Emailprovider/sender question stillpending. No external mutation or release occurred.

## Billing cleared and test deployment prepared

The owner reported the $5 Cloudflare payment completed. The signed-in dashboard
now shows Workers Paid Active; the earlier overdue-balance blocker is superseded.
Prepared isolated `sorafiles-license-service-test` config, six verified catalog
mappings, separate Ed25519 and two independent HMAC secrets in ACL-restricted,
Git-ignored `desktop/.local/cloudflare-test-deployment/`. No secret values in logs.
Signing roundtrip PASS; environment-specific Wrangler dry-run PASS, 107.17 KiB
uncompressed / 25.25 KiB gzip. Production trust configuration unchanged.

Local one-off preparation script: `.artifacts/prepare-cloudflare-test-deployment.mjs`.
It preserves existing keys on repeat runs and never deploys. `secrets.partial.json`
does not contain the required real Dodo webhook secret; do not deploy it as a
complete service configuration. Public test keys are separate from release keys.

Wrangler login installed its official optional @napi-rs/keyring@1.3.0 backend for
Windows Credential Manager. OAuth consent is pending for account/user read,
Workers scripts write and background access. The owner was asked to authorize
that access and the prepared test Worker with a test HTTPS endpoint. Do not click
Authorize until answered. If the OAuth listener expires, restart the same scoped
flow after approval. Earlier six replacement-products approval and email sender/
provider questions remain unanswered. No account grant/deployment/DNS/publication
has occurred in this continuation.

The OAuth listener subsequently timed out without a grant; the expired consent
tab was closed. Restart the scoped login after the pending approval is answered.

## Approved Cloudflare test deployment completed

The owner explicitly answered option 1: approve Wrangler account/user read,
Workers scripts write/background access and the isolated test HTTPS deployment.
Scoped OAuth completed successfully with Windows Credential Manager storage.
The test-only config now enables workers_dev; no custom DNS or live route changed.
Worker `sorafiles-license-service-test` deployed at
https://sorafiles-license-service-test.sorafiles-com.workers.dev,
version `afe01a35-c319-4d54-8806-cf9663792428`, confirmed 100% active.
The four available secrets were uploaded as `secret_text` (names only verified).

Deployment log `.artifacts/cloudflare-test-deploy-20260924.log`; five deployed
HTTP probes PASS in `.artifacts/cloudflare-test-deployed-checks-20260924.json`:
health200, origin403, unknown route404, unsigned webhook400, incomplete provider
setup denies issuance400. The initial probe expected503 but inspection confirms
the transport maps untyped configuration errors to generic400; no runtime source
was changed, and evidence records the actual behavior. No license issued.

Normal license operations still need Dodo Test Mode webhook registration/secret.
Replacement products approval and verified email provider/sender remain pending.
Do not ask again for the completed Cloudflare access/deployment approval. OAuth
session ended successfully; auth tab closed. Existing website/live service unchanged.

## Dodo Test Mode integration completed

The owner's subsequent "continue everything"/"resume" continued the concrete
pending Dodo setup. Six fee products created and independently verified:
Personal monthly pdt_0NoHrpLLMcrpGhnaX79F4, annual pdt_0NoHrpPk6UKJcHBOMA1as,
lifetime pdt_0NoHrpVhY9m5fxdSmzYKp; Team monthly pdt_0NoHrpa0yDughTymHbcwS,
annual pdt_0NoHrpduhI73VwPBC2J7x, lifetime pdt_0NoHrphFi9g1fqoadaIcj.
Exact fees unchanged. No license entitlements or new checkout/payment.

Webhook ep_3Jljbt9uJjnOHhrZNOMrgNNfzEO created and enabled for the test Worker.
Its private secret is in ACL-restricted secrets.json and Cloudflare secret store.
Actual Dodo secret is 24 bytes. Fixed signing.mjs/server.mjs to accept strict
Standard Webhooks 24–64-byte keys, including malformed-key and tamper regression
tests. Eleven targeted tests PASS; additional Node deployment config assertions
PASS. Do not change SoraFiles' independent 32-byte challenge/rate secrets.

Deployed version 0dae0fcd-2afb-4d1f-a163-a5efdaee0671 with webhook secret and
replacement product mappings. Integration report:
.artifacts/cloudflare-dodo-integration-report.json. Ten checks PASS including
actual Dodo activation, retry, refresh, offline signed authorization, trial
expiration reuse, durable device listing and synthetic signed webhook/dedup.
One existing Test Mode license now retains one owned test device. State is in
desktop/.local/cloudflare-test-deployment/integration-state.json (private).
Do not blindly deactivate it or rerun the obsolete lifecycle script. Integration
script reuses this state and maps test transport without relaxing shipped origin.

Real Dodo-originated webhook delivery remains distinct from the signed probe.
Email unavailable: website Worker secret list empty; Resend browser logged out.
Provider/verified sender/credential-location question asked while recording work.
No account was created and no email sent. REPLACEMENTS_ENABLED remains false.
Production trust keys still empty and no public release completed.

