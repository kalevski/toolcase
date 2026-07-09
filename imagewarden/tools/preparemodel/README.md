# tools/preparemodel

Offline model pipeline: fp32 NSFW model → ONNX → int8 → `model/` artifacts
(spec §3.2, §9.1).

## What it does

`prepare.py` downloads the pinned fp32 source model (GantMan/nsfw_model
lineage), converts it to ONNX with `tf2onnx` (input `input_1`, shape
`[1,224,224,3]` NHWC), applies `onnxruntime.quantization.quantize_dynamic` to
produce an int8 model, and writes `model/model.onnx` + the derived fields of
`model/manifest.yml` (`sha256`, `input`, `normalize`, `labels`,
`quantization`). `model/manifest.yml` stays the single source of truth the Go
binary reads (`internal/model.LoadManifest`) — this script updates it in
place rather than duplicating any of those constants in Go.

## Running it

```bash
cd tools/preparemodel
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python prepare.py                       # writes ../../model/{model.onnx,manifest.yml}
```

`--output-dir` defaults to `../../model` (i.e. `repo/imagewarden/model`) and
can be overridden; `--opset` defaults to `13`. The script prints the
`model.onnx` sha256 digest to stdout. Re-running it is idempotent: the
pinned source archive is re-downloaded only if missing or if its sha256 no
longer matches, and the same source always reproduces the same digest and
manifest content.

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

## Output and Git LFS

The pipeline's output, `model/model.onnx`, is committed to the repository
through Git LFS (task 029, `.gitattributes`: `model/*.onnx filter=lfs
diff=lfs merge=lfs -text`). `model/manifest.yml` and `model/MODEL.md` are
plain text and diff normally. After running `prepare.py`, review the
`manifest.yml` diff and commit both files together so the sha256 in the
manifest always matches the committed `model.onnx`.

See `model/MODEL.md` for full provenance (upstream source, conversion
commands, eval numbers).
