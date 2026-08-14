<p align="center">
  <img src="favicon.png" alt="SoraFiles gradient S" width="112" height="112">
</p>

# SoraFiles

Free, privacy-first PDF and image tools that run locally in your browser.

> **Active development:** SoraFiles is usable today, and a more dependable generation of its local PDF tools is now being developed in public. The latest source adds safer cancellation, stronger input/output checks, and better recovery without changing the no-upload privacy model.

[Use SoraFiles](https://sorafiles.com) · [Source code](https://github.com/Sora-Labs2026/SoraFiles) · [Report a security issue](SECURITY.md) · [Contribute](CONTRIBUTING.md)

## Why SoraFiles exists

Everyday file tasks should not require an account, a watermark, or an upload queue. SoraFiles performs its supported PDF, image, HEIC, OCR, and basic document operations in the browser using local JavaScript, Web Workers, WebAssembly, and browser APIs. The original file is never overwritten.

## Available tools

- Convert images between common formats
- Compress and resize JPG, PNG, WebP, HEIC, and HEIF images
- Convert HEIC/HEIF photos to JPG
- Compress PDFs using explicit rasterization presets
- Merge, split, and rotate PDFs
- Convert JPG/PNG images to PDF
- Render PDF pages as JPG images
- Convert PDF text to a basic DOCX, with opt-in local OCR for scan-like pages
- Convert DOCX text to a basic PDF

The interface is statically rendered with Astro, supports 19 languages, includes right-to-left Arabic layouts, and remains navigable when JavaScript is disabled wherever processing is not required.

## Privacy model

SoraFiles has no file-upload or server-processing endpoint for its file tools. First-party processing code reads the selected file on the device and creates a new local result for download.

Some page-level services are separate from file processing:

- The Contact form sends the fields and optional attachment a user explicitly submits to FormSubmit for delivery to Sora Labs.
- Production builds may include ordinary analytics or advertising scripts. First-party tool code does not intentionally send file contents to those services; stronger third-party isolation on processing routes remains active development.

Do not use this software as a substitute for your organization’s document-handling, legal, or security requirements.

## Honest limitations

- PDF compression rasterizes pages. It can remove selectable text, links, forms, signatures, bookmarks, and accessibility structure, and an already efficient PDF can become larger.
- PDF-to-Word and Word-to-PDF are text-focused conversions, not exact layout reconstruction.
- OCR accuracy depends on scan quality, language, handwriting, layout, and device resources.
- Browser codec support, file complexity, and available memory can limit an operation.
- Static image conversion can flatten layers, animation, extra frames/pages, metadata, or color-profile information.

SoraFiles shows relevant tradeoffs before processing and rejects formats or variants it cannot handle truthfully.

## Technology

- Astro 7 static multi-page application
- Strict TypeScript and Tailwind CSS 4
- PDF.js, pdf-lib, Tesseract.js, heic-to, Canvas, Web Workers, and WebAssembly
- Static deployment through Cloudflare Workers assets
- Real-output browser tests that parse generated PDFs, DOCX files, ZIP archives, and images

## Local development

Requirements:

- Node.js 22.12 or newer (`.nvmrc` is provided)
- npm and the committed `package-lock.json`
- Playwright Chromium only when running browser tests

```bash
npm ci
npm run verify:ocr
npm run dev
```

No environment variables are required for ordinary development or file processing. Copy `.env.example` only when you need its documented optional Astro build flag; browser-test overrides are set in your shell. Never put credentials or private files in `.env`.

Optional configuration:

| Variable | Purpose | Default |
| --- | --- | --- |
| `PUBLIC_ADSENSE_ENABLED` | Include the existing AdSense loader in a manual Astro build | `false` |
| `SORA_BASE_URL` | Point browser tests at an already-running preview; set in your shell | `http://localhost:4321` |
| `SORA_BROWSER_PATH` | Use an explicit Chromium-compatible executable in browser tests; set in your shell | Playwright Chromium |

Astro will print the local development URL. To create and preview a production build:

```bash
npm run build
npm run preview
```

Run the complete non-browser validation baseline with:

```bash
npm run check
```

The underlying focused commands are:

```bash
npm run typecheck
npm run verify:brand
npm run build
npm run test:unit
npm run validate:i18n
npm run validate:seo
npm run test:tools:smoke
```

Browser tests require a locally installed Playwright Chromium build:

```bash
npx playwright install chromium
```

`npm run test:tools` runs the longer real-output and recovery suite. `npm run test:site` builds the site and checks representative routes, responsive layouts, and no-JavaScript rendering.

## Repository structure

```text
src/pages/       Astro routes
src/components/  shared UI and local tool workbenches
src/lib/         local OCR, PDF, and discovery logic
src/i18n/        19-language content contracts
public/          static icons, PDF.js, and integrity-pinned OCR assets
scripts/         build and validation utilities
tests/           unit, browser, fixtures, and real-output validation
```

## Project status

Currently verified:

- Eleven public file tools and real output fixtures
- Cancellable PDF compression, merge, split, rotate, JPG-to-PDF, and PDF-to-JPG jobs with stale-result protection
- Structured corrupt/encrypted-file recovery and tool-specific output validation before downloads appear
- Local OCR assets for supported languages
- 342 static pages and 323 localized canonical URLs
- Responsive light/dark/system themes, keyboard access, reduced motion, RTL, and zoom/reflow coverage
- No account requirement, no watermark, and no overwrite of the original file

Actively being improved:

- Faster, more dependable PDF tools for larger and more complex files
- Clear progress, cancellation, and helpful recovery when a device reaches its limits
- Higher-quality PDF compression and conversion with honest output tradeoffs
- Stronger privacy protection across file-tool pages
- Broader accessibility, language, and browser-compatibility coverage

This roadmap describes user-facing outcomes only. Internal architecture, implementation plans, security-sensitive details, development prompts, and operational planning are not published.

## Contributing and security

Early issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before proposing changes. Use the GitHub issue forms for bugs and feature requests. Report potential vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Sora Labs

SoraFiles is built by **Sora Labs**.

- Website: [sorafiles.com](https://sorafiles.com)
- Medium: [@soralabs2026](https://medium.com/@soralabs2026)
- Reddit: [u/Sora-Labs](https://www.reddit.com/user/Sora-Labs/)
- Indie Hackers: [SoraLabs](https://www.indiehackers.com/SoraLabs)
- Hacker News: [SoraLabs](https://news.ycombinator.com/user?id=SoraLabs)

## License

SoraFiles is licensed under the [GNU Affero General Public License v3.0 only](LICENSE). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for bundled dependency notices.

Copyright © 2026 Sora Labs.

This repository contains the public source for released SoraFiles code and public development work. Credentials, private infrastructure, internal planning, and security-sensitive operational material are not part of the application source and are not published.
