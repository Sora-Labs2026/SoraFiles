September 23 owner clarification: proceed with Windows/macOS/Linux builds and launch without waiting for Apple notarization. Mac users may approve the app through System Settings → Privacy & Security → Open Anyway. This supersedes the September 17 notarization-only release policy. Ad-hoc Mac releases must disclose their signing status, include the first-party instructions and disable automatic updates. Functional results and pending platform checks remain reported separately.

Current Windows build completed with exit 0: **115,025,320 bytes (115.03 MB)**, unsigned, SHA-256 `ba41e14a9539eca5b00acfebafe7ef9cb3eb86d94d585a2b43037fead89b65e1`. Native lifecycle passes at 1180 × 900; 1,989 resources match the generated pack byte-for-byte (316,228,434 bytes). The native executable is 4,804,096 bytes. Controls and opt-in Explorer source are included; the development Office component is excluded. No installed Explorer certification is claimed. Evidence: `desktop/audit/compact-candidate-shell-20260923.json`.

# Release validation status

September 23 later Desktop-only continuation: **190 Node tests pass**, **44 native
Rust tests pass** (one optional OS-store test ignored), and **36 desktop-only UI
QA groups pass** at 900/1180/1440/1920 pixels. New source exposes watermark/page
number controls and an opt-in transactional Explorer entry with uninstall cleanup.
The installer rebuild including these changes completed; see the current record above. A separate synthetic Office component successfully
converts DOCX/XLSX to parsed PDFs and rejects malformed DOCX, but is not connected
to licensed processing or included in a shipping pack. See authoritative status.

September 23: full Desktop suite 184 passed plus one subsequently added native
diagnostic-report regression passed; Rust 38 passed, one opt-in credential-store
test ignored. UI QA 34 groups and website QA 26 groups passed before the owner's
instruction to stop mobile-view checks. Free Web Unlock PDF also passed its
actual known-password fixture. Current Windows NSIS build exits 0 (115.03 MB,
unsigned); staged resources match the verified isolated engine pack. The release
executable passes three native loads/two closes at 1180 x 900. See dated candidate
evidence and the authoritative implementation status. Installation, shell
integration, other OS targets, full parity and release clearance remain pending.
The older September 17 counts below are historical.

> September 17 recovery update: current requirements and evidence are in `../../docs/desktop-implementation-status.md`. Historical results below were obtained on the previous PC and are not current release certification. Support-approved replacement is now implemented; see `device-replacement.md`. Production Mac releases require signing and notarization.


**Release incomplete.** September 17: 170 Desktop tests pass; prior unchanged Web
suite has 119 passes. 33 browser UI groups pass in Edge and Chrome; website QA has
26 passing groups. There are 23 scoped processing workflows and 22 basic UI
workflows. Windows native tests/build/background lifecycle and the reduced isolated
processing pack pass. Six retained OCR core variants recognize a known invoice.
The verified unsigned NSIS candidate is 114.97 MB; its rebuild exits successfully.
That candidate predates the latest shared image adjustments; a refreshed candidate
is building. Web adjustment comparisons are pixel-exact across 12 scoped cases.
Two Office engines,
full visual editors, installed shell/startup integration, signed release artifacts,
live billing/hosting and legal gates remain. The September 13 table below is
historical evidence; use `../../docs/desktop-implementation-status.md` for current
commands and results. Passing individual checks is not release certification.

## Historical September 13 evidence

| Check | Result | Scope |
| --- | --- | --- |
| Web unit suite | 115 passed | Current workspace; `.artifacts/web-unit-current.log` |
| Web production build | Passed | 642 pages; content truth, 19 languages, metadata, SEO, branding, advertising removal and OCR assets; `.artifacts/web-production-current.log` |
| Desktop Node suite | 108 passed | Synthetic entitlements, real PDF/image fixtures, licensing contracts and security boundaries; `.artifacts/desktop-tests-current.log` |
| Rust host suite | 22 passed, one ignored | Private encrypted-state pipe, trial restart/offline behavior, real PDF processing, request and selection boundaries; `.artifacts/native-tests-current.log` |
| Isolated processing pack | Passed on Windows x64 | Bundled Node and dependencies copied outside the checkout. PDF rotation, image resize and PDF raster output independently decoded; `.artifacts/processing-pack-verification.json` |
| Four-platform candidate build | Previous candidate passed | Windows, Mac Intel, Mac Apple Silicon and Ubuntu, commit `178f6638cefc07dbcead765808aeffd903d756dc`. This predates the new processing bridge and is not evidence for that bridge on those platforms. |
| Figma MCP | Installed and connection verified | No SoraFiles Figma file has been supplied; connection is not a visual test result. |
| Playwright MCP | Chrome dependency installed | Chrome for Testing 153.0.8010.36 installed from Google in the per-user path. MCP successfully opened the live site. |
| Current live UI review | Pending | Browser approval resumed successfully. Current Playwright review is in progress; prior captures remain separately scoped. |

## Supplied design references

Emil's interaction guidance, Impeccable, the taste collection's existing-project review and Dick Wu's Apple HIG skill are installed. Their criteria guide review; they are not executable certifications. Apply relevant checks for keyboard and focus, text contrast, layout and scaling, meaningful feedback, error recovery, motion preferences and consistent controls. Preserve the existing SoraFiles brand. Record measured checks separately from reviewer judgments and explain every exception. See `installed-design-skills-review.md` and `premium-design-review.md`.

## Processing integration

Thirteen headless workflows exist: eight PDF editing/creation operations, four image operations and PDF-to-image rendering. Twelve have basic options in the native UI; visible signature placement still needs its editor. The host resolves opaque selection IDs, verifies signed offline access and invokes an on-demand component through private pipes. Original files and existing results are preserved. Raster tests cover page order, crop, rotation, resolution and known colours.

These are initial workflows, not finished premium workspaces. The other thirteen engines, batch processing, previews, reorder/range controls, interactive editors, output open/reveal, native directory-handle writing and comprehensive malformed-file/resource validation remain incomplete. An adversarial oversized-image fixture now fails before rendering instead of producing missing content; normal embedded-image colours and decoder cancellation also pass. Further malformed-file checks remain.

## Remaining release gates

- Finish and independently validate all 25 eligible Desktop tools with real fixtures and inspect their complete user journeys.
- Complete native output safety and process cancellation/crash/commit recovery. Window-close and quit guards are implemented but await installed-app validation.
- Deploy the first-party license service and signed trial authority; configure public verification keys, reconciliation and production Dodo readiness. Paid activation stays online and device-bound, with support-approved replacement.
- Complete bundled engine assets, redistribution/source notices and provenance.
- Validate installation, shell actions, secure storage, offline processing, updates and uninstall on every advertised OS. Production Mac distribution requires signing and notarization under the September 17 recovery prompt.
- Finish current design/browser reviews, publish actual verified artifacts and verify the deployed website and download links. No fabricated downloads, engine capabilities, platform tests or license-email results.
