September 23 owner clarification: proceed with Windows/macOS/Linux builds and launch without waiting for Apple notarization. Mac users may approve the app through System Settings → Privacy & Security → Open Anyway. This supersedes the September 17 notarization-only release policy. Ad-hoc Mac releases must disclose their signing status, include the first-party instructions and disable automatic updates. Functional results and pending platform checks remain reported separately.

# Desktop owner configuration

No production values are populated. Keep secrets in the deployment secret store and signing systems, never in git, client environment variables, public assets, logs or desktop packages.

Product Info, Identity Verification and Bank Verification are complete per the owner. Do not repeat onboarding. Current independently verified billing state remains unconfirmed on this PC.

## Dodo configuration

Create separate test and live configurations. The six authoritative amounts are:

| Plan | Amount | Active devices |
| --- | ---: | ---: |
| Personal Monthly | 4.99 | 1 |
| Personal Annual | 49.99 | 1 |
| Personal Lifetime | 249.99 | 1 |
| Team Monthly | 19.99 | 5 |
| Team Annual | 199.99 | 5 |
| Team Lifetime | 999.99 | 5 |

The six SoraFiles Test Mode products were observed in USD with tax included. The currency must still be read and verified from the actual API products in each environment; do not treat a dashboard observation as live API verification. Pass that verified currency explicitly to `DodoClient.checkout(productId, currency)`. Product and entitlement IDs must be distinct for each plan. Configure recurring intervals and entitlement activation limits to match. Lifetime must have no expiry. One Team purchase has quantity one and permits five activations; do not multiply checkout quantity by five.

`license-service/catalog.mjs` performs read-only Dodo product checks before producing the verified six-plan configuration. It reads the currency, compares exact amounts in that currency's minor units, checks billing frequency, attached license entitlements, automatic key fulfillment and activation limits, and rejects price overrides or fixed-duration keys. Run this against the configured Dodo environment before exposing checkout or publishing pricing. Historical September 13 notes report that all six Test Mode products passed the API verifier; rerun current verification before enabling checkout. Live configuration still requires separate verification; a manually supplied `verified` flag is not API evidence.

Provide server-only Dodo API credentials and webhook signing secret for the selected environment, product/entitlement IDs, and verify license email, invoice, portal and all subscription/refund events in test mode. The adapter defaults to `test_mode`. Do not perform production test purchases.

Current integration references: [license keys](https://docs.dodopayments.com/features/license-keys), [customer grants](https://docs.dodopayments.com/api-reference/entitlements/list-customer-grants), [subscription detail](https://docs.dodopayments.com/api-reference/subscriptions/get-subscriptions), [webhooks](https://docs.dodopayments.com/developer-resources/webhooks), [checkout creation](https://docs.dodopayments.com/api-reference/checkout-sessions/create). Customer grants replace the deprecated license-read API. A checkout return URL grants nothing.

## License-service deployment

Provision the first-party license-service hostname, HTTPS, persistent database, backups, trusted-proxy policy and ingress rate limits. Provision an Ed25519 signing key and key ID with rotation; embed only public verification keys in the app. Provision a separate random challenge HMAC secret of at least 32 bytes. This secret also derives the activation retry fingerprints: preserve it across replicas, restarts and database restores. A changed secret fails startup; rotation requires a planned ledger migration. Server clock must be reliable.

The owner selected device-bound seven-day trials without third-party sign-in. The client proves possession of its Ed25519 device key; the service derives a domain-separated HMAC ledger subject and preserves the original deadline for that device across retries and restarts. No email, hardware fingerprint, editable device ID or chosen duration is accepted. Changing the device key can appear as a new device; this policy does not claim reinstall-proof eligibility. The native protected device-key storage and client bridge are connected; production configuration and all-platform lifecycle checks remain required.

HTTP endpoints and a durable webhook inbox/reconciliation worker exist and have local HTTP/restart tests. Production deployment wiring, native client integration, Dodo timeout reconciliation and operational hardening remain implementation work, not owner setup. No trial identity provider is needed.

## Signing and releases

The owner authorized unsigned Windows/Linux releases and ad-hoc macOS releases without waiting for notarization. Mac installation instructions must explain System Settings → Privacy & Security → Open Anyway and disclose the signing status. Automatic updates remain disabled for this release channel. Provision isolated release storage/CDN credentials; artifact verification and honest compatibility metadata are still required.

Actual installers must be tested on their declared OS/architecture/minimum OS. Unknown OS versions require manual confirmation; unsupported or security-blocked builds cannot become automatic fallbacks. Release notes, immutable artifacts, checksums, updater signatures and compatibility metadata must come from tested builds.

Paid device replacement uses purchaser email verification without a general account system; see [paid-device-replacement.md](paid-device-replacement.md) for the flow, fixed fees and server configuration. Support-approved exceptions remain available through the authenticated server CLI in device-replacement.md. Preserve the activation, verification and replacement ledgers. An existing permanently offline Lifetime entitlement cannot be remotely disabled.
