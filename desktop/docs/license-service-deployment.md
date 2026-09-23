# First-party license service deployment

The service has a Node 24 entry point and a container definition. It has not been deployed or verified behind production HTTPS. Dodo Test Mode remains separate from live sales. Product Info, Identity and Bank onboarding are verified per the owner. Product/checkout/webhook configuration is a separate gate.

A separate Cloudflare Workers/SQLite Durable Object adapter is now tested locally.
See [cloudflare-license-adapter.md](cloudflare-license-adapter.md) for implemented
paths, exact evidence and remaining operator/redemption hosting work. The Node
instructions below remain valid; neither deployment has been activated.

## Configuration

Copy `license-service/config.example.json` to private storage outside the checkout. Replace the database path with an absolute path on persistent storage and fill in the six verified Dodo product and entitlement mappings for the selected mode. Use `0.0.0.0` as the listener host inside a container, port 8788, and `https://license.sorafiles.com` as the public origin. Terminate HTTPS at a reverse proxy; do not expose the HTTP listener directly to the internet.

Set `SORA_LICENSE_CONFIG_FILE` to the absolute path of this private JSON file. Supply these values through the deployment platform's secret store:

- `DODO_API_KEY`: key for the same Dodo mode as the catalog.
- `DODO_WEBHOOK_SECRET`: the endpoint's `whsec_` signing secret.
- `ENTITLEMENT_ED25519_PRIVATE_KEY`: Ed25519 PKCS8 PEM, preserving its newlines.
- `ENTITLEMENT_KEY_ID`: identifier matching the public verification key distributed to the app.
- `CHALLENGE_HMAC_SECRET` and `RATE_HMAC_SECRET`: two independent random 32-byte secrets, each encoded as 64 hexadecimal characters.

Do not place these secrets in public environment variables, Git, desktop resources, screenshots or logs. The example JSON deliberately has no secret values or trial-policy switch. Trials use device proofs and signed seven-day entitlements with no third-party sign-in. Paid seats are device-bound with support-approved replacement through the authenticated server CLI; see device-replacement.md. No public deactivation route is exposed.

## Runtime and storage

Run `node desktop/license-service/server.mjs` with the private configuration set. The server validates configuration and fetches the six Dodo catalog entries before binding. Reconciliation starts only after the listener is ready. SIGTERM and SIGINT stop accepting work, finish or abort bounded requests, and close the database.

Build the container with `docker build -f desktop/license-service/Dockerfile -t sorafiles-license-service desktop`. The build context excludes local credentials and desktop assets. Mount the configuration read-only, and mount a separate persistent directory for the SQLite database and its WAL/SHM files. The container runs as UID 1000; provision that directory with write permission for that user. Use one service instance for this SQLite deployment, not independent replicas with separate disks. Back up the database using SQLite's online backup facility or while the service is stopped; copying only the main file during active writes is not a consistent backup.

The container health probe uses port 8788 and `/health`. A healthy process alone does not prove correct webhook delivery, catalog prices, activation, trial issuance or signed offline use. Configure the reverse proxy's request limits and timeouts without retrying activation POST requests automatically.

## Deployment validation still required

Verify the container image builds, survives restart with persistent device bindings, and shuts down cleanly. Register the HTTPS webhook and verify signed delivery, duplicate handling and reconciliation. Exercise a real Test Mode checkout, online activation, signed offline access, and restart recovery against this deployed service. Publish only the public verification keys to the desktop trust configuration. Test each advertised OS's protected storage and paid activation before enabling downloads or live checkout. Production email delivery and independently verified live product/checkout configuration remain separate release gates; onboarding is already verified.
