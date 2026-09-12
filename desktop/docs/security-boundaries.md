# Desktop security boundaries and unfinished gates

## Implemented reference boundaries

Offline entitlements use Ed25519 compact JWS with an allowlisted algorithm/header, signing-key ID, issuer, audience, feature, device and exact plan/device-cap claims. Verification uses public keys and makes no network call. Trials last at most seven days; subscription leases end at the earlier of the paid period and 31 days. Lifetime has no expiry. A caller can supply the last trusted time for rollback checks.

The server authenticates its random device challenges with a separate HMAC secret. Device signatures bind action and complete allowlisted request fields; nonces are consumed in durable SQLite storage. File names, contents, pixels, extracted text and document metadata are rejected as license request fields. Webhook verification uses raw bytes, timestamp tolerance and Standard Webhooks HMAC framing; duplicate event IDs have a transactional receipt primitive.

Personal and Team activation caps are enforced inside SQLite write transactions. Dodo customer grants and subscription identity/state are fetched to establish authority. Dodo keys are not generated locally. Activation failure attempts remote cleanup; uncertain remote outcomes remain a production reconciliation gate.

Queue authorization runs at enqueue and immediately before execution. Expiry does not interrupt an already authorized job. Engines must stage and validate before calling the queue's commit boundary. Cancellation is refused once publication begins, so a saved output is not mislabeled cancelled.

The reference writer creates an exclusive staging file, validates it, and publishes without replacing an existing path. Collision suffixes are deterministic. It refuses symbolic-link output directories, unsafe names, empty/oversize output and missing validation. It never intentionally overwrites the input.

## Still release-blocking

- Windows current-user DPAPI roundtrip/tamper tests pass in a native prototype. OS key storage, persistent trusted-time storage and secure boot/restore behavior are not integrated into a production app. Editable preferences are not acceptable storage for these values.
- The portable writer does not pin every ancestor with native directory handles. The Windows prototype does pin local ancestors and renames the validated open staging file by handle; concurrent collision, cancellation and ancestor-rename tests pass. Production integration, reparse-point adversarial coverage, non-NTFS volume testing and equivalent macOS/Linux implementations are pending. Portable hard-link publication fails safely on unsupported filesystems.
- Signature classification establishes likely content type, not full file validity. Full bounded decoding remains mandatory. Legacy/ambiguous formats currently fall back to opening in the app; not every production format has a desktop classifier.
- The native IPC allowlist, request ownership, shell argument handling, file-handle passing, symlink/junction/network-path behavior and native update authorization require production implementation and adversarial tests.
- HTTP routing, strict body limits, socket-address rate keys, verified catalog fetching and durable webhook reconciliation have tests. Production deployment, provider-backed trial identity, cross-replica ingress abuse limits and reconciliation scheduling remain unfinished.
- Update manifest and artifact signatures, freshness, monotonic manifest sequence and installer hashes are verified cryptographically by reference modules. Native updater integration, protected rollback state, platform signature verification, signing pipeline and installers remain unfinished.
- All 26 processing tools, permission failures, batch output groups, accessibility and OS shell paths still require end-to-end testing.

## Unavoidable offline limits

A valid offline entitlement cannot learn about a remote refund, revocation or transfer while disconnected. Subscription leases bound that delay. A permanent Lifetime grant on an old offline device cannot be forcibly revoked when a seat is transferred; active server registrations can be capped, but permanent offline use on that old device is not technically preventable. The product policy must describe this without promising impossible enforcement.

Server trial history can prevent reuse of a verified subject. A user creating a new identity on a fully controlled machine remains an abuse-policy issue; this implementation does not claim invasive fingerprinting or perfect reinstall/crack prevention. Paid distribution also does not remove applicable source and redistribution obligations.
