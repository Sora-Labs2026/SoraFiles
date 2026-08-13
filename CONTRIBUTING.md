# Contributing to SoraFiles

Thank you for helping improve SoraFiles. This is an early-stage project, so focused changes with clear evidence are especially valuable.

## Before opening a pull request

1. Open an issue for a substantial feature or architectural change.
2. Keep file processing browser-local. Do not add an upload API, remote processing fallback, account requirement, watermark, or paid infrastructure dependency.
3. Do not claim support for a format or behavior without a working implementation and a real-output test.
4. Never commit private documents, user files, credentials, access tokens, browser data, analytics exports, or production secrets.
5. Preserve existing public URLs, accessibility behavior, localization, and honest limitation copy unless the change explicitly addresses them.

## Development setup

```bash
npm ci
npm run verify:ocr
npm run dev
```

Before submitting a change, run the checks relevant to the edited surface. The common baseline is:

```bash
npx astro check
npm run build
npm run test:unit
npm run validate:i18n
```

Changes to a file tool should also run its real-output browser coverage. `npm run test:tools:smoke` verifies every public tool route; `npm run test:tools` exercises the complete output and recovery suite.

## Pull request expectations

- Explain the user-facing problem and the chosen solution.
- Include tests that fail without the fix and pass with it.
- Describe privacy, memory, accessibility, localization, and browser-compatibility effects where relevant.
- Keep unrelated formatting or refactors out of the change.
- Update public documentation when behavior or limitations change.

By contributing, you agree that your contribution is licensed under the repository’s AGPL-3.0-only license.
