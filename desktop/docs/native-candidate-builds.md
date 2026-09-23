September 23 owner clarification: proceed with Windows/macOS/Linux builds and launch without waiting for Apple notarization. Mac users may approve the app through System Settings → Privacy & Security → Open Anyway. This supersedes the September 17 notarization-only release policy. Ad-hoc Mac releases must disclose their signing status, include the first-party instructions and disable automatic updates. Functional results and pending platform checks remain reported separately.

# Native candidate builds

September 23 diagnostic correction: `run-native-smoke.mjs` now requires the
requested background or startup mode to be present in the native report, as well
as three loads and two close/reopen cycles. A release executable omits the
development-only background fixture and cannot certify background processing
merely by completing normal lifecycle checks. The regression test is
`desktop/tests/native-smoke-report.test.mjs` (one passing test).

> September 17 recovery update: current requirements and evidence are in `../../docs/desktop-implementation-status.md`. Historical results below were obtained on the previous PC and are not current release certification. Support-approved replacement is now implemented; see `device-replacement.md`. Production Mac releases require signing and notarization.


These builds evaluate the native host. They are not finished processing apps or approved public downloads. The release manifest stays empty until product, engine, licensing and platform checks pass.

## Windows development

Run `node desktop/scripts/build-native-ui.mjs`, then `./desktop/scripts/native-cargo.ps1 test` and `./desktop/scripts/native-cargo.ps1 build`. The helper uses project-local Rust and the Microsoft C++ environment at `C:\SoraFilesBuildTools`. It does not print inherited environment variables. On other machines, install the official Rust/MSVC prerequisites and invoke Cargo directly with `--locked --manifest-path desktop/native/Cargo.toml`.

Run `node desktop/scripts/run-native-smoke.mjs desktop/native/target/debug/sorafiles-desktop.exe` to exercise three native window loads with two close/reopen cycles. The diagnostic uses a hidden window and exits afterward. Its JSON records its narrow scope: it does not certify file processing, installer behavior, licensing or process-memory recovery.

For a local installer candidate, install the pinned CLI with `npm install --prefix .artifacts/desktop-tauri-cli --no-save --package-lock=false @tauri-apps/cli@2.11.4`, then run `./desktop/scripts/native-cargo.ps1 package`. This creates an unsigned Windows candidate, not a release-approved download. The build hook runs from the `desktop` directory; direct UI builds also work from the repository root.

The host permits only packaged app origins and refuses popup WebViews. Renderer event permissions are limited to subscribing/unsubscribing; native selection events cannot be emitted by the view. IPC rejects unknown fields/actions. Native dialogs are serialized and their results are discarded if the original window closed. Selection order is retained, with 256-file/512-MB limits and rejected empty, unreadable, linked or network inputs. Signature detection alone is not full document validation.

The launcher consumes absolute file arguments literally, optionally following `--open`, and forwards second-instance selections to the existing helper. macOS file-open events are wired to the same selection boundary. These routes open the independent interface and do not authorize processing. Explorer/Finder/Linux menu registration and actual shell invocation tests remain separate work.

The current local host saves theme and output preferences in its application configuration directory. Reads are bounded and validate version, fields and values. Replacement uses a uniquely created temporary file, a flush and rename; failed saves preserve the old destination. Final symlink/reparse locations are rejected, but ancestor paths are not pinned by native handles. This is ordinary preference storage, not a secret or entitlement store. Ten Windows unit tests pass, including persistence, malformed/oversized configuration and failed replacement. Diagnostics use defaults without modifying installed preferences. These additions are included in candidate c57a7a7 below.

The native content classifier adds GIF, TIFF, PSD, HEIC/HEIF and Word/Excel detection to PDF, PNG, JPG and WebP. Office inspection reads a bounded ZIP directory without decompression and refuses ambiguous, encrypted, multidisk, duplicate, traversal or oversized directory records. Header recognition is explicitly labeled `signature-only`; complete decoding still belongs to the processing engine. Three additional native tests cover image signatures, bounded HEIF brands, Office ambiguity and malformed/truncated inputs, bringing the local Windows total to 13.

The latest Windows diagnostic completed three loads and two close/reopen cycles at 1180×900 with no overflow. The sandboxed run stalled before WebView initialization; the normal-access run passed. This does not establish new processing or installation coverage.

## macOS and Linux build hosts

Latest submitted candidate: `c57a7a7eaeddd57da192b503926d53b4554620e4`, [run 34746167636](https://github.com/Sora-Labs2026/SoraFiles/actions/runs/34746167636). All four jobs completed successfully, confirmed by the subsequent authenticated status read after the owner changed their GitHub account. This candidate includes native preferences and expanded classification, but excludes subsequent local input-reader/publication fixes, expanded PDF/image engines, and device-bound trial/client work. Do not substitute its results for validation of those newer changes.

Candidate commit `fd102a46c8b8b95d209f73928d053dfce0bfd4ec` ran in [GitHub Actions run 34732669398](https://github.com/Sora-Labs2026/SoraFiles/actions/runs/34732669398). All four jobs completed successfully: Windows x64, Apple Silicon Mac, Intel Mac and Ubuntu x64. This verifies candidate packaging and the scoped checks below, not a finished product. Subsequent licensing changes have local tests but are not part of that candidate commit.

The Linux diagnostic originally inspected an unmapped GTK window and reported overflow. It now maps the window within a 1600-by-1200 Xvfb display and records viewport geometry after fonts load. The passing Linux evidence has three window loads, two close/reopen cycles, an 1180-by-900 viewport, zero overflowing elements, and no UI error. Windows and Mac diagnostics remain hidden. Diagnostic JSON is explicitly included in candidate artifact uploads.

The `Desktop native candidate builds` GitHub Actions workflow uses separate native runners for Windows x64, Apple Silicon, Intel Mac and Ubuntu 22.04 x64. It pins the Rust toolchain and lockfile, builds the independent UI, runs the shared/native tests, creates platform packages, then exercises the packaged Mac executable or native Windows/Linux binary. Linux uses Xvfb for the window test. Artifacts include checksums and scoped evidence and expire after 14 days. The workflow deliberately creates no public GitHub release.

An authenticated account with write access to the repository is needed to push the workflow and run it. Public build success alone is insufficient: packaged installation, file dialogs, drag-and-drop, tray support, shell actions, engines, permissions, accessibility and uninstall still need platform checks. Linux support is initially scoped to tested Ubuntu x64; additional distributions require their own checks.

## Historical macOS candidate distribution (superseded for production)

Both architectures use `signingIdentity: "-"` for an ad-hoc signature. The build checks that signature with `codesign --verify --deep --strict` and records Gatekeeper assessment. A Gatekeeper rejection of an unnotarized candidate is expected and must not be relabeled as notarization or OS certification.

For a verified published build, the installation help explains moving the app into Applications, trying to open it, then using System Settings → Privacy & Security → Open Anyway and confirming Open. This is a per-app approval; no global Gatekeeper disabling command is used. A damaged/harmful-app warning or managed-Mac restriction must not be bypassed by these instructions.

The previous release policy accepted this route with `signing: "ad-hoc"`, `notarized: false`, `installation: "gatekeeper-approval"`, `updaterEligible: false` and the exact first-party approval help link. Compatibility, supported architecture, independently verified hashes, security blocking and actual testing still apply. Signed automatic updater policy stays separate.

References: [Apple's opening-app guidance](https://support.apple.com/en-us/102445), [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/), [GitHub hosted runner platforms](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
