# Native licensing connection

The native interface now calls a restricted Rust licensing bridge for trial, activation, status, refresh, bound-device listing. An on-demand Node runtime communicates with Rust through private, bounded pipes. It exits after every action. Only public status fields enter the interface; private keys, license keys and signed entitlements remain in the native boundary.

Rust stores a random 32-byte wrapping key in Windows Credential Manager, macOS Keychain or Linux Secret Service through pinned keyring 4.2.0. Device and license state use an authenticated AES-256-GCM encrypted file with a fresh nonce for each atomic replacement. The parent acknowledges a protected write before the child proceeds. Missing, locked or damaged storage fails closed, with no plaintext fallback.

## Evidence

- The Rust integration test launches a real local HTTP license service with synthetic signing keys, starts a device-bound trial through the production private-pipe adapter, and writes encrypted state. Subsequent child processes authorize that saved trial after the service has stopped. Offline activation fails, preserving the existing trial. Modified ciphertext is rejected. The test uses an in-memory wrapping-key store; it does not claim OS-store coverage.
- A separate Windows test successfully saved and recovered a synthetic secret using the actual OS credential store, then removed its unique test entry. macOS and Linux OS-store interaction remains untested.
- JavaScript tests verify that protected device storage succeeds before any activation request and that the renderer receives no private state. Existing actual Dodo Test Mode tests verify paid activation, refresh, device caps, retries and cleanup through the first-party HTTP service; they do not establish native end-to-end paid activation.
- Current local checks: 100 JavaScript tests and 19 native tests pass; the OS credential-store test is deliberately ignored in unattended CI and was run separately on Windows.

## Remaining release work

The production license-service configuration intentionally has no verification keys. This candidate cannot activate against an undeployed service. Deployment, key configuration, webhook scheduling, ambiguous provider-call reconciliation and native paid-license lifecycle testing remain required.

The encrypted state currently checks its final folder/file against symlinks and reparse points. It does not pin every ancestor against concurrent replacement or prevent restoration of a complete older valid encrypted record. Persistent rollback handling and recovery policy remain unfinished. Accountless trial history follows the device key and does not claim reinstall prevention.

The licensing bridge is connected; the processing bridge is not. Runtime redistribution notices, all-platform secure-storage checks and installer lifecycle checks remain release gates. Candidate packaging alone is not a public release.

The owner-selected permanent binding policy removes all customer deactivation/transfer actions. A completed binding survives revocation and service restart; the native UI describes this before activation and on the active-license screen. A separate durable binding ledger enforces the total distinct-device cap.
