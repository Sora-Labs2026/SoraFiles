# Windows processing file handles

The Rust processing host now opens every selected input and every source/output
folder ancestor before starting the Node component. Folder handles permit child
file creation but deny deletion/rename of the folder. Inputs allow read sharing
and deny writes and deletion until the component exits. Errors and cancellation
drop all handles. Files already open for writing fail with a retry message.

Handles use `OPEN_REPARSE_POINT`; directory handles also use `BACKUP_SEMANTICS`.
Metadata is checked through the opened handle. Network/device paths, alternate
streams, traversal, junctions, symlinks and other reparse points are refused.
The number of retained handles and selected inputs is bounded. Handles remain
in the native parent and are not inherited by the processing child.

This protects ordinary Windows input reads and the folder chain during processing.
It does not prove immunity to an administrator, pre-existing writable memory maps,
or every filesystem-specific race. The Node engine stages and validates output;
the native parent then locks that file, compares its size and SHA-256 with the
validated bytes, and publishes the same open file by handle without replacing an
existing destination. A change between staging validation and native acquisition
fails verification. See `native-publication.md`. macOS/Linux still use the
portable writer and need equivalent native protection and platform testing.

Validation includes real Windows rename/write denial, hard-link writes, junction
ancestors/destinations, existing writers, partial-acquisition cleanup, and a real
offline PDF job through the Rust/Node private pipe. See the recovery status ledger
for collected results; source tests alone are not release certification.
