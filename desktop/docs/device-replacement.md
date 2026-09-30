# Support-approved device replacement

September 17 owner policy: support may replace a lost, stolen, failed, reinstalled
or upgraded device. **A permanently offline device with an existing Lifetime
entitlement cannot be remotely revoked.** This procedure revokes the old server
activation and prevents future entitlement issuance; it does not disable the old
offline copy. Subscription grants can also remain usable until their signed expiry.

Use an authenticated server service account and a verified support case. Verify
purchase ownership through the existing billing/support process. Do not request
passwords, API secrets or license keys in public chat. Obtain the replacement
device's public-key identity through its Desktop support details.

The private request JSON contains `ticket`, `operator` (an internal staff handle),
`licenseRef`, `oldDeviceId`, `newDeviceId`, and `reason` (`lost`, `stolen`,
`hardware-failure`, `reinstalled`, or `upgraded`). No free-text customer data is
stored. Optional `overrideTicket` references a distinct second support review.

Default allowance is two replacements per paid seat per rolling 365 days
(Personal two; Team ten). Replacing a replacement within seven days requires a
second support review. These are review thresholds, not a requirement to buy
again: a legitimate exception uses `overrideTicket` with an audited reason code.
There is no customer-accessible or HTTP admin endpoint. The Cloudflare adapter
also provides a private service-binding RPC with short-lived signed operator
proofs, durable replay protection and server-derived operator roles; see
[cloudflare-license-adapter.md](cloudflare-license-adapter.md). That binding is
locally tested but has no deployed operator caller or configured real staff keys.

Run `node desktop/scripts/replace-device.mjs /private/request.json` on the server
after the specific replacement is approved. Reuse its configured
`SORA_LICENSE_CONFIG_FILE`, `DODO_API_KEY`, and `CHALLENGE_HMAC_SECRET`; supply
`SORA_REPLACEMENT_LICENSE_KEY` through private process environment/secret management.
Do not pass key material as command arguments. The CLI prints only the ticket,
status and revocation limitations, and never sends an email.
For promotional licenses, also provide the existing
`SORA_PROMOTIONS_ENCRYPTION_KEY` so the same registered giveaway authority can be
verified. It does not issue or redeem a campaign through this command.

The transaction first blocks the old activation and retains its reserved seat.
It then validates/deactivates that exact Dodo instance. Once provider release is
confirmed, the seat is reserved specifically for the approved new device until
its ordinary signed activation completes. Personal remains one server-authorized
seat; Team remains five. Unrelated devices cannot steal a reserved replacement.
Old devices cannot reactivate or refresh. A provider timeout leaves the operation
pending, blocks the old server activation, and retains the seat. Retry the same
immutable ticket after inspecting provider status. Successful provider release
with a lost response is recovered by validating the old instance on retry.

`support_replacements` preserves operator, ticket, reason, keyed license digest,
old/new device IDs, provider instance, review override and timestamps across
restarts. Back it up with the license database. Never expose these rows publicly.
Automated tests use synthetic provider responses; real Dodo test-mode replacement
and support identity workflows remain release gates.
