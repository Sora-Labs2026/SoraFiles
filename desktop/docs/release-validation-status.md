# Release validation status

Updated September 13, 2026. **Release incomplete.** Passing individual checks does not establish that all 26 Desktop tools work or that the app can be sold and downloaded.

## Current evidence

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

- Finish and independently validate all 26 tools with real fixtures and inspect their complete user journeys.
- Complete native output safety and process cancellation/crash/commit recovery. Window-close and quit guards are implemented but await installed-app validation.
- Deploy the first-party license service and signed trial authority; configure public verification keys, reconciliation and production Dodo readiness. Paid activation stays online and permanently device-bound.
- Complete bundled engine assets, redistribution/source notices and provenance.
- Validate installation, shell actions, secure storage, offline processing, updates and uninstall on every advertised OS. Mac distribution uses the owner's selected per-app Gatekeeper approval route.
- Finish current design/browser reviews, publish actual verified artifacts and verify the deployed website and download links. No fabricated downloads, engine capabilities, platform tests or license-email results.
