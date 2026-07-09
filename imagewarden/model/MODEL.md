# Model provenance — mobilenetv2-nsfw

## ⚠️ Placeholder notice

**`model.onnx` in this directory is currently a placeholder, not the trained
classifier.** It is a tiny 295-byte ONNX graph (`ReduceMean` → `MatMul` against
a fixed weight matrix) with the correct input/output contract — input
`input_1` float32 `[1,224,224,3]`, output `[1,5]` — so `internal/model.Load`
and the `//go:build ort` integration test (spec §11) can load and run
*something* end-to-end while the rest of the pipeline is built. **Its scores
are meaningless** (a fixed linear projection of the per-channel mean pixel
value) and must not be used for any real classification decision.

Replace it with the real int8 weights produced by [`tools/preparemodel`](../tools/preparemodel/)
(task 030) — running that pipeline regenerates `model.onnx` and prints the
`sha256` to paste into `manifest.yml`.

## Source lineage

- Upstream: [`GantMan/nsfw_model`](https://github.com/GantMan/nsfw_model) — a
  Keras MobileNetV2 (224×224 input) classifier trained on 5 classes:
  `drawings, hentai, neutral, porn, sexy` (alphabetical, matches
  `manifest.yml`'s `labels` order — output-tensor index → class name).
- The fp32 weights (`mobilenet_v2_140_224` / `nsfw_mobilenet2.224x224.h5`
  release artifact) are pinned by `tools/preparemodel/prepare.py` to a specific
  upstream commit/release tag; see that script for the exact pin in effect.

## Conversion + quantization pipeline

Automated end-to-end by `tools/preparemodel/prepare.py` (task 030); the
individual steps it runs:

```bash
# Keras SavedModel/HDF5 -> ONNX (opset 13), input named input_1, NHWC [1,224,224,3]
python -m tf2onnx.convert --saved-model saved_model \
    --output model_fp32.onnx --opset 13 \
    --inputs input_1:0[1,224,224,3]

# dynamic int8 weight quantization
python -c "from onnxruntime.quantization import quantize_dynamic, QuantType; \
    quantize_dynamic('model_fp32.onnx', 'model.onnx', weight_type=QuantType.QInt8)"

sha256sum model.onnx   # digest goes into manifest.yml's `sha256` field
```

`manifest.yml`'s `input`/`normalize` block records the exact tensor contract
(`input_1`, NHWC, 224×224, pixel/255 with zero mean / unit std) so
`internal/imaging` and `internal/model` never hardcode these constants — a
future EfficientNet-Lite or CLIP-head swap is a `model/` directory swap, not a
binary change.

## Eval numbers (real model, once `tools/preparemodel` output replaces the placeholder)

- Published baseline (GantMan fp32 model): **~90% top-1** across the 5
  classes — inside imagewarden's 85–90% accuracy target (spec §3.2).
- Size: **~24 MB fp32 → ~7–10 MB int8** after dynamic quantization.
- Latency: **~20–60 ms/inference** on 2–4 CPU cores (ONNX Runtime, int8,
  single image, warm session).
- Re-verify with `imagewarden classify <labeled-sample-dir>/*` after swapping
  in the real weights — that command doubles as the offline accuracy/threshold
  tuning tool (spec §11); don't tune `policy.*_threshold` by feel.

## Reproducing

```bash
cd tools/preparemodel
pip install -r requirements.txt
python prepare.py   # writes model/model.onnx, prints sha256 for manifest.yml
```

See `tools/preparemodel/prepare.py` for the exact upstream pin and quantization
flags in effect at any given time — this document describes the pipeline
shape, that script is the source of truth for versions.
