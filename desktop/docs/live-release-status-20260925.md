# Live release status — 25 September 2026

SoraFiles Desktop 0.1.0 is published for Windows x64, macOS Apple Silicon and Intel, and Ubuntu 22.04 x64. Public downloads and SHA-256 checksums are listed at https://sorafiles.com/desktop/download/ and the immutable assets are attached to the GitHub release https://github.com/Sora-Labs2026/SoraFiles/releases/tag/v0.1.0.

The production Cloudflare Worker `sorafiles-license-service` is deployed at
`https://license.sorafiles.com` with `DODO_MODE=live_mode`, replacement requests enabled, and `REPLACEMENT_EMAIL_FROM=SoraFiles <no-reply@sorafiles.com>`. The latest verified deployment is version `719935b1-112d-4e31-9ed5-db4e3482f847`; `/health` returns 200 and the live checkout redirect creates a verified Dodo checkout for each published plan.

Configured production secret classes:

- entitlement signing key and key ID
- challenge and rate HMAC secrets
- live Dodo API key and webhook signing secret
- verified Dodo catalog and replacement-product mappings
- restricted Resend sending key for `sorafiles.com`

Completed provider setup:

- Live Dodo webhook endpoint `https://license.sorafiles.com/webhooks/dodo` (endpoint ID `ep_3JmzpODlhrLpZnyJt4NEPskKRbB`).
- Six verified live Dodo license products with automatic license-key entitlements (personal limit 1, team limit 5).
- Six verified live one-time replacement products.
- Resend `sorafiles.com` domain verified for `SoraFiles <no-reply@sorafiles.com>`.

Replacement requests verify the authoritative purchaser email before opening the one-time replacement checkout. Codes are short-lived, single-use, rate-limited and stored hashed; the UI masks the purchaser address. Payment alone cannot bypass verification.

The Windows NSIS installer and Explorer shell payload were reinstalled from the packaged artifact. The installed executable matches the packaged installer payload, and the Explorer COM registration points to the installed `sorafiles-explorer.dll`. Windows/Linux packages are unsigned by owner choice; macOS DMGs are ad-hoc signed and require the documented System Settings → Privacy & Security → Open Anyway step. Automatic updates remain disabled.

The desktop public trust key is in `desktop/releases/license-service.json`. Production must continue using the live Worker and live Dodo catalog; the old test Worker and test-mode catalog are not release endpoints.

## Purchase and email verification

The authorized owner purchase completed in live mode using a single-use 100% discount. Dodo recorded a successful $0 Personal Lifetime payment and created its permanent one-device license. The payment, license and entitlement webhooks returned 202. This verifies free checkout and license issuance, not a charged card transaction.

Dodo's customer email history initially appeared empty, then showed both the license email and payment receipt as Delivered. The license preview contained the correct purchased key, plan and permanent expiry. One requested resend completed. The owner subsequently confirmed that the email was in Gmail's Spam folder. No custom purchase-email backend was deployed: Dodo remains responsible for transactional purchase/license mail; Resend is used for purchaser verification during device replacement.

Spam/Junk reminders are published on the purchase, pricing and help pages. The desktop activation reminder is included in the current installed local candidate and requires the refreshed public package to reach customers. Website version `192ee12b-b625-48a1-8655-74792837ae35` is deployed at 100% and also replaces the static Desktop illustration with the homepage workflow animation, using Desktop-specific copy. Desktop-size light/dark, scene controls, automatic progression and reduced-motion checks passed.

## Current release candidate

The earlier rebuilt Windows candidate installed with exit 3010 because Explorer held its previous DLL. The final local candidate, including the Spam/Junk reminder, installed with exit 0. Installer SHA-256: `64262789cf1e610b67eaf0d87afb905bd60a33998a4d42061b0fc8e50db1c6df`, 115121966 bytes. Installed executable and Explorer DLL hashes match files extracted from that exact installer. Actual image-to-PDF actions from both cold and running app states produced PDFs beside the fixtures, preserved originals and created no SoraFiles foreground window; the final runs took 2.30 and 1.69 seconds. Separate engine tests verify multiple-page order, orientation, raster colors, filename collisions and rejection of tampered licensing.

The refreshed automatic-trial and silent-conversion packages are not yet represented by the public manifest at the top of this document. macOS/Linux candidates from run 36098262025 passed their platform checks but precede the latest silent-action and Spam/Junk text changes. Do not describe those existing public downloads as containing these later fixes.
