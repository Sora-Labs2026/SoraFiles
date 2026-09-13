# Dodo test setup

The owner created a separate SoraFiles business and completed KYC. Bank verification is pending the owner's support request about Nepal bank codes. Do not guess the bank code or submit the bank form. Continue in Test Mode only until live configuration is ready.

The SoraFiles business permits creating Test Mode products and license-key entitlements despite pending bank verification. This does not establish live payment or payout readiness.

## Observed test products

| Plan | Product ID | Final price including tax | License limit | Tax setting saved |
| --- | --- | --- | --- | --- |
| Personal monthly | `pdt_0NnTvPb8922QpCAJWCuZE` | USD 4.99 each month | 1 device | Yes |
| Personal annual | `pdt_0NnTvxruqRnPjuXzhrQIA` | USD 49.99 each year | 1 device | Yes |
| Personal lifetime | `pdt_0NnTwVBa47Iysdcg6qVEJ` | USD 249.99 once | 1 device | Yes |
| Team monthly | `pdt_0NnTwtIRD7LXRudiDJStr` | USD 19.99 each month | 5 devices | Yes |
| Team annual | `pdt_0NnTxwrsnZ6OkMw7bXQYG` | USD 199.99 each year | 5 devices | Yes |
| Team lifetime | `pdt_0NnTyaSpjgO3GkG5GcuL7` | USD 999.99 once | 5 devices | Yes |

Products use the SoraFiles brand, Digital products category, automatic license-key fulfillment, and no introductory checkout trial. The separate verified seven-day app trial remains a licensing-service feature. Subscription key duration is unlimited in Dodo configuration because Dodo ties key validity to subscription status; this does not grant lifetime access. Localized pricing and automatic product discounts are disabled. Normal discount codes belong in checkout.

The owner explicitly requires the approved amounts to be final customer prices, with applicable tax included. All six saved products now include tax. Personal Lifetime's saved toggle was confirmed on a fresh edit-page load; Monthly and Annual updates completed successfully. The earlier save block no longer describes the current settings.

## Checkout evidence, September 13, 2026

Each actual Test Mode product checkout was opened, Australia was selected to exercise 10% GST, and USD was selected explicitly. The rendered summaries showed:

| Plan | Subtotal USD | Included GST USD | Final total USD |
| --- | ---: | ---: | ---: |
| Personal monthly | 4.54 | 0.45 | 4.99 |
| Personal annual | 45.45 | 4.54 | 49.99 |
| Personal lifetime | 227.26 | 22.73 | 249.99 |
| Team monthly | 18.17 | 1.82 | 19.99 |
| Team annual | 181.81 | 18.18 | 199.99 |
| Team lifetime | 909.08 | 90.91 | 999.99 |

These are agent-observed Dodo checkout figures, including its rounding. No customer contact details, payment details or purchase were submitted during these price checks. The owner subsequently reported creating promo/discount codes and using them in Test Mode checkouts. Record that as owner-reported manual discount validation; exact code types, plans, resulting invoices and license delivery have not yet been independently checked.

Dodo's [FAQ, Q140](https://docs.dodopayments.com/miscellaneous/faq) says Test Mode suppresses transactional emails, including license-key emails, while webhooks still trigger. The owner's missing test email is therefore expected and is not evidence of broken email configuration. Email delivery remains a separate live launch check. The FAQ suggests a live 100% discount for complete email-flow testing, but no such live test has been performed or authorized here. Keep the bank form untouched and continue Test Mode work.

Dashboard inspection after that report found one active Personal Monthly subscription license, created September 13 at 03:48 in the dashboard display, with instance count 0, activation limit 1, and expiry tied to the subscription. No key value was copied or exposed. This proves issuance for that test purchase, not device activation. The FAQ's broader wording about no key generation does not match this observed account result; rely on the actual license record for issuance and keep email delivery separate.

Static product links can automatically switch currency when the billing country changes. The server adapter now requires an explicit verified `billing_currency` and sends `allow_currency_selection: false`; test that combination on actual API-created sessions before launch. The six observed products use USD. These static-link observations do not certify the API session path or every tax jurisdiction.

## Purchase return page

The configured `/desktop/purchase` route now exists locally. It displays a bounded returned key only on request, supports explicit clipboard copying with manual-copy fallback, and never treats `status=succeeded` as payment or entitlement authority. Parameters are removed in the document head before resource loading; the page has no analytics and uses `no-referrer`. The edge worker strips the query before forwarding to static assets and returns `private, no-store`. The service worker bypasses checkout returns and license-bearing URLs and advances its cache version to retire old navigation entries. This cannot remove an incoming URL already observed by a browser or hosting ingress; configure hosting logs to redact query strings before live use.

Validation: four return-flow/edge tests plus three service-worker tests pass. The built page was inspected through the browser in light and dark mode at the default desktop viewport and 320px width: URL scrubbing, hidden/revealed key, clipboard success, keyboard focus, empty reload and zero horizontal overflow were verified with a synthetic key. Controls have 48px minimum height. Production generated 642 pages; all production validation checks passed after registering this sensitive noindex route. No real key was used for this UI check. The route is not deployed yet.

The licensing catalog verifier requires `price.tax_inclusive === true`; absent or false values fail closed for every plan. Activation retry/restart handling and explicit checkout currency have local tests.

All six products and their six named license-key entitlements have been created. The owner approved the Test Mode API key and its write scope. The key was created and stored only in ignored private local configuration. The initial usage-limit approval block was subsequently cleared; all six products now pass actual API catalog verification. Native trial integration and deployed service configuration remain pending. These product IDs are test identifiers, never production configuration.

Reference: [Dodo license-key lifecycle and configuration](https://docs.dodopayments.com/features/license-keys).
Tax reference: [Dodo tax-inclusive pricing](https://docs.dodopayments.com/features/tax-inclusive-pricing).
Currency reference: [Dodo checkout-session configuration](https://docs.dodopayments.com/api-reference/checkout-sessions/create).

## Actual API and lifecycle verification

All six plans passed exact price, USD currency, tax-inclusive pricing, billing interval, automatic license fulfillment and device-limit checks against the Test Mode API. Verified entitlement mappings:

| Plan | Entitlement ID |
| --- | --- |
| personal-monthly | `ent_0NnTvJvpsmFg1WWK5CEo9` |
| personal-annual | `ent_0NnTvu01uiePzum0s3SAi` |
| personal-lifetime | `ent_0NnTwNd7EDh7sFJfbU7am` |
| team-monthly | `ent_0NnTwneyJJbODzy2bPaFn` |
| team-annual | `ent_0NnTxo8orvH4SI9EQQeOz` |
| team-lifetime | `ent_0NnTySqAGuALIFJiFXt3K` |

Using the existing owner-created Personal Monthly test license, the first-party local HTTP service and signed-entitlement client passed online activation, idempotent activation retry, offline authorization, refusal of offline activation, online subscription refresh, one-device listing, and rejection of a second device. The temporary activation was deactivated and the provider count was confirmed back at zero. Private state and raw keys remain in ignored `desktop/.local/` files. No purchase or email was submitted. This is actual provider integration evidence, not installed-app or production-host certification.

Six API checkout sessions were created with the verified USD currency and currency selection disabled. All six sessions were inspected with Australia selected and showed the approved totals including GST. A first-load country-detection race initially reset the Team selections; selecting Australia after the page initialized produced the same included GST figures in the table above. Existing static-link evidence above remains separate.
