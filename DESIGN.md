# SoraFiles design contract

The current application is the visual authority. This replaces a prior imported Vercel extraction that did not describe SoraFiles. Refer to actual components and src/styles/global.css; do not introduce another design system.

- Typography: locally hosted Plus Jakarta Sans, 200–800, with existing sans fallback. Reuse the compact text sizes, bold headings and tracking; no new font family.
- Tokens: ink #0b0e1d, muted #5b6178, canvas #f3f5fb, surface white, line #dde2ef. Dark variants live in :root.dark (canvas #070a18, surface #0f1328, ink #eef1ff). Use paired tokens.
- Reuse rounded-card (8px), rounded-control (7px), module radius (12px), shadow-card, shadow-small, and existing component-specific larger radii. Do not globally change finished workspaces to a new radius.
- Shell: Header.astro, Footer.astro, Layout.astro; 1200px navigation width, translucent surfaces and restrained violet/cyan accents. Workbenches commonly use max-w-5xl and responsive 20/24px gutters.
- Controls: native buttons, minimum 44–48px primary actions, visible global focus, explicit labels and disabled states. Use existing action/surface/line colors and ToolIcon.astro for tool icons.
- Uploads: sf-upload-dropzone owns drag, keyboard and touch affordances. Keep file-picker fallback, announced errors/status and safe filename wrapping. Never rely on hover alone.
- Editors: reuse AdaptiveWorkspace.astro and existing PDF/canvas panels. Mobile has real Preview/File and Options/Adjust controls, scrollable panels and safe-area padding. Keep downloads reachable; avoid overflow and competing fixed bars.
- Guides use the same shell, tokens, hierarchy, cards, controls and spacing. Empty content means an honest empty state, not manufactured cards or categories.
- Motion: reuse opacity/transform transitions. Honor prefers-reduced-motion: reduce. Status text must communicate without motion. No fake percentages or animations delaying processing.
- Preserve dialog focus, keyboard access, light/dark contrast and content density. Inspect processing, error and result states as well as idle screens.

Do not import generic blog themes, template styling, unrelated typography, oversized decorative cards, extra gradients/glass, badge collections, icon families or animation dependencies. External references may inform a small verified fix; they never replace SoraFiles' visual authority.

Desktop uses the same locally hosted typeface and paired brand tokens in `desktop/ui/brand.css`, with compact native-window spacing. Keep the 12/16/24px spacing rhythm and existing 9px control, 13–18px panel radii. Primary actions invert to light surfaces in dark mode; status text always has a paired background token. Inputs use explicit labels, native selection behavior and visible focus. Retain one clear primary action per step. Modal native dialogs belong to the owning window; background work must preserve focus and entered text. Navigation collapses at 680px, content columns adapt at 950/1350px, and sidebar content remains scrollable. Web uses the existing responsive component breakpoints rather than imposing Desktop widths.

Honor reduced transparency with opaque theme surfaces and no backdrop blur. Pending actions announce actual waiting; changing screens must not discard new input when an earlier response arrives. Keep Quit accessible at every desktop window size. Test real 200% native zoom as well as browser layout checks. The scoped review and unresolved platform checks live in `desktop/docs/premium-design-review.md`.
