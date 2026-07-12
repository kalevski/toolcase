# Model provenance — mobilenetv2-nsfw

`model.onnx` is the real classifier: the GantMan/nsfw_model MobileNetV2
(224×224, 5 classes), converted to ONNX and statically quantized to int8.
It is produced end-to-end by [`tools/preparemodel/prepare.py`](../tools/preparemodel/prepare.py)
— running that pipeline regenerates `model.onnx` and writes the derived
fields (`sha256`, `input`, `output`, `normalize`, `labels`, `quantization`)
into `manifest.yml`.

## Source lineage

- Upstream: [`GantMan/nsfw_model`](https://github.com/GantMan/nsfw_model) — a
  Keras MobileNetV2 (224×224 input) classifier trained on 5 classes:
  `drawings, hentai, neutral, porn, sexy` (alphabetical, matches
  `manifest.yml`'s `labels` order — output-tensor index → class name).
- Pinned source: the `1.2.0` release asset `mobilenet_v2_140_224.1.zip`
  (sha256 `22c0892695929639c16ea302996b8f64df9c52e7a6c1d874c1de1047bfe109f7`),
  which contains the TF SavedModel this pipeline converts. `prepare.py`
  verifies the digest before converting.

## Conversion + quantization pipeline

Automated end-to-end by `tools/preparemodel/prepare.py`; the steps it runs:

1. **tf2onnx** (opset 13) on the SavedModel. The serving signature's own
   tensor names are kept: input `input` (float32 `[N,224,224,3]` NHWC),
   output `prediction` (`[N,5]`, softmax).
2. **Static QDQ per-channel int8 quantization** (`quantize_static`,
   activations QUInt8 / weights QInt8) calibrated over a directory of
   representative photos (`--calib-dir`, 30+ recommended).
   **Dynamic quantization is deliberately not used**: MobileNetV2's
   depthwise convolutions collapse under per-tensor dynamic weight
   quantization — measured on real photos, `quantize_dynamic` flipped the
   argmax vs fp32 on 3 of 6 images (max score drift 0.84), while calibrated
   static QDQ agreed 6/6 with mean drift ~0.01.
3. **The classifier head (final Gemm + Softmax) stays fp32**
   (`nodes_to_exclude`), so the output is an exact softmax distribution
   summing to 1 rather than scores snapped to ~1/255 quantization steps —
   full-resolution probabilities for the `policy` thresholds, and no risk of
   a re-softmax by `internal/model.toProbabilities`' pass-through check.

`manifest.yml`'s `input`/`output`/`normalize` blocks record the exact tensor
contract (`input`, NHWC, 224×224, pixel/255 with zero mean / unit std,
output `prediction`) so `internal/imaging` and `internal/model` never
hardcode these constants — a future EfficientNet-Lite or CLIP-head swap is a
`model/` directory swap, not a binary change.

## Calibration set (this artifact)

The committed `model.onnx` was calibrated on 30 varied real photographs
(picsum.photos ids 1, 15, 22, 33, 42, 48, 58, 76, 88, 91, 102, 110, 119,
128, 133, 145, 152, 160, 169, 175, 183, 190, 201, 211, 219, 225, 231, 244,
250, 258, fetched at 448×448). Calibration only sets activation ranges —
any similarly varied photo set reproduces equivalent behavior, but the exact
sha256 depends on the set used.

## Measured numbers (this artifact)

- Size: 17 MB fp32 → **4.9 MB int8**.
- int8 vs fp32 fidelity: argmax agreement 6/6 on a real-photo spot check,
  mean max-score drift 0.010, worst 0.045.
- Latency: **~6 ms/inference** via the served API on an M-series CPU
  (warm session, int8, single image).
- Published upstream baseline: ~90% top-1 across the 5 classes (upstream
  `training_results.txt` shows ~0.91 val accuracy) — inside imagewarden's
  85–90% accuracy target (spec §3.2).
- Re-verify with `imagewarden classify <labeled-sample-dir>/*` after any
  regeneration — that command doubles as the offline accuracy/threshold
  tuning tool (spec §11); don't tune `policy.*_threshold` by feel.

## Reproducing

```bash
cd tools/preparemodel
pip install -r requirements.txt
python prepare.py --calib-dir /path/to/representative-photos
# writes model/model.onnx, updates model/manifest.yml (sha256 included)
```

The tf2onnx conversion of the pinned source is deterministic in behavior;
the exact bytes (and therefore the sha256) additionally depend on the
calibration image set, so keep or document the calibration images used for a
release build. See `tools/preparemodel/prepare.py` for the exact upstream
pin and quantization flags in effect — this document describes the pipeline
shape, that script is the source of truth.
