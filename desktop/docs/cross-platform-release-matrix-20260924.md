# SoraFiles Desktop release matrix — 24 September 2026

This matrix is the release record for the current desktop candidate. A CI
package proves that a target can be built; it does not prove that the package
installs, that its operating-system integrations appear in the user's file
manager, or that its secure-storage and lifecycle behavior work on that host.
Those checks are called out separately below.

| Target | Baseline and package | Native integration, helper, and Office route | Evidence completed | Still pending before a supported release |
|---|---|---|---|---|
| **Windows x64** | Windows x64; NSIS installer; unsigned channel | Explorer broker and registration, per-user Run startup, tray/background helper, Credential Manager vault, native processing. Office metadata/PDF workflows are shared; DOCX/XLSX conversion is only a Windows development WebView2 diagnostic and is excluded from the installer. | Windows native tests, synthetic Credential Manager roundtrip, registry migration/idempotency, helper smoke diagnostic, package/resource and engine checks; CI package build | Install/upgrade/uninstall on a clean machine, sign-in startup and relocation, full Explorer visual invocation, accessibility/high-DPI pass, production trust keys and live licensing/email flow; production Office conversion route |
| **macOS arm64** | macOS 13+; DMG; ad-hoc signed (`signingIdentity: "-"`), **not notarized** | Finder Service asset, per-user LaunchAgent startup, Keychain-backed vault path, native file-open route. Shared metadata/PDF workflows are present; no production DOCX/XLSX conversion host is selected. | CI DMG build and shared/native checks; shell asset/template tests; startup unit-test coverage is present but was not run on this Windows host | Native macOS install/open and Privacy & Security guidance, Finder Service invocation, LaunchAgent lifecycle, Keychain roundtrip, file dialogs/drag-and-drop, crash/uninstall and accessibility checks; Developer ID signing/notarization and a production Office route |
| **macOS x64 (Intel)** | macOS 13+; DMG; ad-hoc signed (`signingIdentity: "-"`), **not notarized** | Same integration/helper and shared metadata/PDF route as arm64; no production DOCX/XLSX conversion host is selected. | CI DMG build and shared/native checks; shell asset/template tests; startup unit-test coverage is present but was not run on this Windows host | The same native macOS checks as arm64. CI architecture coverage is not a substitute for an Intel host run. |
| **Linux x64** | Ubuntu 22.04 baseline; DEB and AppImage; unsigned | Nautilus extension and KDE service-menu assets, per-user XDG autostart, Secret Service vault path, native file-open route. Shared metadata/PDF workflows are present; no production DOCX/XLSX conversion host is selected. | CI DEB/AppImage build, resource extraction and Linux/Xvfb window checks; shell asset/template tests; startup unit-test coverage is present but was not run on this Windows host | Install and launch on Ubuntu 22.04, Nautilus/Dolphin menu invocation, XDG autostart lifecycle, Secret Service roundtrip, permissions/desktop-session variants, crash/uninstall and accessibility checks; production Office route. No compatibility claim for other distributions or ARM. |

## Shared release gates

- Automatic updates are disabled for this channel. No platform is updater
  eligible until update metadata, signature verification and rollback behavior
  have been tested with the platform's release signing keys.
- The current macOS artifacts are ad-hoc and the Windows/Linux artifacts are
  unsigned. They are candidates for owner testing, not evidence of a trusted
  public release. macOS users need the documented **System Settings → Privacy
  & Security → Open Anyway** step for an ad-hoc build.
- The Office WebView2 host is a Windows development diagnostic only and is not
  included in installers. There is no production-fidelity Office conversion
  route for macOS or Linux yet; no platform is advertised as having that
  parity.
- The test license Worker and Dodo Test Mode paths have HTTP/workerd evidence.
  Production trust keys, real payment, verification email delivery and paid
  replacement activation remain release gates. The app must keep customer
  wording free of provider and internal security terminology.
- “Implemented” in this document means code or package support exists. “Native
  validation” means the corresponding host was actually exercised. The latter
  remains pending for macOS and Linux integrations and for several installed
  Windows paths listed above.

See [platform-policy.json](../releases/platform-policy.json) for the machine-
readable policy and [release-readiness-20260924.md](release-readiness-20260924.md)
for the evidence ledger and current blockers. The separate [security status
ledger](cross-platform-security-status-20260924.md) records credential,
IPC, packaging, signing, and updater evidence per OS.
