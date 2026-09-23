# Windows installation validation

`desktop/scripts/verify-installed-windows.ps1` is a read-only preflight. It pins
the installer SHA-256 supplied by the caller, fingerprints the generated NSIS
template, proposes a fresh target beneath the workspace's
`.artifacts/windows-install-validation/<run-id>/app`, rejects reparse ancestors,
and checks both registry views for existing SoraFiles installs and startup
values. It also checks known app-data/shortcut paths, running native processes,
and the precise WebView2 registry locations used by the generated x64 installer.
No installer, uninstaller, app, registry mutation, directory creation, or cleanup
runs in this script. JSON goes to stdout. Exit 0 means preflight ready; exit 2
means a conflict requires review; invalid input or a mismatched hash throws.

Run it from the repository using a separately verified candidate hash:

```powershell
& .\desktop\scripts\verify-installed-windows.ps1 -ExpectedSha256 '<64 hex characters>' -RunId 'candidate-20260923'
```

The output is an execution plan, not an installation pass. Rerun the preflight
immediately before any later installation; it cannot eliminate a concurrent
external change. A path outside standard locations with no registration cannot
be discovered exhaustively. Template fingerprints do not cryptographically link
the template to the installer; retain build logs and payload comparison evidence.

## Verified installer behavior

The generated `desktop/native/target/x86_64-pc-windows-msvc/release/nsis/x64/installer.nsi`
uses `currentUser`, HKCU application/uninstall registration, and x64 registry
view. `/NS` suppresses creation of new desktop/start-menu shortcuts. `/P` is
passive mode, `/R` launches the app after successful silent/passive installation,
and `/UPDATE` changes uninstall/shortcut behavior. The validation plan does not
use `/R` or `/UPDATE`. No file associations or deep links are currently generated.

Standard NSIS `/S` makes install/uninstall silent; `/D=<absolute path>` must be
last and unquoted, even with spaces. Uninstaller `_?=<absolute install path>`
must also be last and unquoted and prevents the temporary self-copy, enabling
the parent to wait for the actual uninstall process. These are documented in
[NSIS command-line usage](https://nsis.sourceforge.io/Docs/Chapter3.html#installerusage).
Never concatenate these commands through another shell. A PowerShell launcher
should pass a single `-ArgumentList` string, use `-WindowStyle Hidden`, and wait
for completion. The script deliberately only returns argument strings.

The generated uninstaller deletes its enumerated payload, verifies shortcut
targets before removal, and removes the uninstall registration. It may leave
its own running executable and the remembered install-location key. Recursive
app-data deletion is behind the interactive delete-data checkbox and is not
requested by the planned silent invocation. The project pre-uninstall hook
removes `SoraFilesDesktop` startup only when it equals the exact executable's
quoted `--background` command. Separately, the generated Tauri template removes
the legacy Run value named `SoraFiles Desktop` without an ownership check. The
preflight therefore refuses either existing Run value; startup conflict testing
belongs in a disposable Windows account/VM, not against the owner's registry.

## Required evidence after a future execution

Keep installation, extraction, native lifecycle, and shell evidence separate:

- Payload extraction: every installed payload file and native executable equals
  its staged SHA-256; record installed byte size including the uninstaller.
- Installation: installer exit code, exact target, HKCU install/uninstall values,
  absence of unexpected startup, and preserved preflight state.
- Native lifecycle: run normal lifecycle diagnostics against the installed
  release executable. Background-job and startup-helper fixtures exist only in
  debug builds; the runner rejects release results for those modes. Installed
  release processing, sign-in, tray menus and shell actions need separate tests.
- Shell integration: `/NS` intentionally excludes shortcut creation. Test normal
  shortcut creation and startup enable/disable/conflicts in a disposable account
  before claiming that integration works.
- Uninstall: recheck ownership and file inventory, invoke only the exact installed
  uninstaller, capture exit code and remaining files/registry. Never recursively
  remove a computed target or app data to manufacture a clean result.

No install/uninstall or shell pass is claimed by this document.

Later September 23 source adds an opt-in Explorer verb and native ownership-aware
cleanup invoked by the NSIS pre-uninstall hook. The preflight now also checks all
supported-extension verb locations in both registry views and treats any existing
entry as a conflict for a clean-install test. The release is rebuilding; rehash
the new artifact before using this plan. Registry unit tests do not substitute
for invoking the installed menu and uninstaller.

## September 23, 2026 preflight result

The unsigned 115,034,145-byte candidate matched SHA-256
`e953d13937333ec4dbf86441c38f21cd5b9fef86c799de4046f703f7f3560fcb`.
No SoraFiles application/uninstall/startup registration or running app was found.
The installer-visible shared WebView2 version was `153.0.4234.48`.
The preflight correctly returned `PREFLIGHT_BLOCKED` because
`C:\Users\Drishya\AppData\Local\com.soralabs.sorafiles.desktop` already exists.
Only its immediate directory names were inspected: `EBWebView`. Contents and
ownership were not inferred, and no files were changed or removed. The next
installation validation belongs in a disposable Windows account or VM with an
independently checked candidate hash and fresh preflight.

PowerShell 5.1 checks confirmed exit 2 and the exact conflict, rejection of a
mismatched SHA-256, rejection of a traversal RunId, and absence of the proposed
target directory after preflight. A Node-spawned Windows PowerShell check must
remove an inherited PowerShell 7 `PSModulePath` from the child environment, so
Windows PowerShell can resolve its own standard modules. Direct PowerShell 7
invocation also produced the same blocked report. No installation was executed.
