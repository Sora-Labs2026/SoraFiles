# Desktop notice pack

Runtime license files are exact copies of the official Node.js release tags,
including bundled third-party notices. `runtime/manifest.json` records their
sources and SHA-256 digests. The pack builder requires a reviewed notice matching
the runtime version; both the CI pin and current local version are included.

Processing dependencies retain their original package notices. OCR notices are
copied from the checked, hashed `public/ocr/licenses` assets. The pack verifier
checks the runtime and OCR notices in an isolated copy of the built package.

These notices do not establish complete redistribution clearance. Corresponding
source, native codec/model provenance, copyleft installation/relinking obligations
and signed release validation remain mandatory release gates. See the dependency
audit and implementation status ledger.
