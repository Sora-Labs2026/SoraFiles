# Promotions implementation and release requirements

> September 17 recovery update: current requirements and evidence are in `../../docs/desktop-implementation-status.md`. Historical results below were obtained on the previous PC and are not current release certification. Support-approved replacement is now implemented; see `device-replacement.md`. Production Mac releases require signing and notarization.


## Checkout discounts

`DodoClient.checkout(productId, currency)` enables Dodo's hosted discount field. Amounts, percentage/fixed discounts, product eligibility, redemption caps, expiration and subscription cycles remain Dodo's responsibility. The six paid plans and their exact decimal amounts are unchanged. The request explicitly sets the verified billing currency and disables currency selection; launch still requires reading and verifying the actual configured catalog and checking API-created sessions.

No discount was created, no checkout was completed and no money moved in this work. Tests use a mocked Dodo transport. Owner configuration and a real Dodo test-mode purchase/discount lifecycle are required before checkout opens.

References inspected September 13, 2026:
- https://docs.dodopayments.com/features/discount-codes
- https://docs.dodopayments.com/features/checkout
- https://docs.dodopayments.com/api-reference/licenses/create-license-key
- https://docs.dodopayments.com/api-reference/licenses/list-license-keys

## Giveaway codes

Codes contain 128 random bits and are stored only as SHA-256 hashes. They are distinct from the 256-bit random actual license keys. Actual keys are encrypted with AES-256-GCM, a fresh nonce and redemption-ID authenticated data before the external request. The encryption key is supplied by server configuration; it is not a browser or desktop secret. Back it up with the database and plan a key rotation/migration before launch.

A SQLite `BEGIN IMMEDIATE` transaction assigns each code to one verified subject and Dodo customer. A short database lease limits concurrent provisioning. The external import always uses the same persisted key, customer, device cap and expiry. Dodo rejects duplicate imported keys. A lost response can be recovered by finding that exact key and verifying every field before returning it. A code retry by the same verified owner recovers the same license; it never creates another redemption. A different owner receives the same generic failure as an invalid code.

Dodo's current import endpoint accepts a supplied key; it does not generate one or send an email. Responses explicitly use `emailSent: false`. The current imported-license lookup uses the documented deprecated `/license_keys` API, narrowed to the registered customer, product and import source. Normal paid authority still uses customer grants. Verify imported-key behavior against Dodo test mode and migrate the fallback when an equivalent supported lookup is available; this is a release gate.

Both tiers support 30 days, 90 days, 365 days (one year), and Lifetime. The campaign chooses the entitlement; a browser cannot submit a plan, duration, device cap or Lifetime flag. Personal permits one active device, Team five. Support-approved replacement applies to promotional licenses too; see device-replacement.md. Temporary offline grants remain bounded to 31 days and the campaign access deadline. Lifetime has no expiration. An already-issued permanent offline grant cannot be recalled from a disconnected device; local administrative revocation blocks future SoraFiles activation/refresh, but does not erase old offline grants or currently modify Dodo's imported-key status.

Disabling a campaign prevents new claims. It preserves recovery of claims already accepted. Revoking a redemption blocks both recovery and new authority. Redemption timing is UTC epoch seconds. Campaign definitions are immutable except the enable switch; edits to tier/duration require a new campaign.

## Administration

There is no admin authentication system in this repository, so there is **no HTTP admin route**. Use `desktop/scripts/promotions-admin.mjs` on a trusted server account. Set `SORA_PROMOTIONS_DB` and `SORA_PROMOTIONS_ENCRYPTION_KEY` through the deployment secret manager. The latter is 64 hex characters (32 random bytes), separate from entitlement-signing and rate-limit secrets. Never pass secrets as command arguments.

Create a campaign from `desktop/config/promotion-campaign.example.json` after replacing the product ID and dates. Campaign creation through the CLI must be disabled. Then:

```text
node desktop/scripts/promotions-admin.mjs create campaign.json /private/campaign-codes.csv
node desktop/scripts/promotions-admin.mjs list
node desktop/scripts/promotions-admin.mjs enable launch-personal-lifetime
node desktop/scripts/promotions-admin.mjs disable launch-personal-lifetime
node desktop/scripts/promotions-admin.mjs revoke REDEMPTION_ID
```

The CSV contains unused codes, displayed only once. Protect its parent directory with owner-only permissions/Windows ACLs. The CLI opens it exclusively with mode 0600, never overwrites it and never prints its contents. POSIX modes alone are insufficient to configure a Windows directory ACL. The database and backups also require owner-only access. If CSV writing fails after generation, keep the campaign disabled and create a replacement; hashes cannot recover the lost codes.

CLI listings contain campaign IDs and counts, not codes, customer emails or keys. Audit rows contain event types, campaign/redemption IDs and timestamps. No raw request bodies are logged by the service. Configure the hosting ingress to exclude request/response bodies, authorization headers and redemption parameters from logs and analytics.

## Runtime and public page

`createLicenseRuntime()` optionally accepts `promotionConfig` with a 32-byte `encryptionKey` Buffer and a `verifyIdentity` function. The latter must validate a short-lived verified-email/account token and resolve its stable `subjectHash` plus actual Dodo `customerId` on the server. It must never trust the browser's email/customer string as verified ownership. This provider is not configured yet.

The runtime returns a separate `promotionServer`; bind it privately behind HTTPS on `/api/desktop/redeem` at the first-party origin. It accepts only JSON POSTs from `https://sorafiles.com`, has request/header limits, rejects extra campaign fields through the domain service, ignores forged forwarded IP headers, uses persistent rate limits and sends `Cache-Control: no-store`. Configure trusted ingress limiting before deployment; do not expose a private listener directly or trust arbitrary proxy headers. Native license endpoints keep their existing origin policy.

The September 17 recovery prompt restores secure redemption. `/desktop/redeem`
now has an honest prelaunch state with no code collection while
`releases/redemption.json` is disabled. It has no analytics, clears URL parameters,
and bypasses Worker and service-worker caching. No public navigation advertises an
active campaign. Normal purchase discounts still belong in Dodo checkout.

The enabled flow obtains a short-lived identity proof from the same-origin
`POST /api/desktop/redemption-session`, then sends only code and proof to the
existing redemption endpoint. The deployment must supply `issueIdentitySession`
to verify its HttpOnly account cookie and mint a proof accepted by `verifyIdentity`.
The session endpoint fails closed when this adapter is absent and ignores browser
email, customer, plan and device-limit claims. It is rate-limited and accepts only
empty JSON from the first-party origin. The actual identity provider is still
unconfigured; no permissive fallback exists.

The browser keeps returned keys in memory, offers explicit reveal/copy, clears
them on departure, and explains that no email was sent. Issuance remains disabled
until identity integration, real Dodo import/recovery tests and owner-approved
campaign creation pass. No actual campaign or production key was created.

## Validation

Tests cover all eight signed promotional entitlement variants, Personal/Team activation caps, code-versus-license separation, one-time assignment across 12 independent SQLite workers, invalid/future/expired/disabled campaigns, foreign-subject retries, client-controlled field rejection, lost Dodo responses, encrypted database storage, key-free audit data, persistent rate limits, same-origin HTTP bounds and secret-free error responses. They do not replace real Dodo test-mode or deployment verification.
