# SoraFiles deployment continuity

The canonical workspace is the `SoraFiles` folder on the mounted USB volume labeled `Web Apps`.

## Production target

- Cloudflare Worker: `sora-files`
- Custom domains: `sorafiles.com`, `www.sorafiles.com`
- Configuration: `wrangler.jsonc`
- Static output: `dist/`
- Worker entry: `worker.js`
- D1 binding: `POPULARITY_DB` → `sorafiles-popularity`

Do not create a second Worker, guess bindings, or change DNS, D1, routes, KV, R2, or secrets during an ordinary application deployment.

## Fresh-computer procedure

1. Mount the USB volume and enter its `SoraFiles` folder.
2. Confirm `git status`, branch, remote, and `wrangler.jsonc` before editing.
3. Use the Node version in `.nvmrc` (22.13 or newer) and the committed `package-lock.json`.
4. Run `npm ci` only when dependencies are absent or stale.
5. Run the repository’s production build and verification commands.
6. Authenticate Wrangler interactively if required; never export browser cookies or commit credentials.
7. Deploy once with the existing `sora-files` configuration after the final gate passes.
8. Verify `https://sorafiles.com`, representative workflow routes, metadata, canonical/hreflang, sitemap, and privacy/analytics invariants.

Search-engine submission is optional and depends on owner-provided credentials in an untracked `.env.search.local`. A normal deploy must not fabricate or commit those credentials.
