# Native candidate builds

These builds evaluate the native host. They are not finished processing apps or approved public downloads. The release manifest stays empty until product, engine, licensing and platform checks pass.

## Windows development

Run `node desktop/scripts/build-native-ui.mjs`, then `./desktop/scripts/native-cargo.ps1 test` and `./desktop/scripts/native-cargo.ps1 build`. The helper uses project-local Rust and the Microsoft C++ environment at `C:\SoraFilesBuildTools`. It does not print inherited environment variables. On other machines, install the official Rust/MSVC prerequisites and invoke Cargo directly with `--locked --manifest-path desktop/native/Cargo.toml`.

Run `node desktop/scripts/run-native-smoke.mjs desktop/native/target/debug/sorafiles-desktop.exe` to exercise three native window loads with two close/reopen cycles. The diagnostic uses a hidden window and exits afterward. Its JSON records its narrow scope: it does not certify file processing, installer behavior, licensing or process-memory recovery.

## macOS and Linux build hosts

The `Desktop native candidate builds` GitHub Actions workflow uses separate native runners for Windows x64, Apple Silicon, Intel Mac and Ubuntu 22.04 x64. It pins the Rust toolchain and lockfile, builds the independent UI, runs the shared/native tests, creates platform packages, then exercises the packaged Mac executable or native Windows/Linux binary. Linux uses Xvfb for the window test. Artifacts include checksums and scoped evidence and expire after 14 days. The workflow deliberately creates no public GitHub release.

An authenticated account with write access to the repository is needed to push the workflow and run it. Public build success alone is insufficient: packaged installation, file dialogs, drag-and-drop, tray support, shell actions, engines, permissions, accessibility and uninstall still need platform checks. Linux support is initially scoped to tested Ubuntu x64; additional distributions require their own checks.

## macOS distribution selected by the owner

Both architectures use `signingIdentity: "-"` for an ad-hoc signature. The build checks that signature with `codesign --verify --deep --strict` and records Gatekeeper assessment. A Gatekeeper rejection of an unnotarized candidate is expected and must not be relabeled as notarization or OS certification.

For a verified published build, the installation help explains moving the app into Applications, trying to open it, then using System Settings → Privacy & Security → Open Anyway and confirming Open. This is a per-app approval; no global Gatekeeper disabling command is used. A damaged/harmful-app warning or managed-Mac restriction must not be bypassed by these instructions.

The release policy accepts this route only with `signing: "ad-hoc"`, `notarized: false`, `installation: "gatekeeper-approval"`, `updaterEligible: false` and the exact first-party approval help link. Compatibility, supported architecture, independently verified hashes, security blocking and actual testing still apply. Signed automatic updater policy stays separate.

References: [Apple's opening-app guidance](https://support.apple.com/en-us/102445), [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/), [GitHub hosted runner platforms](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
