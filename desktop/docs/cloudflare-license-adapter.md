# Cloudflare license adapter: local validation

September 17, 2026. This is a locally tested hosting adapter, not a deployed
service. The website Worker and its popularity D1 database remain unchanged.
No Cloudflare account/session, production secret, DNS or payment was accessed.

`license-service/cloudflare/wrangler.jsonc` builds a separate Worker with one
SQLite Durable Object class and a stable `license-ledger-v1` singleton. It has
no routes, workers.dev endpoint, account identifier or credentials. Test Mode
is the default. Do not deploy it as a replacement for the Node service yet.

## Implemented

- `ledger.mjs` contains the existing synchronous license ledger; `store.mjs`
  retains the Node 24 SQLite entrypoint. The Durable Object adapter uses
  `storage.transactionSync`, fully consumes SQL cursors, and obtains row counts
  from SQLite `changes()` rather than Cloudflare index-inclusive `rowsWritten`.
- Check-and-sign, nonce consumption, trial history, device caps, activation
  recovery, support replacement history and encrypted promotion tables retain
  their existing transaction boundaries. Provider calls stay outside transactions.
- Fetch endpoints preserve the native proof protocol, JSON/body limits, generic
  errors, Origin rejection and no public deactivation/replacement route.
- The edge hashes Cloudflare's connecting IP with an independent HMAC key,
  discards address/forwarded headers before passing to the object, and overrides
  any caller-supplied rate bucket. Persistent rate limits survive eviction/restart.
  The trusted ingress must remain Cloudflare; another Worker capable of setting
  connecting-IP headers must not be granted unreviewed access to this service.
- Verified webhook receipt and alarm creation commit together. Receipt acceptance
  does not depend on Dodo availability. Alarm work resumes a durable cursor in
  batches of ten bindings; a failed provider lookup cannot acknowledge the batch.
  A sweep acknowledges only its original receipt boundary. Retries schedule before
  external work. No raw webhook/customer payload or license key is logged.
- Catalog mappings are fetched/verified at use and cached for at most five minutes.
  Credentials remain server-side. Workers fetch uses an explicit wrapper and
  refuses redirects without following them or forwarding credentials.
- `SupportOperations.replace` is a named private service-binding RPC entrypoint.
  Its HTTP handler always returns 404. Each call additionally needs a configured
  Ed25519 operator signature over the exact request, license-key digest, nonce and
  a maximum two-minute validity window. The ledger consumes nonces durably.
  Operator identity and review-override permission come from server configuration,
  never a request field. It calls the same audited replacement implementation.
  Optional promotion encryption configuration enables existing giveaway authority
  for license verification; it does not expose campaign creation or redemption.

Existing permanently offline Lifetime entitlements cannot be remotely revoked.
Replacement records block future server issuance and reserve a replacement seat;
they do not disable the old offline copy.

## Evidence and limits

`node --test desktop/tests/cloudflare-license.test.mjs` runs the actual bundled
Worker in locally installed workerd/Miniflare with every outbound provider call
intercepted. Synthetic Dodo data and freshly generated test keys only. It checks
signed trial/permanent Lifetime grants, proof replay, persistent original trial
expiry, activation retry after restart, Personal cap, replacement reservations,
rollback/foreign keys, encrypted promotion storage, reconciliation recovery,
durable rate limits and forged headers, invalid bodies/origins/admin paths,
verified duplicate webhooks during a provider outage, and refused provider
redirects. All six Personal/Team plan caps are exercised against real workerd
SQLite. A test-only subclass executes the production alarm handler through actual
local alarm delivery: first lookup fails, a scheduled retry recovers, revokes the
server state, acknowledges the receipt and clears the alarm. Only retry delay and
provider authority are replaced in that fixture.

The support fixture calls the real named entrypoint through a second local Worker
service binding. Altered signatures, expired proofs, replay and unprivileged review
overrides fail. A fresh proof for the same ticket retries idempotently; the approved
replacement activates and an unrelated device cannot take its seat. A refresh held
at provider validation while support replaces the device cannot issue a new grant
even when the previously valid provider response later arrives. The old permanent
offline entitlement remains verifiable. No support HTTP route is added.

The current lockfile supplies Wrangler 4.131.1, Miniflare 5.20260911.0-alpha and
workerd. The harness uses Miniflare's provided v4-options converter plus the v5
persistence setting; the old persistence option alone is silently ignored by
that converter. Restart assertions exposed and corrected that harness issue.
No extra dependency or browser was installed. This does not establish production
latency, billing capacity, live webhook delivery or real Dodo behavior.

Local build command:

```powershell
$env:WRANGLER_SEND_METRICS='false'
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config desktop/license-service/cloudflare/wrangler.jsonc --outdir .artifacts/cloudflare-worker-build
```

This writes only the local Worker bundle. Do not remove `--dry-run` without the
owner's authorization. The initial relative output path was corrected to stay
inside this workspace. No deployment occurred.

## Remaining hosting work

1. Connect an owner-authorized private operator caller to the named
   `SupportOperations` binding and provision its managed public-key allowlist.
   No public gateway or private signer is shipped/deployed. The Node support CLI
   cannot open Durable Object storage. Ambiguous original activation reconciliation
   needs its separate reviewed operator workflow.
2. Adapt redemption identity/HTTP handling and operator campaign provisioning.
   Promotion tables/encryption and optional registered promotion authority are
   compatible; public redemption is not yet wired into this Worker. No real campaign
   or license issued.
3. Test deployed alarm delivery/eviction, more concurrent activation/replacement
   cases, storage recovery/backups and a bounded load
   baseline. A singleton is deliberate for launch consistency; do not shard until
   atomicity and measured capacity justify it. Audit retention and cost need review.
4. Prepare reviewed environment-specific mappings and managed secrets, then obtain
   approval for a Test Mode deployment and real sandbox integration. Live deployment,
   DNS, webhook registration, Dodo catalog/currency and release signing remain gates.

Required managed values match the Node service: `DODO_API_KEY`,
`DODO_WEBHOOK_SECRET`, `ENTITLEMENT_ED25519_PRIVATE_KEY`, `ENTITLEMENT_KEY_ID`,
`CHALLENGE_HMAC_SECRET`, `RATE_HMAC_SECRET`; additionally `DODO_CATALOG_JSON`
contains the six reviewed mappings and `DODO_MODE` selects the matching environment.
No sample key or synthetic mapping is production-ready.

Support is disabled without `SUPPORT_OPERATORS_JSON`. Its private configuration
maps each key ID to `{operator, publicKey, canOverride}`; use internal staff handles,
Ed25519 SPKI PEM public keys, and explicit boolean review-override permission.
The signer stays only in the authorized support caller. Use
`supportReplacementMessage` to construct the exact signed bytes; packet fields
are `kid`, `nonce` (32 random bytes as base64url), `issuedAt`, `expiresAt`, `request`,
`licenseKey`, `signature` (Ed25519 base64url). `request` has `ticket`, `licenseRef`,
`oldDeviceId`, `newDeviceId`, `reason`, and optional `overrideTicket`. Do not include
an operator field: the server derives it. Retry with the same ticket and new signed
nonce. Do not put packets, keys or customer details in logs, query strings or Git.
The optional `SORA_PROMOTIONS_ENCRYPTION_KEY` is the existing 32-byte hex campaign
key; changing it makes stored giveaway keys unreadable.

Official references inspected September 17:
[SQLite storage and transactionSync](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/),
[Durable Object alarms](https://developers.cloudflare.com/durable-objects/api/alarms/),
[Node crypto compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/).
# September 23 local redemption validation

Recovered source already contained the disabled named `RedemptionGateway`,
`cloudflare/redemption.mjs`, optional identity binding and first-party edge route;
the earlier notes below predate that partial wiring. No real identity service,
campaign, secret or deployed service binding has been configured.

The website boundary now reads bounded JSON, allows only the expected public
session/grant fields, rejects inconsistent plan/device responses and emits its
own cache/security headers. It never forwards upstream cookies, redirects,
diagnostics or other private fields. Errors remain generic and successful grants
stay in the existing browser memory-only flow.

`node --test desktop/tests/cloudflare-redemption.test.mjs` passes against actual
local workerd SQLite and service bindings. Test-only identity and provider doubles
exercise the production redemption handler and PromotionService: identity failure,
forged fields, lost import response then restart/retry with the same encrypted key,
durable rate rejection, origin checks and disabled/missing identity configuration.
Every external network request is forbidden. Miniflare's own local-bridge Origin
guard is handled by a test-only header reconstruction before production code.
Fixture seeding is test-only and absent from production routes/configuration.
The provider double is not evidence of a live Dodo import or email flow.

Additional response-boundary tests: `desktop/tests/redemption-edge.test.mjs`.
No change to live account state, Dodo products, prices, webhook registration,
DNS, production deployment, recipient identity or campaign issuance occurred.
Production remains disabled pending verified identity and operator provisioning.
