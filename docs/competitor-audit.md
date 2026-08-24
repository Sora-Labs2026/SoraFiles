# Sora Files competitor audit

Reviewed August 9, 2026. This is product research, not a design reference. Sora Files must not copy any competitor's layout, visual identity, wording, or interaction treatment.

## What the market already does well

| Product | Strongest pattern | Important trade-off or gap |
| --- | --- | --- |
| Smallpdf | Broad, familiar PDF tool suite with a clear upload-first flow | Several compression strengths and workflows lead into Pro; processing is server-based with a stated deletion window |
| iLovePDF | Very broad PDF coverage and easy-to-recognize task names | Account and Premium prompts are prominent; image tools live in a separate product |
| TinyPNG | Focused image compression with modern image formats | Free use has file/count limits and processing uses a hosted service |
| Squoosh | Strong local-processing story and detailed visual controls | The interface is more technical than many everyday users need |
| PDF24 | Broad free PDF coverage and a separate offline Windows product | The web experience is dense and supported by advertising; many web tasks use server processing |
| TinyPDF | Lightweight legacy Windows PDF printer | It is not a modern browser-based file workspace and is not a useful direct interaction benchmark |

## Opportunity for Sora Files

The clearest opening is not “more tool links.” It is a single, calm workspace that understands the file, recommends the right action, and explains privacy and quality trade-offs before processing.

1. **Exact-size outcomes first.** Upload portals ask for files below a hard limit. Make 100 KB, 200 KB, 500 KB, and custom targets first-class goals, with an honest result when the target is impossible without resizing.
2. **Local processing as architecture.** For supported formats, process on-device rather than relying on a promise to delete files later. Keep the claim scoped to tools that truly work that way.
3. **One analysis surface.** Over time, let users choose a file once and then show only compatible actions. Avoid a homepage made of dozens of nearly identical upload pages.
4. **Explain destructive changes.** Detect transparency and warn before JPEG conversion; explain metadata and color-profile loss; never overwrite the original.
5. **Mobile by default.** Keep the primary action visible, use large touch targets, and collapse advanced options until a file has been analyzed.
6. **No artificial friction.** Do not require an account, place watermarks, or invent a progress flow. Monetization should not weaken the core promise.
7. **Truthful format expansion.** Add formats only after their decoding, memory, security, and output-quality paths pass validation. HEIC, PDF, ZIP, and text-first Word workflows now meet that bar with explicit fidelity limits.

## Phase-one decision

The first release supports local JPG, PNG, and WebP compression/conversion with automatic, percentage, and exact-target modes. It also includes HEIC/HEIF decoding and conversion through libheif, plus clearly labeled image-based PDF compression. PDF pages are flattened only after explicit confirmation, because selectable text, links, forms, signatures, bookmarks, and accessibility structure do not survive that workflow.

## Follow-up research

Before adding server-assisted conversion, complete the master specification's comparison of CloudConvert, Convertio, and FreeConvert. That research should focus on retention disclosures, size limits, error recovery, pricing pressure, and whether any operation can remain local.
