# SoraFiles Desktop implementation

**Development in progress. No Desktop release, installer or paid checkout is published.** The existing free web app is separate. These files do not establish Windows/macOS/Linux product support.

## Current implementation

- `audit/inventory.json` inventories all 26 production tools, 29 direct dependencies, the production lock tree and local assets. Copyleft/source/codec/model clearance remains release-blocking.
- `prototypes/` contains Windows native WebView2 compatibility and native-helper lifecycle experiments. This is not the final framework selection or a website wrapper.
- `shared/` centralizes exact six plans, the 26-tool capability registry, offline entitlement verification and compatible-release selection.
- `core/` contains bounded content-signature classification, a job queue with cancellation/commit boundaries and a collision-safe reference output writer.
- Four headless PDF operations (merge, split, rotate, remove pages) are connected to the signed-entitlement reference queue. Independent validation checked 177 output pages. Native UI processing is not connected yet.
- `ui/` is the independent desktop interface with native file/folder-dialog bridge prototypes. Its light/dark colors are derived from the existing site tokens. It is not a wrapper around sorafiles.com.
- `license-service/` contains Dodo API/catalog verification, customer-grant authority mapping, durable activation limits, trial history, signed challenges, device proofs, signed entitlements, activation/refresh/deactivation HTTP endpoints and a durable webhook inbox/reconciliation worker. It is not deployed.
- `shared/update-trust.mjs` verifies signed manifest freshness/sequence, artifact signatures, compatible build identity and staged-installer hashes. Native installation, OS signature verification and persistent rollback storage remain pending. `releases/manifest.json` intentionally contains no artifacts.
- V3 adds Dodo checkout discount entry, encrypted one-time giveaway provisioning, private CLI administration, promotional entitlement variants and an optional first-party redemption HTTP listener. See `docs/promotions.md` for deployment gates and test scope.
- Five website development pages and a dismissible 3:4 homepage promotion are implemented locally. The promotion is disabled in publication configuration until the Windows/macOS/Linux launch is ready. Desktop pages remain `noindex`; downloads and checkout remain closed. The public Redeem page was removed by September 13 owner steering; normal promo codes belong in Dodo checkout. The Windows screenshot is a real development capture. No macOS/Linux screenshot or shell tutorial has been fabricated.
- `.github/workflows/desktop-validation.yml` prepares core and browser-UI checks on Windows, macOS and Ubuntu. `desktop-native-build.yml` additionally builds Windows NSIS, Apple Silicon/Intel macOS DMG and Ubuntu x64 DEB/AppImage candidates, checks ad-hoc Mac signatures, exercises native window recreation and records artifact hashes. Neither hosted workflow has run yet; candidate artifacts are not public releases.
- The premium design pass fixes native pending/focus handling, folder cancellation, selection-ID release, rejection feedback, dark status contrast, narrow-window Quit and reduced transparency. See `docs/premium-design-review.md` and `audit/premium-design-evidence.json` for scoped evidence and unfinished platform checks.

## Verified scope

Run `node --test desktop/tests/*.test.mjs`. Tests use synthetic keys, files and Dodo responses. No production charges, sandbox purchase or real license email was tested.

`audit/prototype-evidence.json` records native/offline workflow results, independent output checks, engine-asset hashes and helper measurements. The Windows prototype passed PDF generation, PNG output, OCR, DOCX-to-PDF and background removal. Every one of those five ran with remote engine downloads disabled in a fresh WebView profile. This is not an all-tool offline certification.

The native lifecycle prototype disposed the actual WebView and observed the browser process exit after each of two window closes; the native helper remained and could reopen the UI. It then exited. Explorer integration, login registration and uninstall cleanup have not been implemented or tested.

The native Windows filesystem prototype pins ancestor directories and renames a validated open file by handle without replacing existing files. Twelve simultaneous writes preserved the original and produced unique names. Validation failure, cancellation and attempted ancestor rename were tested. DPAPI protected a synthetic secret under the current OS user and rejected tampering. These components are not integrated into a production host yet.

## Architecture decision still open

The WebView2 experiment proves representative Windows engine compatibility. A compact native host with on-demand processing contexts is viable on this machine. Rust and Windows C++ build tools are now installed. `native/` contains a Tauri candidate with local assets, restricted IPC, native selection dialogs, opaque selection IDs and tray reopening after WebView destruction. Compilation and actual platform evidence are being collected; this does not yet establish macOS/Linux engine compatibility or a final framework decision.

The owner selected ad-hoc signing and Apple's per-app Gatekeeper approval for the initial Mac distribution. This route does not require notarization. Its release metadata must explicitly identify manual approval, link to `/desktop/help#macos-open-anyway`, and disable automatic updating for that artifact. Do not ask users to disable Gatekeeper globally. See `docs/native-candidate-builds.md` for build and validation steps.

Office alone fetched approximately 262 MB, excluding source packs and installer overhead. Local public assets add about 63.5 MB; background-removal model/runtime data adds more. These are uncompressed asset measurements, not installer-size claims. Evaluate signed optional offline engine packs before fixing the installer architecture.

## Next implementation gates

1. Complete redistributable engine/source/notice packs and packaging provenance. Pin the Office build and fonts; replace or license components where required.
2. Complete native filesystem handles, shell invocation, OS secure storage and signed-updater prototypes; choose the host only after the required prototypes.
3. Extract and validate the remaining 22 processing workflows; connect the existing independent desktop UI, native dialogs, licensed jobs, output actions and batch UX.
4. Deploy/configure the HTTP service, wire its reconciliation worker and trial identity provider, and finish Dodo timeout recovery. Run real Dodo test-mode lifecycle tests.
5. Build/test Explorer, Finder and supported Linux integrations, then installers, signing, update and uninstall flows on each claimed platform.
6. Publish Desktop pages, currency-verified pricing, checkout and real compatible artifacts only when the release gates pass.

See `docs/owner-setup.md` for configuration and `docs/security-boundaries.md` for remaining security work. No private credentials belong in this repository or in desktop bundles.
