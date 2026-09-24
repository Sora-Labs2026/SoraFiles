# Edit with SoraFiles on Windows

The x64 installer includes `sorafiles-explorer.dll` beside the application. A small
`IExplorerCommand` adapter receives the entire selection and asks a separate,
windowless application process for relevant actions. It loads no processing
engines into Explorer. Explorer's background state callback has a 1.4-second
broker deadline and a More options fallback. On Windows 11 the unpackaged
extension is available in **Show more options**.

Registration is per-user. Fresh installations and upgrades with no saved choice
enable it; an explicit disabled preference is preserved. Installation, first
launch and Settings use the same registration code. All supported extension
verbs and the owned COM class change in one registry transaction. Known prior
Open in SoraFiles / Edit with SoraFiles single-file verbs migrate only when their
exact command belongs to this executable. Foreign or augmented entries are
preserved. Uninstall removes only owned entries.

`build.cmd` compiles the adapter and runs protocol/COM lifecycle checks. Native
Rust tests exercise real registry transactions under fresh test-only UUID keys.
`run-shell-broker-smoke.mjs` exercises the packaged broker with actual files,
including Unicode names and multiple selections. These are separate from visual
Explorer and installed upgrade/uninstall certification.

Action invocation forwards literal paths to the application, which revalidates
the selection and entitlement before using the ordinary processing/output path.
Interactive operations preload the existing app tool; safe direct actions run
without a WebView. Closing the main window keeps the lightweight tray host
available; Quit stops it, and a later action may launch it again.
