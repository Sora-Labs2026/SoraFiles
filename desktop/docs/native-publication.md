# Windows output publication

The private Rust/Node pipe enables native publication only on Windows. Engines
still stage and validate their own output format, then provide the exact output
size and SHA-256. These requests never come from renderer IPC. The host accepts
only a generated staging name and a supported output extension in one of the
already-pinned source/destination folders. Requests and publication counts are
bounded.

Rust opens staging with read/delete access and read sharing only, rejects reparse
points, verifies the size and hashes the open file in bounded chunks. It then
uses `SetFileInformationByHandle` with replacement disabled. Filename collisions
receive numbered names. No close/reopen occurs between verification and rename.
Existing writers are refused; bytes altered before acquisition fail the hash.

The engine's existing queue commit boundary governs cancellation. Once publication
starts it completes and reports the saved file. An unexpected host/process crash
after rename but before acknowledgement can still leave a successfully saved file
without a delivered result; users should check the output folder after an
unexpected process failure. There is no persistent crash-recovery journal yet.

Tests exercise native collisions/original preservation, staging tampering, open
writers, invalid extensions/streams and escaped destinations, plus real offline
single and batch PDF processing through the private pipe. Full packaged native
smoke is recorded separately in the recovery ledger. Windows non-NTFS/removable
volumes still need testing. Administrator intervention, pre-existing writable
memory mappings and malicious engine-code execution are outside this guarantee.
macOS/Linux retain the portable no-overwrite writer pending native equivalents.
# September 23 filename termination correction

The new Office-output collision test exposed a pre-existing Windows rename bug:
the variable-length `FILE_RENAME_INFO` buffer had no explicitly allocated UTF-16
NUL after the path. Some filename lengths consumed all alignment padding, and
Windows could fail or create a name with trailing garbage. The buffer now reserves
and zeroes that terminator while `FileNameLength` remains the byte count excluding
it. No replacement or path-safety check was weakened. The regression exercises
multiple name lengths, DOCX/XLSX/PPTX and PDF/image extensions, Unicode names,
collisions, exact bytes and registered output lookup on actual Windows.

Current Rust suite: 38 passed, 0 failed, one opt-in credential-store test ignored.
Evidence: `.artifacts/recovery-20260923-native-publication-fixed.log`.
API reference: [Microsoft FILE_RENAME_INFO](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_rename_info).
Older installers lack this fix and must not be treated as current candidates.
