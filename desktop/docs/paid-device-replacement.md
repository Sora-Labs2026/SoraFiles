# Paid device replacement

The desktop says “Verify your email to replace this device.” This flow adds no
general SoraFiles account. Dodo remains the commercial license authority; the
existing Cloudflare SQLite Durable Object owns verification and device bindings.
The support exception in [device-replacement.md](device-replacement.md) remains.

## Purchaser verification

The server maps the license-key fingerprint to its verified activation record,
revalidates the key and current Dodo grant, and retrieves that Dodo customer's
email. The client cannot supply an email or customer identity. Only a masked
address is returned. Codes contain eight cryptographically random digits, expire
after ten minutes, and are consumed once. Resending invalidates the previous
unconsumed code for that device. Limits persist in the ledger: five attempts per
code, a sixty-second resend delay, three sends per hour per license or device,
and six per customer. The ordinary ingress/device-proof limits also apply.

Codes and verification tokens are stored as domain-separated HMAC hashes, never
plaintext. A successful code creates a thirty-minute authorization scoped to
the proved new device, license key, license and one selected occupied seat.
Retries may resume that same replacement. They cannot authorize another seat.
The email address is used for delivery without being retained in the code table.
The app's private authorization and pending order live in encrypted native
storage; the renderer sees neither the code identifier nor the authorization.

Verification is required before checkout creation and before completion, even
when payment already succeeded. If authorization expires, another email code
resumes the same order without a second charge. A payment return URL grants no
access. The backend verifies provider payment data and releases the old binding;
the new device then obtains its ordinary signed activation.

## Fixed fees

| Plan | USD replacement fee per occupied seat |
| --- | ---: |
| Personal Monthly | 0.99 |
| Personal Annual | 9.99 |
| Personal Lifetime | 49.99 |
| Team Monthly | 3.99 |
| Team Annual | 39.99 |
| Team Lifetime | 199.99 |

Unused Team seats use ordinary activation without a replacement charge. These
six replacement products are one-time, tax-inclusive USD prices with no license
entitlement, subscription, discount, trial, or adjustable price. The backend
checks product configuration before creating checkout. The old device loses
online access after replacement; its existing permanently offline Lifetime
entitlement cannot be remotely invalidated.

## Cloudflare configuration

Keep `REPLACEMENTS_ENABLED` false until the environment's products and email
delivery are verified. In addition to the existing license-service settings:

- `REPLACEMENT_PRODUCTS_JSON`: map the six license plan IDs to six distinct,
  verified replacement product IDs from the same Dodo environment.
- `REPLACEMENT_EMAIL_FROM`: a verified sender such as `SoraFiles <support@example.com>`.
- `REPLACEMENT_EMAIL_API_KEY`: server-only Resend API secret. Never put it in
  Git, desktop resources, logs, public variables, or the renderer.
- `REPLACEMENTS_ENABLED`: set to `true` only in the reviewed environment.

`replacement-mailer.mjs` is the delivery adapter, with a fixed HTTPS endpoint,
bounded timeout, refused redirects and idempotency per verification request.
No email provider account, sender or production secret is provisioned by this
source change. Node runtime callers may inject a server-side `sendCode` adapter.
There is no `REPLACEMENT_IDENTITY` sign-in binding.

## Validation evidence and remaining deployment checks

Local tests cover the durable code ledger, resend/attempt limits, expiry,
single use, concurrent requests, masked responses, HTTP device proof, and the
actual workerd SQLite adapter. Combined service/client HTTP tests prove that
payment alone cannot finish replacement, and that renewed email verification
resumes a paid order and produces a signed activation without another checkout.
Desktop-only UI tests cover code entry, fee consent, native checkout opening and
payment completion with a synthetic native bridge.

Real email delivery, Test Mode checkout/webhooks, deployed restart recovery and
protected storage on each supported OS still require environment validation.
No live emails, payments, products, deployments or public releases were created
by these local tests.
