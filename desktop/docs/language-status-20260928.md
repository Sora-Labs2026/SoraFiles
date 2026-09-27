# Desktop language behavior — 28 September 2026

The owner requires operating-system language by default on Windows, macOS and Linux, a saved manual choice in Settings, and English for unsupported system languages.

Implemented in source:

- A `system` preference plus the same 19 language codes as the website. Existing preference files migrate to `system`; explicit choices survive restart and unrelated preference changes.
- Windows display-language preferences, macOS preferred UI languages, and Linux message-language environment precedence. Regional formatting alone does not select Windows UI language.
- Native startup locale before the first interface paint, immediate manual changes, language-aware dates/numbers and tool search, Arabic direction, compact-card support, and protected user-entered text and filenames.
- Translated Explorer root/menu labels, Finder/Nautilus/Dolphin entry labels, native tray actions and file-dialog titles. Unix entry refresh preserves ownership checks; a file-manager restart can be needed to refresh cached labels.
- Bundled offline dictionaries. Translation maintenance scripts only operate on public source messages at build time. They are not executed by the installed app. Non-English draft copy still needs native-speaker editorial review; unknown runtime messages fall back to their original text.
- The native action resolver remains independent of language data and processing engines. File-manager translations use a separate small catalog; changing language does not change operation IDs, options, licensing or payment state.

Verified locally: 68 native host tests passed (one OS credential-store test intentionally skipped), 63 language/platform/compact browser cases, 16 compact-action browser cases, full Desktop browser QA, 22 action/Unix integration tests (three Unix-only tests skipped on Windows), catalog completeness/size tests, and rebuilt Windows Explorer COM tests. The native macOS and Linux builds and installed behavior still require CI/platform verification.

This is source/candidate work, not a published release. Public packages must not be described as including these changes until the matching 0.1.1 artifacts are built, verified and published.
