# Local background removal

The on-demand worker runs the existing IMG.LY-supplied ISNET uint8 model through
ONNX Runtime Web's Node WASM backend, with one CPU thread and no runtime downloads.
Input is limited to still JPG/PNG/WebP, 64 MB and 12 megapixels. It letterboxes to
1024×1024, runs inference, maps the soft mask back to source dimensions and
multiplies the original alpha. RGB values are preserved; metadata is omitted.

The model and its supplier manifest have pinned SHA-256 values in
`shared/background-model.mjs`. `sync-background-model.mjs` assembles verified
chunks from the recovered cache. Explicit `--download` permits checksum-verified
public downloads during build preparation only. Processing reads installed local
model bytes and fails if their size/hash is wrong. No selected file data is sent.

A three-minute worker deadline and cancellation terminate inference. The Windows
native Job Object owns its decoder descendants. There is no persistent model at
idle, and the JavaScript heap limit does not bound all native/WASM memory.
Fully empty or unchanged masks fail instead of claiming successful separation.
PNG encoding is decoded again and compared to expected RGBA before publication.

Tests use the real model and known synthetic subject/background regions. They
check RGB identity, alpha multiplication, image dimensions, metadata absence,
malformed/oversized input, cancellation, licensed batches and collisions. The
fixture is visually inspected on a grey background. Hair, glass, photographs,
fine detail and low contrast need broader quality fixtures; no comparative
quality/performance claim is made. Manual mask editing is unfinished.

The supplier labels ISNET MIT. Exact transformed-model copyright/license text,
export/quantization provenance and full redistribution/source compliance remain
release gates. See `licenses/background-model-NOTICE.txt`. Local tests do not
authorize release or resolve that legal review.

Current upstream DIS LICENSE.md is Apache-2.0; the installed IMG.LY declaration
says MIT. Both records are retained. The exact license applicable to the supplied
quantized model and its export/quantization provenance remain unresolved.

## Measured Web comparison

`node desktop/tests/background-parity.mjs` executes the actual Web worker in
Chrome against the same pinned CPU uint8 model and synthetic inputs. Cleanup is
disabled. Model files are served only from a checksum-verified loopback cache.
Fixture source: `tests/fixtures/generate-complex.py`, project AGPL-3.0-only; no
customer images. Input hashes are recorded with every result.

Canvas letterboxing and mask resampling replaced Sharp linear resampling after
the comparison exposed edge differences. Native/browser preprocessing differs
by at most one channel unit on these fixtures. Existing source RGB is preserved
outside Canvas compositing; its alpha is multiplied by the mapped mask.

| Fixture | Previous alpha MAE | Current alpha MAE | Foreground IoU | Maximum alpha difference |
| --- | ---: | ---: | ---: | ---: |
| Product | 0.473856 | 0.090598 | 0.998296 | 124 |
| Synthetic hair | 0.708538 | 0.186701 | 0.996254 | 128 |
| Soft source alpha | 0.963663 | 0.746734 | 0.991846 | 160 |

Alpha MAE uses byte units, 0–255. Existing alpha never increases. Maximum edge
differences remain material, so reduced average error is not a full parity pass.
The comparison montage was visually inspected: both retain the broad subject;
synthetic hair can retain border colour and soft edges can lose detail. Photographs,
Web's default fp16/GPU path and cleanup need separate tests. Evidence:
`audit/background-workers-linear-baseline.json`, `audit/background-workers-canvas.json`.

Independent generator masks also expose errors common to both engines. Product
ground-truth alpha MAE is 0.547 Web / 0.548 Desktop; synthetic hair 1.693 / 1.706;
soft source alpha 1.935 / 1.938. Both soft-alpha results lose about 3.22% of intended
alpha mass. These measurements reinforce the fine-edge limitation; agreement
between implementations alone does not establish correct segmentation. Script:
`tests/background-ground-truth.mjs`; report: `audit/background-ground-truth.json`.
