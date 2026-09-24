# Desktop release readiness — 24 September 2026

All four jobs in [CI run 35976479337](https://github.com/Sora-Labs2026/SoraFiles/actions/runs/35976479337)
passed for application snapshot `3453e39e4063cce2aecd3123d37bf3690cd4c2bf`:
Windows x64, macOS Intel, macOS Apple Silicon and Linux x64. The outputs are a
Windows NSIS installer, two macOS DMGs, and Linux DEB/AppImage packages.

The user authorized unsigned Windows/Linux and ad-hoc macOS distribution.
macOS installation guidance is System Settings → Privacy & Security → Open Anyway.
Automatic updates remain disabled for this channel. Signing is not the current
release blocker.

## Completed checks

- 237 Node tests passed, with one optional HEIC fixture test skipped.
- 55 native Windows tests passed in the application snapshot; the subsequent
  snapshot also adds a passing isolated per-user Classes-hive migration test.
- The actual Windows credential store passed a synthetic encrypted-state roundtrip.
- Desktop-only interface checks and the full synthetic replacement renderer flow passed.
- All platforms passed native window lifecycle and file-manager broker checks.
- Packaged resources and executable image engines passed verification. Linux
  checks extracted resources from the actual DEB and AppImage.
- Windows native hooks migrated 14 legacy entries, removed owned registrations,
  reinstalled them and repeated installation successfully in the actual user registry.
- Purchaser-email verification, durable limits, payment gating, expired-proof
  recovery and same-order completion passed real HTTP and local workerd tests.
- The updated Cloudflare Worker built successfully with `wrangler deploy --dry-run`:
  106.65 KiB before compression, 25.21 KiB gzip. No deployment occurred.
- Read-only Dodo Test Mode API checks reverified the six original license products,
  including exact prices, intervals, entitlement limits and currency.

## Confirmed remaining setup

The desktop trust configuration has no public signing keys. Paid activation and
trial issuance require the configured first-party license backend and matching
public verification keys in a rebuilt installer. Test keys must not become
production trust keys.

The separate `sorafiles-license-service-test` Worker is now deployed. The live
`sorafiles-license-service` is not deployed. The website Worker remains unchanged.
The owner reported paying the $5 balance on September 24; the dashboard now
shows Workers Paid as Active. Billing is no longer listed as a blocker. Wrangler
now has owner-approved OAuth access stored through Windows Credential Manager.
No browser credentials were extracted.

The six reviewed replacement-fee products are now created in Dodo Test Mode and
verified against exact USD amounts, tax-inclusive one-time billing, and absence
of license entitlements. Live products remain separate.

The verification-email adapter supports Resend, but no sender or delivery secret
is configured. The owner has been asked for the selected provider and verified
sender/configuration location. This is a delivery service choice, not a request
to add a SoraFiles sign-in system.

After billing was cleared, the separate `sorafiles-license-service-test`
configuration was prepared under ignored `desktop/.local/cloudflare-test-deployment/`.
It contains the six verified Test Mode catalog mappings and separate Ed25519,
challenge-HMAC and rate-HMAC secrets. The private folder has restricted Windows
ACLs; no private values are included in this report. The signing roundtrip and
independent-secret checks passed. The environment-specific Worker dry-run also
passed (107.17 KiB, 25.25 KiB gzip). Production trust keys remain unchanged.

Wrangler's optional Windows credential-store backend was installed using its
official login flow. OAuth was opened with account/user read and Workers scripts
write; Cloudflare additionally requests background access. Its final Authorize
action was explicitly approved and completed by the agent. Dodo's Test Mode
webhook secret has also been provisioned in Cloudflare's secret store. Email
delivery remains unconfigured; replacements remain disabled until it is verified.

The approved test Worker was deployed with its available secrets and HTTPS at
https://sorafiles-license-service-test.sorafiles-com.workers.dev, version
`0dae0fcd-2afb-4d1f-a163-a5efdaee0671`. Earlier boundary probes passed health,
browser-origin rejection, unknown-route rejection and unsigned-webhook rejection.
The follow-up deployed integration passed signed webhook acceptance, duplicate
deduplication, tamper rejection, signed trial issuance with stable expiration,
Dodo Test Mode paid activation, activation retry, refresh, one-device ledger
listing and offline authorization. The webhook probe was signed locally with the
actual endpoint secret; it does not establish a Dodo-originated event delivery.
One test device remains bound to the existing Test Mode license for continuation.
Evidence: `.artifacts/cloudflare-dodo-integration-report.json`.

Dodo supplies a 24-byte Standard Webhooks signing key. The backend's former
32-byte minimum incorrectly rejected it. A shared strict decoder now accepts the
standard 24–64-byte range and rejects malformed encoding. Eleven targeted
Node/HTTP/workerd tests passed, including signature/timestamp tampering checks.
Reference: [Standard Webhooks specification](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md).

Real email delivery, provider-originated webhook delivery, deployed replacement checkout, activation after
replacement, and secure-storage behavior on macOS/Linux still require validation.
Actual Explorer/Finder/Nautilus/Dolphin menu interaction remains narrower than
the automated broker/component evidence. Windows screenshot capture failed in
the available automation helper, so no full visual menu certification is claimed.

## Local artifacts

The local `.artifacts/desktop-candidates-20260924.md` index links all five files;
its JSON companion records full SHA-256 checksums, sizes and source snapshots.
Windows now points to the final CI installer, 115,129,004 bytes, SHA-256
`517a315b5d140c8d94727f3208d70bb122456993b697b86cea9aac43490bf9aa`.
The downloaded Unix files come from the preceding successful CI run with the
same application runtime source; the later changes affect Windows packaging and
a Windows-only registry test. Every downloaded checksum was verified locally.

No public app release, live payment, real verification email or custom DNS change
was performed. Only Test Mode products, webhook and backend were configured.
