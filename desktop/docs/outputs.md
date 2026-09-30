# Saved-output actions

The Rust host registers saved outputs in a bounded, in-memory ledger and exposes
only an opaque ID. Open result and Open containing folder accept that ID, never
a renderer-supplied filesystem path, URL, executable or command. IDs expire when
an idle window closes or older entries leave the 512-result ledger. Closing
during an active background job retains its results for the reopened view;
the next idle close clears them. See `background-processing.md`.

Before opening, the host checks the saved path remains a local ordinary file,
rejects symlinks/reparse points, and verifies size and modification time. Only
generated document/image/archive extensions are accepted. Windows invokes the OS
file association directly with ShellExecuteW; no command string or shell is used.
macOS/Linux have argument-vector launch adapters, pending native platform tests.

A missing/changed output does not turn earlier successful processing into a
failure. The user can inspect the output folder manually. This is not a pinned
handle guarantee against every same-user filesystem race, nor certification of
third-party viewer behavior. Actual installed viewer/folder-launch testing and
platform filesystem hardening remain release checks.
