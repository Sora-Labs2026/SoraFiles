# Windows login startup

The Settings checkbox opts in to a per-user Windows Run entry named
`SoraFilesDesktop`. It launches the quoted current executable with `--background`.
That mode creates the tray helper without a WebView; if tray creation fails it
opens the window so controls remain accessible. A second normal launch opens the
existing helper's window through single-instance handling. Full Quit ends it.

Nothing enables startup automatically. Settings reads the registered command
instead of trusting an ordinary preference. A conflicting command from another
installation is never overwritten or removed. Windows Startup Apps can separately
disable Run entries; this checkbox reports SoraFiles registration, not that OS
override. Diagnostic runs do not change the actual sign-in registration.

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
recovery work. macOS/Linux startup adapters remain unfinished.
