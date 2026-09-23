# Desktop HEIC primary-photo conversion

The current port converts the primary still photo to JPG. It accepts HEVC still
HEIC compatible brands and refuses timed movie boxes and sequence brands. A
collection's additional top-level images are not exported; the saved warning
reports their count. A compatible `hevc` brand alone does not prove a sequence.

Input is bounded to 64 MB and 25 megapixels for the primary photo, with at most
32 top-level images and a two-minute worker deadline. The separate worker uses
the already-installed heic-to 1.5.2 decoder: libheif 1.22.2, libde265 1.0.16,
without unsafe eval. Its bundled Node branch uses CommonJS globals; packaging
changes only its final export and verifies the exact source SHA-256. The generated
decoder is accompanied by its package license and provenance record.

HDR/depth/animation data and metadata are not retained. Transparency is flattened
onto white. Colour profiles and orientation need broader real-device fixtures;
no HDR, wide-gamut, all-HEIF-codec or multi-image fidelity claim is made.

The upstream example was fetched only into `.artifacts/heif-upstream-example.heic`
from `https://raw.githubusercontent.com/strukturag/libheif/master/examples/example.heic`.
SHA-256: `7f8b363e4936c0666a25f64f3a92fda10bd8e5453be4592530b65a55dd98f3f2`.
It has two 1280x854 images and one primary photo. JPG was visually inspected.
The opt-in fixture test uses `SORA_HEIC_TEST_FIXTURE`, independently decodes JPG,
compares colours to source decoding, and exercises offline batches/collisions.
No third-party photograph is redistributed in the application or default tests.

LGPL and corresponding-source obligations, exact codec provenance and legal
review remain release gates. The copied package license alone is not sufficient
redistribution clearance. See the recovery ledger for collected test/pack results.
