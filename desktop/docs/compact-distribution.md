September 23 owner clarification: proceed with Windows/macOS/Linux builds and launch without waiting for Apple notarization. Mac users may approve the app through System Settings → Privacy & Security → Open Anyway. This supersedes the September 17 notarization-only release policy. Ad-hoc Mac releases must disclose their signing status, include the first-party instructions and disable automatic updates. Functional results and pending platform checks remain reported separately.

Current Windows build completed with exit 0: **115,025,320 bytes (115.03 MB)**, unsigned, SHA-256 `ba41e14a9539eca5b00acfebafe7ef9cb3eb86d94d585a2b43037fead89b65e1`. Native lifecycle passes at 1180 × 900; 1,989 resources match the generated pack byte-for-byte (316,228,434 bytes). The native executable is 4,804,096 bytes. Controls and opt-in Explorer source are included; the development Office component is excluded. No installed Explorer certification is claimed. Evidence: `desktop/audit/compact-candidate-shell-20260923.json`.

# Compact distribution baseline

September 23 current candidate: Windows x64 NSIS build exit 0, **115,034,145 bytes**,
SHA-256 `e953d13937333ec4dbf86441c38f21cd5b9fef86c799de4046f703f7f3560fcb`,
Authenticode **NotSigned**. All 1,989 staged resources match the regenerated pack
byte-for-byte: 316,228,434 bytes (31.62% below the original baseline); with the
4,787,712-byte native host, staged payload is 321,016,146 bytes. Isolated engine
verification includes Office metadata cleanup. Native lifecycle passes at
1180 x 900, three loads/two closes with no overflow. Hidden host-only measurement
observed first view within 925 ms, total 6,589 ms; this excludes WebView children,
cold start and sustained idle. No installation or public release is certified.
Dated evidence: `audit/compact-candidate-20260923.json`,
`audit/processing-pack-20260923.json`, `audit/windows-runtime-20260923.json`.
Older measurements below are retained as history.

September 17, 2026, Windows 10 x64, Node 24.21.0. Measurements are from the
generated background-enabled development pack, before pruning. Exact data:
`../audit/pack-size-baseline.json`. Decimal MB below; this is not download size.

| Component | Bytes | MB |
| --- | ---: | ---: |
| Complete generated resource pack, 4,026 files | 462,457,716 | 462.46 |
| Node executable | 93,580,104 | 93.58 |
| ONNX Runtime Web package, including unused browser/GPU variants | 96,395,633 | 96.40 |
| Tesseract core package | 45,262,431 | 45.26 |
| Background model and provenance | 44,349,506 | 44.35 |
| Canvas Windows native package | 38,313,506 | 38.31 |
| PDF.js package | 34,497,725 | 34.50 |
| OCR languages and notices | 34,197,642 | 34.20 |
| pdf-lib package | 19,495,077 | 19.50 |
| Sharp Windows native package | 19,407,388 | 19.41 |
| Debug native host (outside pack) | 19,379,712 | 19.38 |

Current installer candidate measurements appear below. Clean installed footprint,
cold first-launch latency and sustained idle helper memory remain unmeasured.
No current installer was signed or installed. Historical September 13 candidates
do not contain the current engines.

## First optimization, validated locally

`scripts/prune-processing-pack.mjs` prunes only generated copies of four exact
package versions. It retains notices and installed repository dependencies:

- ONNX keeps the Node CPU entrypoints and their SIMD-threaded module/WASM;
  removes unused browser, GPU and training/source-map variants.
- pdf-lib keeps its actual Node CommonJS runtime, package metadata and notices;
  duplicate ESM/browser/source/type trees remain available in repository sources.
- PDF.js drops development source maps and types, retaining runtime/font/CMap assets.
- Tesseract drops embedded-WASM browser wrappers while retaining all Node CPU/SIMD
  fallback loaders and external WASM files. Language packs remain bundled.

The reduced resource pack is **315,984,793 bytes / 1,973 files**, saving
**146,472,923 bytes (31.67%)** against the baseline. The isolated processing
verifier passes, including model inference, OCR, repair, protection and document
conversion. All six retained OCR cores separately recognized the synthetic invoice
using only the copied package and its Node executable. Evidence is retained in
`audit/pruned-processing-verification.json` and `audit/ocr-fallback-verification.json`.
The first pruning attempt removed nested pdf-lib/tslib; validation caught it and
the corrected policy preserves nested dependencies.

The first September 17 Windows x64 NSIS build produced **114,955,736 bytes**
(114.96 MB), SHA-256
`e1c607320cc1cae98cc6b837de338fef39bf45559b1356e6d870847ca5e54d4e`.
Authenticode reports **NotSigned**. This is a local, uninstalled candidate; it
precedes the latest OCR WebP and Canvas background updates. Its build log reports
one completed bundle, although the outer PowerShell session returned code 1;
the wrapper result needs reconciliation during the next build. No installation,
upgrade, uninstall or download publication is certified by this artifact.
`audit/compact-candidate-first-build.json` records the measured bytes/hash.

The latest OCR WebP / Canvas background update adds 469 bytes: current resources
are **315,985,262 bytes**. NSIS staging matches every one of its 1,973 files
byte-for-byte; with the 4,787,200-byte release executable the staged payload is
**320,772,462 bytes**. NSIS uses solid LZMA. These figures exclude the uninstaller,
shortcuts, filesystem allocation and shared WebView2; installed size remains pending.

Windows reuses Microsoft Edge WebView2. The current Tauri installer downloads
Microsoft's bootstrapper if the runtime is absent. This prerequisite is disclosed
on the download page; installation is not promised offline on a clean system.
OCR data and the background model remain bundled with this candidate.

The release executable passes three native view loads and two close/reopen cycles.
A hidden-window sample observed the first load within 2,104 ms and the full
diagnostic in 8,234 ms. Host working set ranged from 9,695,232 to 25,436,160 bytes
across 63 samples. This excludes WebView child processes and runs beside a build;
it is not a cold-launch, total-process-memory or sustained-idle benchmark.
Evidence: `audit/windows-candidate-runtime.json`, `audit/windows-payload-summary.json`.

OCR/Canvas rebuild completed with exit code **0**: **114,970,410 bytes** (114.97 MB),
SHA-256 `e42d4f0f00b97d60385e11efc0b92c3c307a61f7187ad2320db9a67725ee3799`.
Authenticode remains **NotSigned**. It contains the latest OCR WebP and Canvas
changes. Its historical record is `audit/compact-candidate-ocr-canvas.json`.

The subsequent image-adjustment candidate completed with exit **0**:
**114,955,350 bytes** (114.96 MB), SHA-256
`5d72dd18f7e045ea90743614747077ec62d9822021f098e374076b3e16a8656d`, **NotSigned**.
`audit/compact-candidate-current.json` identifies this current candidate.
Its 1,974 resource files total **315,993,683 bytes** (31.67% below baseline),
all byte-identical in NSIS staging. Native executable: **4,787,712 bytes**;
combined staged payload: **320,781,395 bytes**. The isolated pack also passes
the new adjustment pixel checks. Compression changes explain why the download
can become slightly smaller while the uncompressed source pack grows.
Release diagnostic again passes three view loads/two close-reopen cycles:
first view observed within **1,910 ms**, total **7,811 ms**,
working-set peak **20,992,000 bytes** across 61 samples. The same host-only,
warm/local and noninstalled measurement limitations apply. No installer was
executed, signed or published. Cloudflare server code is not part of the client pack.

The subsequent lossless metadata change grows generated resources to
**315,999,347 bytes / 1,975 files**, still 31.67% below baseline. Its isolated
pack passes, including unchanged decoded JPEG pixels after EXIF removal. This
change and the later PDF export ranges are newer than the candidate above;
a new package must be built before claiming those changes are included.

This is runtime packaging, not permission to omit corresponding source from a
legally required source distribution. Every pruning revision requires isolated
processing and fallback-path verification before being accepted. The initial
budget is the measured baseline; reduce it only with a passing evidence set.

Release Cargo settings already use size optimization, LTO, one codegen unit and
stripping. Rebuilding a second browser or Office suite is not selected merely to
complete a route. Office needs a quality/size benchmark against the actual Web
engine. Optional assets require a visible, consented and authenticated installation
flow before any smaller-installer claim; no such end-user flow exists yet.

## Platform state

| Platform | Present build configuration | Current evidence / missing work |
| --- | --- | --- |
| Windows x64 | Tauri NSIS, per-user installation | Current unsigned release packaging, staged payload and native lifecycle pass; install/upgrade/uninstall, installed Explorer and signing pending. |
| Windows ARM64/x86 | No verified package | Unsupported until dependency/build/native checks establish support. |
| macOS Apple Silicon / Intel | Separate CI DMG targets, minimum 13.0 configured | Current platform execution unverified. Configured minimum is not tested compatibility. Production signing and notarization required; ad-hoc candidates only. |
| Linux x64 | Ubuntu 22.04 CI DEB/AppImage targets | Current native/runtime/integration unverified; no universal distro or glibc claim. RPM/ARM builds not established. |

Release manifest has no public artifacts. Download pages and paid checkout remain
closed. No publication, deployment, credential use or signing is authorized by
these measurements.
