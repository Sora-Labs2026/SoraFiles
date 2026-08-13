# Contributing to SoraFiles

Thank you for helping improve SoraFiles. This is an early-stage project, so focused changes with clear evidence are especially valuable.

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before opening a pull request

1. Search existing issues, then use the bug or feature issue form. Open an issue before a substantial feature or architectural change.
2. Keep file processing browser-local. Do not add an upload API, remote processing fallback, account requirement, watermark, or paid infrastructure dependency.
3. Do not claim support for a format or behavior without a working implementation and a real-output test.
4. Never commit private documents, user files, credentials, access tokens, browser data, analytics exports, or production secrets.
5. Preserve existing public URLs, accessibility behavior, localization, and honest limitation copy unless the change explicitly addresses them.

## Development setup

Use Node.js 22.12 or newer and npm. The `.nvmrc` and lockfile define the supported baseline.

```bash
npm ci
npm run verify:ocr
npm run dev
```

No environment variables are required for ordinary development. Optional, non-secret overrides are documented in `.env.example`.

Before submitting a change, run the checks relevant to the edited surface. The common baseline is:

```bash
npm run check
```

Changes to a file tool should also run its real-output browser coverage. `npm run test:tools:smoke` verifies every public tool route; `npm run test:tools` exercises the complete output and recovery suite.

## Pull request expectations

- Explain the user-facing problem and the chosen solution.
- Include tests that fail without the fix and pass with it.
- Describe privacy, memory, accessibility, localization, and browser-compatibility effects where relevant.
- Keep unrelated formatting or refactors out of the change.
- Update public documentation when behavior or limitations change.
- Create a focused branch, keep commits reviewable, and complete the pull request template.
- Follow existing Astro components, strict TypeScript, Tailwind CSS 4, and local-first processing patterns. Do not introduce another application framework.

Bug reports belong in public issues only when they are safe to disclose. Suspected vulnerabilities, privacy leaks, or exploitable parser behavior must follow [SECURITY.md](SECURITY.md), not a public issue.

By contributing, you agree that your contribution is licensed under the repository’s AGPL-3.0-only license.
