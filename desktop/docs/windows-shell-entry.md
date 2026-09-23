# Windows Explorer entry

The native module `desktop/native/src/shell_entry.rs` implements an explicit, per-user **Open in SoraFiles** action. It opens the selected file in the existing desktop import flow; it does not start processing, buy or activate a license, or offer Unlock PDF. Windows 11 may show the classic action under **Show more options**.

## Registration and ownership

Only an explicit Settings action should invoke `set_enabled(bool)`. Do not call it from app startup or installation. `capability()` reports Windows support; `enabled()` reads current registration and returns true only when every entry exactly belongs to the current executable. A partial set returns false, while an unfamiliar entry returns an error. Propagate errors to the Settings UI rather than claiming success.

All keys live under `HKCU\Software\Classes\SystemFileAssociations\<extension>\shell\SoraFilesDesktop` for `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`, `.heic`, `.heif`, `.tif`, `.tiff`, `.psd`, `.docx`, `.xlsx`, `.pptx`, and `.gif`. Extensions are discoverability hints; normal content validation still applies.

Each verb has exactly these REG_SZ values:

| Location | Value name | Value |
| --- | --- | --- |
| verb | default | `Open in SoraFiles` |
| verb | `SoraFilesOwner` | `SoraFilesDesktop.Explorer.v1` |
| verb | `MultiSelectModel` | `Single` |
| `command` child | default | `"<absolute current executable>" --open "%1"` |

The `command` child is the only allowed child and has no children of its own. The executable must be an absolute Unicode path without quotes or control characters. The command is a literal executable launch, without a shell or dynamic file-derived command construction.

Enable and disable preflight every entry inside the same Windows registry transaction as the writes. A different command, missing ownership marker, unexpected value, wrong registry value type, or additional child causes the entire operation to fail. No unfamiliar entry is overwritten or deleted. Missing entries can be added alongside exact owned entries. Disabling removes only exact owned verb and command keys; it leaves shared extension and `shell` parents intact. Any error rolls back all mutations. Windows registry transactions must be available; there is no nontransactional fallback. Successful changes notify Explorer that associations changed.

## Application and uninstall integration

Enable `winreg`'s `transactions` feature, declare the module, expose capability and read state, and call `set_enabled` only from an explicit native Settings request. Keep the existing `--open` parsing and second-instance forwarding literal. File import still needs to show the foreground desktop window and require the ordinary user action to process a file.

The uninstall integration should use a narrowly scoped `--remove-explorer-entry` executable mode that calls `remove_owned_entries()` before removing the application files. It should exit without opening the UI or initializing license/processing workers. Invoke that mode from the authorized uninstaller while the executable still exists, including silent uninstalls. This cleanup removes only exact-current-executable entries in one transaction; it skips and preserves other installations and unfamiliar/augmented trees so those entries do not prevent uninstalling this application. Actual registry access or transaction errors still fail and roll back the cleanup. The normal Settings disable action retains its stricter conflict error. Do not make the installer enable registration. A portable move or another install path is deliberately treated as a different owner. This module alone does not install an uninstall hook; that integration and an installed Explorer launch remain separate validation requirements.

## Tests

Six Rust tests cover literal quoting, opt-in/idempotent transitions, exact commands for all supported extensions, preservation of unrelated shared keys, foreign commands/markers/value types/extra content, partial registration repair, preexisting empty-key refusal, and rollback after several real registry writes/deletions. The uninstall test checks a mixed set of current/foreign/augmented entries, confirms Settings still refuses conflicts, verifies cleanup rollback after several deletions, and confirms uninstall cleanup preserves the foreign entries while deleting exact-current entries. Registry tests only use a freshly created UUID subtree below `HKCU\Software\SoraFilesTests\Explorer-<uuid>`. Their cleanup verifies that prefix and UUID. They never call the production public registration methods or modify real Explorer keys.

September 23 integration: the Settings toggle and validated IPC are connected;
`--remove-explorer-entry` runs cleanup before single-instance initialization, and
the NSIS pre-uninstall hook invokes it before deleting files. The native suite
passes 44 tests, with one optional credential-store test ignored. Desktop-only
mock-bridge UI QA passes 36 groups. No real Explorer keys were enabled by these
tests. Passing them establishes scoped registration and UI behavior; it does not
establish installed context-menu visibility or the Explorer-to-running-app
handoff. Those need a separately recorded desktop Windows integration run.
