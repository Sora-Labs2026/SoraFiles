# Desktop owner configuration

No production values are populated. Keep secrets in the deployment secret store and signing systems, never in git, client environment variables, public assets, logs or desktop packages.

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

`license-service/catalog.mjs` performs read-only Dodo product checks before producing the verified six-plan configuration. It reads the currency, compares exact amounts in that currency's minor units, checks billing frequency, attached license entitlements, automatic key fulfillment and activation limits, and rejects price overrides or fixed-duration keys. Run this against the configured Dodo environment before exposing checkout or publishing pricing. Only synthetic API responses have been tested so far; a manually supplied `verified` flag is not live API evidence.

Provide server-only Dodo API credentials and webhook signing secret for the selected environment, product/entitlement IDs, and verify license email, invoice, portal and all subscription/refund events in test mode. The adapter defaults to `test_mode`. Do not perform production test purchases.

Current integration references: [license keys](https://docs.dodopayments.com/features/license-keys), [customer grants](https://docs.dodopayments.com/api-reference/entitlements/list-customer-grants), [subscription detail](https://docs.dodopayments.com/api-reference/subscriptions/get-subscriptions), [webhooks](https://docs.dodopayments.com/developer-resources/webhooks), [checkout creation](https://docs.dodopayments.com/api-reference/checkout-sessions/create). Customer grants replace the deprecated license-read API. A checkout return URL grants nothing.

## License-service deployment

Provision the first-party license-service hostname, HTTPS, persistent database, backups, trusted-proxy policy and ingress rate limits. Provision an Ed25519 signing key and key ID with rotation; embed only public verification keys in the app. Provision a separate random challenge HMAC secret of at least 32 bytes. This secret also derives the activation retry fingerprints: preserve it across replicas, restarts and database restores. A changed secret fails startup; rotation requires a planned ledger migration. Server clock must be reliable.

Trial activation still needs a server-verified stable subject provider. The service deliberately fails without one. A newly generated installation key alone cannot identify a reinstall; a plain email/installation ID from the client is not verified eligibility. The provider must supply an opaque subject hash, and its tokens need audience, expiry and replay validation.

HTTP endpoints and a durable webhook inbox/reconciliation worker exist and have local HTTP/restart tests. Production deployment wiring, trial-provider integration, Dodo timeout reconciliation and operational hardening remain implementation work, not owner setup.

## Signing and releases

Provision Windows Authenticode signing and the selected Linux/repository signing identity. September 13 owner steering chooses ad-hoc macOS signing and user-approved Gatekeeper first launch; an Apple Developer certificate is no longer required for that distribution path. Mac artifacts must explicitly state `notarized: false`, use the documented Open Anyway instructions and remain ineligible for unattended updates. Provision isolated release storage/CDN upload credentials and updater signing keys. Untested prototypes must not enter `releases/manifest.json`.

Actual installers must be tested on their declared OS/architecture/minimum OS. Unknown OS versions require manual confirmation; unsupported or security-blocked builds cannot become automatic fallbacks. Release notes, immutable artifacts, checksums, updater signatures and compatibility metadata must come from tested builds.
