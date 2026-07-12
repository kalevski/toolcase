# tools/preparemodel

Offline model pipeline: fp32 NSFW model → ONNX → int8 → `model/` artifacts
(spec §3.2, §9.1).

## What it does

`prepare.py` downloads the pinned fp32 source archive (GantMan/nsfw_model
1.2.0 release zip, a TF SavedModel), converts it to ONNX with `tf2onnx`
(keeping the graph's own tensor names: input `input`, `[N,224,224,3]` NHWC;
output `prediction`), applies **static QDQ per-channel int8 quantization**
calibrated on a directory of representative photos, and writes
`model/model.onnx` + the derived fields of `model/manifest.yml` (`sha256`,
`input`, `output`, `normalize`, `labels`, `quantization`).
`model/manifest.yml` stays the single source of truth the Go binary reads
(`internal/model.LoadManifest`) — this script updates it in place rather
than duplicating any of those constants in Go.

Dynamic quantization is deliberately not used, and the classifier head
(final Gemm + Softmax) is excluded from quantization — see
`model/MODEL.md` for the measured fidelity numbers behind both choices.

## Running it

```bash
cd tools/preparemodel
python3 -m venv .venv                   # Python 3.9–3.12 (tensorflow 2.16 has no 3.13+ wheels)
source .venv/bin/activate
pip install -r requirements.txt
python prepare.py --calib-dir ~/photos # writes ../../model/{model.onnx,manifest.yml}
```

`--calib-dir` is required: a directory of 30+ varied real photos
(jpg/png/webp) used to calibrate activation ranges. `--output-dir` defaults
to `../../model` (i.e. `repo/imagewarden/model`) and can be overridden;
`--opset` defaults to `13`. The script prints the `model.onnx` sha256 digest
to stdout. The pinned source archive is re-downloaded only if missing or if
its sha256 no longer matches; the output digest depends on the calibration
set, so keep (or document) the calibration images used for a release build.

## Where this does NOT run

This is a **dev-machine / CI-model-job tool only**. It must never run inside
the Docker build or at container runtime:

- It is not invoked by the `Dockerfile` (task 032) — the image only ever
  `COPY`s the already-committed `model/` directory.
- `tools/` is excluded from the Docker build context via `.dockerignore`
  (task 033), so even `COPY . .` in the build stage can't accidentally pull
  it in.
- `requirements.txt` here (`tf2onnx`, `tensorflow`, pinned `onnxruntime`,
  `PyYAML`) is a separate, Python-only dependency set from the Go module —
  it is never installed in the image.

## Output

The pipeline's output, `model/model.onnx`, is committed to the repository
as a plain git blob (task 029; ~5 MB, well under GitHub's limits).
`model/manifest.yml` and `model/MODEL.md` are
plain text and diff normally. After running `prepare.py`, review the
`manifest.yml` diff and commit both files together so the sha256 in the
manifest always matches the committed `model.onnx`.

See `model/MODEL.md` for full provenance (upstream source, conversion
commands, eval numbers).
