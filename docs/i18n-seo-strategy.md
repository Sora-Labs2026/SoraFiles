# Sora Files international SEO architecture

Updated: 11 August 2026

## Published language editions

Sora Files publishes the same useful route set in 19 languages. English remains the unprefixed default. Every translated edition uses a stable language directory and a language-specific canonical URL.

| URL prefix | Language | HTML / hreflang code | Direction |
| --- | --- | --- | --- |
| `/` | English | `en` | LTR |
| `/ja/` | Japanese | `ja` | LTR |
| `/ko/` | Korean | `ko` | LTR |
| `/es/` | Spanish | `es` | LTR |
| `/fr/` | French | `fr` | LTR |
| `/de/` | German | `de` | LTR |
| `/pt/` | Portuguese | `pt` | LTR |
| `/zh-cn/` | Simplified Chinese | `zh-Hans` | LTR |
| `/zh-tw/` | Traditional Chinese | `zh-Hant` | LTR |
| `/hi/` | Hindi | `hi` | LTR |
| `/ar/` | Arabic | `ar` | RTL |
| `/ru/` | Russian | `ru` | LTR |
| `/id/` | Indonesian | `id` | LTR |
| `/it/` | Italian | `it` | LTR |
| `/nl/` | Dutch | `nl` | LTR |
| `/tr/` | Turkish | `tr` | LTR |
| `/vi/` | Vietnamese | `vi` | LTR |
| `/th/` | Thai | `th` | LTR |
| `/pl/` | Polish | `pl` | LTR |

`/kr/` is not an indexable language directory. It permanently redirects to the standards-based Korean URL `/ko/`, preserving the remaining path and query string.

## Equivalent page inventory

Each language publishes the homepage, five supporting pages, and all eleven public tools:

- `/`
- `/about`
- `/contact`
- `/privacy`
- `/terms`
- `/open-source`
- `/image-converter`
- `/compress-image`
- `/pdf`
- `/merge-pdf`
- `/split-pdf`
- `/rotate-pdf`
- `/jpg-to-pdf`
- `/pdf-to-jpg`
- `/pdf-to-word`
- `/word-to-pdf`
- `/heic-to-jpg`

That produces 323 indexable language-page equivalents. The sitemap contains each canonical URL; `/kr/`, the legacy `/heic` redirect, error pages, and the locale-detection endpoint are excluded.

## Canonical and hreflang rules

Every localized page:

- uses a self-referencing canonical URL;
- links to the same page in all 19 published languages;
- includes `x-default` pointing to the English equivalent;
- emits the correct `html lang`, text direction, Open Graph locale, localized title, description, H1, and structured data;
- links between language editions without JavaScript so crawlers and keyboard users can follow the routes.

Example for the Korean Merge PDF page:

```html
<link rel="canonical" href="https://sorafiles.com/ko/merge-pdf" />
<link rel="alternate" hreflang="ko" href="https://sorafiles.com/ko/merge-pdf" />
<link rel="alternate" hreflang="ja" href="https://sorafiles.com/ja/merge-pdf" />
<link rel="alternate" hreflang="en" href="https://sorafiles.com/merge-pdf" />
<link rel="alternate" hreflang="x-default" href="https://sorafiles.com/merge-pdf" />
```

## Language selection and preference

The footer exposes all language editions in a compact, foldable selector and keeps the visitor on the equivalent route. An explicit choice is saved in local storage and a first-party cookie. On a future visit the site uses that preference first, then browser language preferences, then an approximate Cloudflare country signal only as a last fallback.

The site does not force redirects based on inferred language. It displays a dismissible suggestion so users and crawlers keep control of the URL. Search engines can independently discover every edition through HTML links, reciprocal hreflang annotations, and the sitemap.

## Content and metadata model

Translations cover navigation, tool discovery, tool controls, validation messages, privacy explanations, capability limits, FAQs, contact fields, titles, descriptions, headings, and structured data. File-format names and the `Sora Files` brand stay unchanged where appropriate.

Metadata is written for the task and locale rather than mechanically translating one keyword string. Examples include:

- English: `Sora Files | Free Instant Private PDF & Image Tools`
- Japanese: `Sora Files | 無料・高速・プライベートなPDF・画像ツール`
- Korean: `Sora Files | 무료·빠른 비공개 PDF 및 이미지 도구`
- Spanish: `Sora Files | Herramientas PDF e imágenes gratis, rápidas y privadas`
- French: `Sora Files | Outils PDF et image gratuits, rapides et privés`
- German: `Sora Files | Kostenlose, schnelle und private PDF- und Bildtools`

“Instant” describes the absence of registration, upload queues, and server processing—not a guaranteed completion time. Tool pages explain that actual speed and output depend on the device and file.

## Translation quality controls

The build validator checks every language-route pair for output presence, correct language and direction, self-canonical, localized title/description/H1, reciprocal alternates, `x-default`, sitemap membership, valid JSON-LD, and localized tool-workbench labels. Japanese, Korean, Spanish, and Arabic pages are also visually checked for navigation, forms, controls, overflow, and RTL composition.

Before running paid campaigns or producing language-specific editorial content, a native reviewer should check terminology, tone, and local search intent in the highest-traffic markets. Search Console performance should be segmented by country, query, page, and device before changing titles or page copy.

## Submission and monitoring

After each production localization release:

1. Build and run the international SEO validator.
2. Deploy the canonical `sorafiles.com` host and verify the `www` and `/kr/` redirects.
3. Submit `https://sorafiles.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
4. Use Google URL Inspection and Bing URL Submission for the homepage and important new language/tool entry pages, within each service's quotas.
5. Send changed canonical URLs through IndexNow for Bing and participating engines.
6. Monitor indexing, hreflang conflicts, soft 404s, duplicate canonicals, translation engagement, and search-query relevance.

Indexing requests are discovery signals, not ranking guarantees. Search performance should be improved through reliable tools, genuinely useful localized copy, fast rendering, strong internal linking, and trustworthy capability disclosures.
