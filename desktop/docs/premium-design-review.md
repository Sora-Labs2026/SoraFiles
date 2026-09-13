# SoraFiles Web and Desktop design review

Reviewed September 13, 2026 using Apple-HIG-derived cross-platform design principles. This is a scoped implementation review, not an Apple HIG or WCAG conformance certificate. The existing SoraFiles brand and free Web workflows remain the design authority.

Purchase-return follow-up: reused the Desktop layout, site typography, semantic colors, rounded controls and card treatment. Inspected the built page at the default desktop viewport and 320px width in light/dark modes. Key visibility is explicit, Copy is the primary action, feedback uses a polite status region, clipboard denial offers manual selection, and button targets remain 48px high. Keyboard focus and empty reload were checked; no horizontal overflow was observed. Only synthetic license data was displayed. This does not certify completed payment, native activation or email delivery.

## External reference and licensing

Consulted [apple-design-skill](https://github.com/dickwu/apple-design-skill), its [SKILL.md](https://github.com/dickwu/apple-design-skill/blob/main/SKILL.md) and [HIG lookup](https://github.com/dickwu/apple-design-skill/blob/main/references/hig-lookup.md). Loaded accessibility, layout, typography, color, dark mode, designing for macOS, icons, app icons, loading and keyboards. The repository root did not provide a clear redistribution license at inspection. It remains an external reference: no skill, Apple text, symbols, font, artwork or runtime dependency was vendored.

Primary guidance: [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [layout](https://developer.apple.com/design/human-interface-guidelines/layout), [color](https://developer.apple.com/design/human-interface-guidelines/color), [loading](https://developer.apple.com/design/human-interface-guidelines/loading), [keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards), [icons](https://developer.apple.com/design/human-interface-guidelines/icons). The zoom check also uses [W3C Resize Text guidance](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html). Platform-specific Apple visual conventions are not copied into Windows or Linux.

## Implemented findings

| Severity | Finding and consequence | Concrete correction | Guideline / platform |
| --- | --- | --- | --- |
| High | Native requests set internal busy state without updating controls. Repeated clicks appeared accepted and slow dialogs had no feedback. | Announced pending status, disable conflicting actions immediately, preserve navigation, prevent duplicate host calls. No fabricated progress percentages. | Loading and feedback / desktop UI |
| High | Full rerenders after delayed host responses discarded work on a different screen and lost keyboard focus. | Preserve a different active screen and its inputs; restore the original control when a disabled action returns. Avoid duplicate live announcements. | Accessibility, keyboards / desktop UI |
| High | Cancelling the output folder picker could claim a successful save, including when a previous folder existed. | Native response reflects the current dialog result; UI announces success only for an accepted selection. | Feedback / Windows host and desktop UI |
| High | Removing or clearing files left their native selection IDs retained; after 256 selections users could no longer add new files. | Bounded release-selection command validates the complete request before mutation. UI releases IDs before removing rows. | File management / Windows host |
| Medium | Rejected native selections disappeared without explanation; failed reads could retain an unused ID. | Preserve accepted files, explain selection limits, and retain IDs only after a successful read. | Feedback / Windows host and desktop UI |
| High | Status text inherited light ink on a light status surface in dark mode. | Paired success/error surface, text and border tokens for explicit dark mode and system dark mode. | Color and accessibility / desktop UI |
| Medium | Primary actions blended into dark panels. | Use light action surface and dark text in dark mode, retaining SoraFiles colors. | Color / desktop UI |
| High | Narrow layout hid Quit; the fixed sidebar could clip controls at high scaling. | Keep labeled icon Quit available; allow sidebar scrolling; wrap Settings rows and long content. | Layout and accessibility / desktop UI, Windows |
| Medium | Small labels used 9px text; shortcut hints always said Ctrl. | Raise affected labels to 11px; choose Ctrl or Command from the native platform value; add native file-picker shortcut and Command-comma for Settings. | Typography and keyboards / shared UI; macOS host not yet tested |
| Medium | Native tray/window showed a generic application icon. | Reuse the existing SoraFiles ICO for both; retain vector interface glyphs and accessible action labels. | Icons / Windows prototype |
| Medium | Glass surfaces had no reduced-transparency alternative. | Opaque theme surfaces and no backdrop blur for the Web header, menus and glass components; opaque Desktop navigation. | Accessibility / Web and desktop UI |
| Medium | Homepage popup placement ignored device safe areas and very short windows. | Safe-area-aware offsets, bounded vertical size, scrolling when needed and explicit reduced-motion override. | Layout and motion / Web |

No new animation, framework, font, telemetry or visual-effect dependency was added by this review. Desktop CSS gained a small set of token/layout rules; busy feedback uses existing DOM and native controls.

## Scope and evidence

- Independent desktop Home, all 26 workspace entry points, tool search, file selection, License, Settings, Updates/About and Quit were reviewed. Opening a workspace does not establish that its engine is connected.
- Browser UI contract checks exercise delayed replies, folder cancellation, escaped filenames, native selection release calls, startup failure rollback, masked/cleared license keys, keyboard focus, empty search and light/dark layouts at 380, 640, 800, 1180 and 1920 CSS pixels. The bridge in this test is explicitly synthetic.
- Five normal-text token pairs meet 4.5:1 in both themes. The lowest measured pair was 6.13:1. This is token-pair evidence, not a claim about every composited pixel or disabled control.
- Real Windows WebView2 capture at a 760×600 outer window and 200% native zoom checks five screens. Effective viewport was 372×280 CSS pixels; horizontal overflow was absent and Quit remained available in the scrollable navigation.
- The compiled host's real selection-release method passes 300 release cycles; malformed requests preserve existing selections. This test does not claim an end-to-end OS file-picker interaction.
- Web review covers the homepage, Tools, PDF compression, Merge PDF, Image Converter, Guides, About, Privacy and five new Desktop pages. Existing file processing remains covered by its separate tool audits; this pass adds shell/layout checks, not a repeat certification of all engines.
- The popup is a nonmodal, dismissible 3:4 composition with a 44px close target, no focus theft, Escape behavior and 30-day dismissal persistence. Both blocked-storage cases are tested. Publication remains disabled for the planned full launch.
- `/desktop` uses a real Windows development capture and existing shell/tokens. No macOS/Linux screenshots, native right-click demonstration, released download or performance claim has been fabricated.

Machine-readable/local evidence: `.artifacts/desktop-ui-qa/results.json`, `.artifacts/desktop-website-qa/results.json`, `.artifacts/desktop-ui-native/ui-state.json`, `.artifacts/desktop-ui-native/zoom-state.json`. Native images: `home.png` and `settings-native-200.png` in the same directory. An old `error.txt` from September 12 is historical; evaluate timestamps with current capture evidence.

## Remaining review and implementation

Real processing/result/cancellation UI is not connected to the production native host. Active-license, expired-trial, activation-limit recovery and offline engine installation need real service/host integration before end-to-end design sign-off. Screen-reader testing, native high-DPI monitor changes, real macOS/Linux windows, menus, secure storage, updater/install/uninstall flows and translated desktop layouts remain pending. macOS shortcut rendering is implemented but is not evidence of a working macOS app.

The native classifier now recognizes PDF, PNG, JPG, WebP, GIF, TIFF, PSD, HEIC/HEIF and bounded DOCX/XLSX container names. Unknown or ambiguous inputs receive no format-specific suggestion. Complete decoding, resource limits and validation are still required before processing. Engine and shell screenshots/tutorials must follow actual implementation. No Critical issue was established within this review's tested UI scope; unresolved launch/security gates are tracked separately and remain release-blocking.
