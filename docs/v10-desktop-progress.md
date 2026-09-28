# Desktop V10 integration — 2026-09-26

## Owner follow-up — 27 September

The full app now groups all 25 eligible tools into PDF, Convert, Image and
Security, using the website's membership. Category chips, scoped search and
keyboard launch remain connected to the original tools. Typography and spacing
use a consistent desktop scale; category cards align to one grid. Compact action
cards retain their separate dimensions and behavior.

Both file-manager integration and the sign-in helper default on for fresh
installations, with legacy and explicit opt-outs preserved. Separate confirmation
dialogs explain the effect of disabling each. Closing-window guidance is a
separate note. Windows Startup Apps disabling is respected. The installer offers
a restart only when its existing reboot flag is set and defaults to restarting
later.

The updated interface passed 39 fake-bridge checks and 16 compact-card checks.
Nine Windows startup/preferences tests passed in an isolated native harness;
Unix startup default checks are being added to the candidate validation. NSIS
compiled the actual installer hooks and restart finish page successfully. These
changes postdate candidate run 36278885929; that candidate must not be published
as containing these changes. Public release remains 0.1.0 until new packages pass
and are published.

## Handoff mapping

Inspected the exact extracted `sorafiles-tools-desktop-subpages-prototype-launchit-inspired-v2` handoff, including README, DESIGN_NOTES, COMPONENTS, QA_NOTES, semantic tokens, button styles and representative light/dark screenshots. The native utility keeps its current architecture, secure bridge, capability resolver and processing handlers.

- `desktop/ui/tokens.css` maps the locked Plus Jakarta Sans, neutral light/dark palette, monochrome actions, ink focus, radii and motion tokens to the existing native UI variable names.
- `styles.css` and `brand.css` preserve the compact utility density and quick-action card. Working surfaces have no yellow atmosphere or dot grid. Buttons/search are pills; panels use 16/22px corners. Shared `/icon-192.png` carries the amber app mark, supplied by the central brand migration.
- The full shell retains the native utility layout, simplifies its repeated license promotion to a quiet status, and groups Settings as Files & output, Quick actions and Appearance.
- Follow system now resolves the current OS theme and updates when the OS changes. Explicit overrides remain saved through the existing native settings contract. Changing OS theme updates tokens without replacing the working form.
- License copy now says “Works offline after setup.” and displays paid-through or lifetime duration rather than implying periodic internet use. Replacement verification, masked purchaser email, explicit exact fee and purchase authorization remain connected to existing handlers.
- Unlock PDF remains absent from Desktop. Processing options and engine quality were not changed.

## Trial correction

V10 supersedes the earlier Windows-installation trial rule. Windows NSIS post-install no longer invokes `--initialize-trial`; the unused early CLI initializer was removed. All supported platforms use the existing app startup `prepareTrial` and asynchronous `initializeTrial` flow.

The existing private `installedAt` storage field is deliberately preserved for compatibility. It now records first app launch for fresh installations. Existing deadlines—including deadlines created by the previous Windows installer—are not reset or extended. Offline setup retains the original deadline. Paid state is untouched. UI wording no longer says Windows starts at installation.

## Verification

- `node desktop/scripts/build-ui.mjs`: passed. The font URL is copied after the Vite build by the existing build script; browser QA confirms it loads.
- `node desktop/tests/ui-qa.mjs --desktop-only`: 38 checks passed, including all 25 eligible tools, option forwarding, password clearing, batch result handling, keyboard operation, 900/1180/1440/1920 CSS widths, light/dark themes, 200% scaling, theme-following behavior and local font loading.
- Five text/action/feedback color pairs meet 4.5:1 in both themes. The test now composites transparent dark feedback backgrounds over the surface before measuring contrast.
- `node desktop/tests/quick-action-ui-qa.mjs`: 16 checks passed at 520×400 and 440×320, both themes. Options survive a license update; Run/cancellation/results and explicit full-app opening continue to work.
- `node desktop/tests/replacement-ui-qa.mjs`: passed purchaser email verification, masked address, exact fee consent, native checkout and payment-status renderer flow.
- `node --test desktop/tests/native-license-host.test.mjs`: 6 passed. Added an explicit relaunch assertion preserving an existing first-launch/legacy installation deadline.
- Visually inspected full shell light/dark and compact watermark dark screenshots against the prototype's neutral dark workspace treatment.

Screenshots/results: `.artifacts/desktop-ui-qa-desktop-only/` and `.artifacts/desktop-quick-action-ui-qa/`.

## Remaining validation and boundaries

No deployment, installer installation, payment, DNS or provider settings were changed. UI tests use an explicit fake native bridge; they do not certify native dialogs or installed Windows/macOS/Linux behavior.

Follow-up integration reused the existing b86b toolchain through a workspace junction. `native-cargo.ps1 check --locked` passed; see `.artifacts/v10-native-check.log`. Full local Rust tests and local Windows packaging then stopped during compilation because the disk was full. Neither interrupted command establishes a passing package or test result. The new installer/launch behavior still needs installed-package validation.

Follow-up integration replaced the pre-existing `checkUpdates` “No releases published” response with opening the fixed public release-notes URL. The button reads “View release notes”; this does not implement an automatic updater.

Remote CI run `36256280892` for source `b48d3495dddc1b85cfdf6c0c63338822880a9710` passed the macOS ARM, macOS Intel and Linux jobs. Windows produced a candidate but failed its resource-staging verification. The overall run failed, and no new public release is certified by this document. See `ui-ux-full-product-audit.md` for the cross-product release gates.
