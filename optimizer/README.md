# SoraFiles constrained optimizer

This subsystem is a deterministic, default-deny optimizer for three jobs only:
performance, technical SEO, and GEO/structured-data verification. It does not
generate site code from visitor data and it has no path to user files, ads,
tool engines, visible copy, or normal-state styling.

The constitution is hash-pinned in `scripts/optimizer/core.mjs`. Recipes are
allowlisted and exact-targeted. Each application stores a bounded rollback
snapshot, runs the production build and verification gates, checks that all
non-target source files stayed byte-identical, then records a small
schema-validated outcome. A failed gate restores the previous source bytes.

The Optimization Knowledge Base stores only recipe IDs, aggregate evidence,
architecture fingerprints, confidence, and outcomes. It is capped, rejects
unknown fields and unbounded text, applies freshness decay, down-ranks evidence
from a different architecture, and fails closed on corruption.

Commands:

- `npm run optimizer:audit`
- `npm run optimizer:visual:baseline`
- `npm run optimizer:apply -- <recipe-id>`
- `npm run verify:optimizer`
- `npm run optimizer:visual:compare`

Deployment is deliberately outside the optimizer. A human-authorized release
uses the existing Cloudflare Worker workflow after all gates pass.
