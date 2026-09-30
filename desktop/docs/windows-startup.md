# Windows login startup

Fresh installations enable a per-user Windows Run entry named
`SoraFilesDesktop`. It launches the quoted current executable with `--background`.
That mode creates the tray helper without a WebView, including when tray creation
fails. A second normal launch opens the existing helper's window through
single-instance handling. Full Quit ends it. File-manager integration defaults
on independently; its menu commands can cold-launch the app without this helper.

Existing preferences (including legacy files without a startup field) preserve
prior choices. Settings reads the registered command and Windows Startup Apps
approval state. An OS opt-out is never silently overwritten. A conflicting
command from another installation is never overwritten or removed. Disabling
either setting in the app requires its own confirmation, initially focused on
Keep enabled. Diagnostic runs do not change the actual sign-in registration.

PDF/image processing engines are separate from the short-lived license helper;
startup creates no processing job, file scanner or main WebView. A current
packaged-build idle measurement and actual sign-in test remain release checks.

The installer uses the NSIS reboot flag when an old Explorer extension remains
locked. Only then does its finish page offer Restart now / I'll restart later,
with later selected by default. Silent installation reports exit code 3010 when
restart is required; it does not restart the machine itself.

Unit tests use a unique disposable key under `HKCU\Software\SoraFilesTests`,
never the Run key. They exercise quoting, enable/disable idempotency and conflict
preservation. UI tests use the fake bridge; unavailable platforms keep the
checkbox disabled. Native compile/test results are in the recovery ledger.
The debug `run-native-smoke.mjs <exe> --startup-helper` diagnostic passes on this
Windows PC: it verifies the tray exists and no WebView exists after helper
startup, then opens and recreates the window twice. It does not enable a Run key
or simulate actual Windows sign-in.
An NSIS pre-uninstall hook removes the Run entry only if its command points to
the uninstalling executable. The hook is configured but installation/uninstall
execution has not been validated on this PC. Actual sign-in, installed executable
relocation and platform lifecycle tests remain required. No actual startup entry was enabled during this
recovery work. macOS and Linux now have equivalent per-user startup writers
(LaunchAgent and XDG autostart) with ownership checks; those adapters have source
tests but still require native desktop-session validation. See the platform
matrix for the current cross-platform release decision.
