# Desktop security boundaries and unfinished gates

## Implemented reference boundaries

Offline entitlements use Ed25519 compact JWS with an allowlisted algorithm/header, signing-key ID, issuer, audience, feature, device and exact plan/device-cap claims. Verification uses public keys and makes no network call. Trials last at most seven days; subscription leases end at the earlier of the paid period and 31 days. Lifetime has no expiry. A caller can supply the last trusted time for rollback checks.

The server authenticates its random device challenges with a separate HMAC secret. Device signatures bind action and complete allowlisted request fields; nonces are consumed in durable SQLite storage. File names, contents, pixels, extracted text and document metadata are rejected as license request fields. Webhook verification uses raw bytes, timestamp tolerance and Standard Webhooks HMAC framing; duplicate event IDs have a transactional receipt primitive.

Personal and Team activation caps are enforced inside SQLite write transactions. Dodo customer grants and subscription identity/state are fetched to establish authority. Dodo keys are not generated locally. A durable HMAC-keyed activation ledger reserves one provider call per license/device. Completed-response retries revalidate the same provider instance and fresh authority instead of consuming another slot. Network ambiguity, incomplete provider responses, interrupted reservations and failed compensation block automatic retry, including after restart. Provider-backed resolution of these blocked entries remains a production reconciliation gate. No raw license key is stored in the ledger. Refresh and completed retries cannot recreate a device revoked while provider verification was pending.

The challenge secret also derives activation fingerprints using a separate domain string. A non-secret keyed marker pins it to the database; startup fails on a changed secret rather than silently losing retry protection. All replicas and database restores must retain this secret. Planned rotation needs a ledger migration and reconciliation procedure before replacement. Do not delete reservations merely because they are old: a provider may have accepted a request whose response never arrived.

Queue authorization runs at enqueue and immediately before execution. Expiry does not interrupt an already authorized job. Engines must stage and validate before calling the queue's commit boundary. Cancellation is refused once publication begins, so a saved output is not mislabeled cancelled.

The reference PDF input reader allocates only the prechecked length within the remaining 256 MB aggregate job budget, reads at most 64 KB per chunk, checks cancellation between reads and probes for unexpected growth. Short reads, truncation, growth and metadata changes fail before processing. This closes the unbounded `readFile()` growth window; it does not replace native handle pinning or prove that a concurrently modified file was an immutable snapshot.

The reference writer creates an exclusive staging file, validates it, and publishes without replacing an existing path. Collision suffixes are deterministic. It refuses symbolic-link output directories, unsafe names, empty/oversize output and missing validation. It never intentionally overwrites the input.

Once publication succeeds, temporary-file cleanup failures cannot report the save as failed. The result carries `cleanupPending` and the writer makes a final best-effort cleanup attempt. The queue retains the actual committed result if subsequent engine housekeeping throws. Failed publication still fails the job; an existing destination is never removed. A temporary copy may remain when the OS denies cleanup, and native cleanup/recovery integration remains pending.

## Still release-blocking

- The native licensing bridge now stores device/license state in an authenticated encrypted file with an OS-held wrapping key. Windows credential-store roundtrip and the synthetic native-pipe trial/offline lifecycle pass. macOS/Linux credential-store checks, ancestor pinning and rollback/restore handling remain unfinished. See `native-licensing.md`. Editable preferences do not hold license material.
- The portable writer does not pin every ancestor with native directory handles. The Windows prototype does pin local ancestors and renames the validated open staging file by handle; concurrent collision, cancellation and ancestor-rename tests pass. Production integration, reparse-point adversarial coverage, non-NTFS volume testing and equivalent macOS/Linux implementations are pending. Portable hard-link publication fails safely on unsupported filesystems.
- Signature classification establishes likely content type, not full file validity. Full bounded decoding remains mandatory. Legacy/ambiguous formats currently fall back to opening in the app; not every production format has a desktop classifier.
- The native IPC allowlist, request ownership, shell argument handling, file-handle passing, symlink/junction/network-path behavior and native update authorization require production implementation and adversarial tests.
- HTTP routing, strict body limits, socket-address rate keys, verified catalog fetching and durable webhook reconciliation have tests. Device-bound trial issuance needs no sign-in provider. Production deployment, native paid-license integration testing, cross-replica ingress abuse limits and reconciliation scheduling remain unfinished.
- Update manifest and artifact signatures, freshness, monotonic manifest sequence and installer hashes are verified cryptographically by reference modules. Native updater integration, protected rollback state, platform signature verification, signing pipeline and installers remain unfinished.
- All 26 processing tools, permission failures, batch output groups, accessibility and OS shell paths still require end-to-end testing.

## Unavoidable offline limits

Paid seats are permanently device-bound and cannot be deactivated or transferred. A durable binding ledger retains each successfully activated device even after revocation, so revocation cannot free a seat for a replacement device. Provider compensation is limited to activation attempts that did not complete. A valid offline entitlement still cannot learn about remote refunds or revocation while disconnected. Subscription leases bound that delay; a permanent Lifetime grant cannot be forcibly revoked on a disconnected device.

The owner selected accountless, device-bound trials. Server trial history prevents restarting the trial for the same proved device key. A newly generated key can represent a new device; the implementation makes no reinstall/crack-prevention or invasive hardware-fingerprinting claim. The challenge HMAC secret also derives trial ledger subjects and must remain stable across replicas and restores. Paid distribution also does not remove applicable source and redistribution obligations.
