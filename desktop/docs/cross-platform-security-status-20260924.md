# Cross-platform security status — 24 September 2026

This is the security ledger for the current desktop candidate. “Implemented”
describes repository behavior; “tested” describes evidence that actually ran on
the named host. A package build does not certify the operating system's secure
store, installer, file manager, or update flow.

## Windows x64

- **Implemented and tested:** authenticated encrypted local license state with
  Windows Credential Manager wrapping; signed offline entitlement checks;
  bounded native IPC and shell argument validation; process-tree cleanup;
  staged output hashing and no-overwrite publication; package resource hashes;
  unsigned candidate packaging with automatic updates disabled.
- **Runtime evidence:** native Rust tests, synthetic Credential Manager
  roundtrip, registry migration/idempotency, helper smoke, and CI payload
  checks passed on Windows.
- **Pending:** clean install/upgrade/uninstall, installed Explorer invocation,
  updater integration, production trust keys, dependency/CVE and signing
  pipeline certification, and non-NTFS publication coverage.

## macOS arm64 and Intel

- **Implemented:** the same signed entitlement and bounded request model;
  Keychain-backed `keyring` path; Finder Service and LaunchAgent writers that
  stay per-user, reject foreign entries, and use atomic files; ad-hoc DMG
  packaging with minimum macOS 13.0. Automatic updates are disabled.
- **Tested:** CI builds, packaged resource checks, shell asset tests, and
  source-level Unix startup tests are present. This Windows host did not run the
  macOS secure store, Finder, LaunchAgent, installer, or desktop session.
- **Pending:** native Keychain roundtrip and lifecycle, Finder invocation,
  clean install/upgrade/uninstall, hardened runtime/entitlements review,
  Developer ID signing/notarization, updater integrity, dependency review, and
  production Office conversion.

## Linux x64 (Ubuntu 22.04 baseline)

- **Implemented:** the same signed entitlement and bounded request model;
  Secret Service-backed `keyring` path; Nautilus and KDE service assets; XDG
  autostart writer with per-user permissions, atomic replacement, and foreign
  entry protection; DEB/AppImage packaging. Automatic updates are disabled.
- **Tested:** CI DEB/AppImage builds, extracted payload/resource checks,
  Xvfb-native window and broker smoke, shell asset tests, and source-level Unix
  startup tests are present. No real Nautilus, Dolphin, Secret Service, or
  installed-package session ran on this Windows host.
- **Pending:** Ubuntu install/upgrade/uninstall, file-manager invocation,
  Secret Service roundtrip, desktop-session lifecycle, package permissions,
  updater integrity, dependency review, and production Office conversion.

## Shared residual risks

The Office WebView2 component remains a Windows development diagnostic and is
not shipped. No supported platform currently claims production DOCX/XLSX
conversion parity. Production license trust keys, real replacement email and
payment flows, installed-app acceptance, platform signing, and native updater
verification remain release gates. See the [release matrix](cross-platform-release-matrix-20260924.md).
