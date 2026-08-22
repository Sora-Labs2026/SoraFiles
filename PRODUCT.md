# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro with strict TypeScript, Tailwind CSS 4 through `@tailwindcss/vite`, and static/MPA routes deployed to Cloudflare Workers. Interactive file processing uses browser JavaScript, Web APIs, and WebAssembly only where justified.

## Users

Ordinary global users who need to make an image or PDF smaller, change its format, combine or separate PDF pages, or create a practical document conversion without creating an account. The interface must remain understandable for people with basic English proficiency and usable across phones, tablets, and desktop browsers.

## Product Purpose

Sora Files provides free PDF and image utilities that run locally in the user's browser whenever the implemented operation supports it. Success means a visitor can find the right tool quickly, understand its limitations before processing, create a valid result, and download a new file while retaining the original.

## Positioning

Sora Files is private by architecture for its supported file tools: processing happens on the user's device, so file contents do not enter a Sora Files upload or server-processing queue. The product combines that local-first mechanism with free access, no mandatory account, no watermark, and clear control over relevant output settings.

## Operating Context

People commonly arrive with an email attachment that is too large, an image in the wrong format, iPhone HEIC photos that need broader compatibility, PDF pages that need combining or separating, or a document that needs a basic text-focused conversion. They may be on a low-memory phone, an older device, or a browser with limited codec support. Every workflow follows select, process locally, then download.

## Capabilities and Constraints

- Current public tools: all-in-one image conversion; image compression; HEIC/HEIF to JPG; PDF compression; PDF merge, split, and rotate; JPG/PNG to PDF; PDF to JPG; basic text-focused PDF to Word and Word to PDF.
- Browser capabilities, file complexity, memory, and supported codecs can limit processing. The product never promises unlimited files or exact compression outcomes when the engine cannot guarantee them.
- PDF compression rebuilds pages as images and therefore removes selectable text, links, form fields, signatures, bookmarks, and accessibility structure.
- Basic Word/PDF conversions preserve useful text, not complex document layout. Scanned PDFs require OCR, which is not currently implemented.
- Tools must validate actual file signatures where practical, produce independently valid output, release temporary resources, and never present unsupported formats or unfinished flows as working features.
- File contents must not be sent to analytics, advertising, or other third-party services. The Contact form is a separate, disclosed network submission flow.

## Brand Commitments

The public product name is Sora Files, presented as a standalone consumer brand. It must not be cross-branded with another Sora-named product or organization. The product voice is clear, calm, competent, direct, and truthful. The binding visual reference is `DESIGN.md`: a restrained Vercel-inspired neutral grid, compact Geist-like typography, crisp borders, modest radii, purposeful color, and excellent light/dark behavior without copying Vercel's layouts or UI.

Core product promise: “Your files. Your rules.” Supporting truths include “Nothing leaves your device” only on genuinely local operations, “Free,” “No account,” “No watermark,” and “Original files are never overwritten.” “Instant” may describe immediate access and the absence of signup/upload queues; it must not guarantee processing time for every file or device.

## Evidence on Hand

- Authoritative product and engineering requirements: `Sora_Files_Master_Prompt.txt`.
- Design language reference: `DESIGN.md`.
- Real browser regression corpus and independent output validators: `tests/e2e/`.
- Current tool verification evidence: `docs/tool-verification-report.md`.
- Current production code and static assets under `src/` and `public/`.
- No verified customer counts, testimonials, comparative benchmarks, awards, or ranking guarantees are available; future work must not fabricate them.

## Product Principles

1. Protect user privacy and safety before growth or monetization.
2. Ship only truthful, independently verified capabilities and limitations.
3. Put useful tools and clear controls before marketing content.
4. Keep the product fast, accessible, mobile-friendly, and progressively enhanced.
5. Earn search visibility through genuinely useful, unique pages—not repetition, thin translations, or keyword stuffing.

## Accessibility & Inclusion

Target WCAG 2.2 AA. All essential actions must work with keyboard and touch, visible focus, semantic labels, readable contrast, zoom and text scaling, reduced-motion preferences, and logical heading/focus order. Internationalization must support language-specific expansion, locale-aware formatting, and correct right-to-left layout for Arabic.
