# SoraFiles Tool Micro-Issues

Audit date: 2026-09-01

## SF-MICRO-001

- ID: SF-MICRO-001
- Tool: Compress PDF and every range consumer
- Severity: P2 visible UX defect
- Observed: At value 88, the thumb was near 88% while the purple fill ended around 57%.
- Expected: Fill, thumb, value, and profile represent the same normalized value.
- Root cause: `.compression-range` used a hard-coded `--range-progress: 57.1429%`; the existing range utility was not bound globally.
- Fix: Added normalized `(value-min)/(max-min)` synchronization for every range, one CSS custom property, shared WebKit/Firefox geometry, and live `input` updates.
- Test: 34 ranges × min/min+step/25/50/60/75/88/max-step/max; focused Chrome screenshot; Firefox 88% assertion; keyboard and pointer drag.
- Verified: Yes.

## SF-MICRO-002

- ID: SF-MICRO-002
- Tool: Compress PDF
- Severity: P2 visible UX defect
- Observed: Default UI exposed “PDF structure,” “image downsampling,” DPI, and an SSIM floor.
- Expected: Explain the outcome and safety behavior in everyday language.
- Root cause: Engine and QA profile fields were interpolated directly into user-facing helper/profile copy.
- Fix: Kept profile parameters internal; added short quality/result descriptions and a plain smallest-file warning.
- Test: Rendered-workbench banned-term scan and real compression results.
- Verified: Yes.

## SF-MICRO-003

- ID: SF-MICRO-003
- Tool: Compress Image
- Severity: P2 visible UX defect
- Observed: Strength label updated through form `change`, and result/status copy named codecs and raw quality checks.
- Expected: Immediate label feedback and user-centered outcome language.
- Root cause: No direct `input` listener; internal encoder/quality terms leaked into UI.
- Fix: Added live `input` synchronization and replaced codec/SSIM wording with clarity, dimensions, transparency, and actual-size outcomes.
- Test: Pointer/keyboard range interaction; JPG, opaque PNG, transparent PNG, and HEIC real outputs.
- Verified: Yes.

## SF-MICRO-004

- ID: SF-MICRO-004
- Tool: PDF OCR and PDF to Word
- Severity: P2 visible UX defect
- Observed: UI referenced a local OCR model, confidence percentages, reconstruction, and local OCR.
- Expected: Explain searchable/selectable text, progress, and pages that should be reviewed.
- Root cause: Diagnostic messages were reused as customer-facing status and warnings.
- Fix: Replaced them with “Preparing text recognition,” “Reading scanned page,” and review guidance.
- Test: Real TXT, searchable PDF, editable DOCX, and scanned-page DOCX flows.
- Verified: Yes.

## SF-MICRO-005

- ID: SF-MICRO-005
- Tool: Repair PDF, Unlock PDF, Metadata Remover, PDF to Excel
- Severity: P2 visible UX defect
- Observed: Results exposed parser passes, encryption terminology, XMP/EXIF/IPTC/chunks, and inferred table regions.
- Expected: State what was recovered, removed, or converted and what the user should review.
- Root cause: Engine result details were rendered without a presentation-layer translation.
- Fix: Rewrote result details around pages, passwords, hidden details, editable cells, and limitations.
- Test: Validated repair, protect/unlock, PDF+image metadata removal, and table-to-XLSX outputs.
- Verified: Yes.

## SF-MICRO-006

- ID: SF-MICRO-006
- Tool: Remove Background
- Severity: P2 visible UX defect
- Observed: Description and first-use status exposed the AI matting engine/model concept.
- Expected: Describe automatic background removal and the transparent result.
- Root cause: Library initialization text was used as processing copy.
- Fix: “Preparing background removal for first use” and “Removing the background.”
- Test: Real RGBA PNG with transparent pixels.
- Verified: Yes.

## SF-MICRO-007

- ID: SF-MICRO-007
- Tool: All tools
- Severity: P3 polish
- Observed: Several primary actions used a generic localized “Process locally” label in English.
- Expected: The button names the exact action.
- Root cause: Shared fallback action was used by specialized tools.
- Fix: Added action-specific English labels for all 26 tools while retaining localization fallbacks.
- Test: Route-level rendered UI audit.
- Verified: Yes.

## SF-MICRO-008

- ID: SF-MICRO-008
- Tool: All range-heavy image/PDF/direct-manipulation tools
- Severity: P2 accessibility/usability
- Observed: Range styling and hit geometry were fragmented; browser paths could diverge.
- Expected: Consistent focus, disabled state, dark mode, RTL, 44px interaction height, and live input.
- Root cause: Tool-local classes and native accent styling were mixed.
- Fix: Added `.sf-range` as the shared progressive enhancement for all `input[type=range]` controls.
- Test: Chrome and Firefox, dark/light, RTL, keyboard, pointer, reduced motion.
- Verified: Yes.

## SF-MICRO-009

- ID: SF-MICRO-009
- Tool: Resize Image and Doc Scanner test workflows
- Severity: P3 QA reliability
- Observed: Older browser tests attempted to interact with controls in a non-active mobile panel.
- Expected: Tests follow the same Preview/Pages/Adjust navigation as a mobile user.
- Root cause: The adaptive workspace was upgraded after the tests were authored.
- Fix: Updated tests to activate the correct mobile panel and wait for asynchronous image work before interacting.
- Test: Resize at 320/390/1024/1440; scanner corner drag, retake, filters, export, and draft recovery.
- Verified: Yes.

No P0 or P1 issue was found. All observed P2 issues were fixed and verified.
