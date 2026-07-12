#!/usr/bin/env python3
"""Offline model pipeline: fp32 NSFW model -> ONNX -> int8 -> model/ artifacts.

NEVER runs in the Docker build or at runtime (spec §3.2, §9.1). Dev-machine /
CI-model-job only — see README.md in this directory.

Pipeline:
  1. Download the pinned fp32 source archive (GantMan/nsfw_model 1.2.0
     release zip, a TF SavedModel), verifying it against SOURCE_SHA256
     before use, and unzip it.
  2. Convert the SavedModel to ONNX via tf2onnx. The graph's own tensor
     names are kept: input `input` (float32 [N,224,224,3] NHWC), output
     `prediction` ([N,5], softmax) — matches model/manifest.yml.
  3. Quantize to int8 with STATIC QDQ per-channel quantization over a
     calibration image set (--calib-dir). Dynamic quantization must not be
     used here: MobileNetV2's depthwise convolutions collapse under
     per-tensor dynamic weight quantization (argmax flips vs fp32 on real
     photos), while calibrated QDQ stays within ~1% of fp32. The classifier
     head (final Gemm + Softmax) is excluded so the output scores remain
     full-resolution fp32 probabilities summing to exactly 1 — a quantized
     head snaps scores to ~1/255 steps, which both coarsens the policy
     thresholds and can trip probability-sum checks downstream.
  4. Compute the sha256 of the resulting model.onnx.
  5. Write model/model.onnx and update model/manifest.yml in place — the
     Go binary (internal/model.LoadManifest) treats manifest.yml as the
     single source of truth for the sha256, input/output contract,
     normalization, and labels, so this script writes there rather than
     anywhere in Go code (spec §6.1).

Output (model/model.onnx) is committed as a plain git blob (task 029);
model/manifest.yml is a plain-text diff. The tf2onnx conversion of the pinned source is
deterministic; the final digest additionally depends on the calibration set,
so keep (or document) the calibration images used for a release build.
"""
import argparse
import glob
import hashlib
import os
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

import yaml  # PyYAML

# Pin the upstream fp32 source (GantMan/nsfw_model 1.2.0 release) by URL +
# sha256, so the conversion is reproducible and the download is verified
# before anything downstream touches it. The zip contains a TF SavedModel at
# SAVED_MODEL_SUBDIR (plus tflite/tfjs exports this pipeline ignores).
SOURCE_URL = "https://github.com/GantMan/nsfw_model/releases/download/1.2.0/mobilenet_v2_140_224.1.zip"  # PIN
SOURCE_SHA256 = "22c0892695929639c16ea302996b8f64df9c52e7a6c1d874c1de1047bfe109f7"  # PIN
SAVED_MODEL_SUBDIR = "mobilenet_v2_140_224"

# Must match model/manifest.yml's input/output/labels blocks (spec §6.1) —
# this script is the thing that derives those fields, so keep it and the
# manifest in lockstep by hand whenever either changes. The names are the
# graph's own (tf2onnx preserves them from the SavedModel signature).
INPUT_NAME = "input"             # graph input tensor name
OUTPUT_NAME = "prediction"       # graph output tensor name (softmax head)
INPUT_SHAPE = [1, 224, 224, 3]   # NHWC, matches manifest.yml input.layout/width/height
LABELS = ["drawings", "hentai", "neutral", "porn", "sexy"]  # order == output index

# Normalization applied by internal/imaging at inference time; recorded in
# the manifest (never hardcoded in Go) so it stays derived from how the
# source model was trained, not guessed at by the runtime.
NORMALIZE_SCALE = 255.0
NORMALIZE_MEAN = [0.0, 0.0, 0.0]
NORMALIZE_STD = [1.0, 1.0, 1.0]


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download_source(dest_dir):
    """Fetch the pinned fp32 archive into dest_dir, verifying its sha256.

    Idempotent: if a file matching SOURCE_SHA256 already sits at the
    expected path, the download is skipped.
    """
    dest_path = os.path.join(dest_dir, os.path.basename(SOURCE_URL))
    if os.path.exists(dest_path) and sha256_file(dest_path) == SOURCE_SHA256:
        print(f"source already present and verified: {dest_path}")
        return dest_path

    print(f"downloading {SOURCE_URL} ...")
    urllib.request.urlretrieve(SOURCE_URL, dest_path)

    digest = sha256_file(dest_path)
    if digest != SOURCE_SHA256:
        raise SystemExit(
            f"source sha256 mismatch: expected {SOURCE_SHA256}, got {digest}. "
            "Refusing to convert an unverified download."
        )
    return dest_path


def unzip_source(zip_path, work_dir):
    """Extract the release zip and return the SavedModel directory inside it."""
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(work_dir)
    saved_model_dir = os.path.join(work_dir, SAVED_MODEL_SUBDIR)
    if not os.path.isdir(saved_model_dir):
        raise SystemExit(f"expected SavedModel dir {SAVED_MODEL_SUBDIR!r} not found in {zip_path}")
    return saved_model_dir


def convert_to_onnx(saved_model_dir, work_dir, opset):
    """Run the SavedModel through tf2onnx, producing model_fp32.onnx.

    No --inputs/--outputs renaming: the serving signature already exposes
    `input` / `prediction`, and the manifest records those names, so the
    graph's own names flow through untouched.
    """
    fp32_path = os.path.join(work_dir, "model_fp32.onnx")
    cmd = [
        sys.executable, "-m", "tf2onnx.convert",
        "--saved-model", saved_model_dir,
        "--output", fp32_path,
        "--opset", str(opset),
    ]
    print("running:", " ".join(cmd))
    subprocess.run(cmd, check=True)
    return fp32_path


def head_node_names(fp32_path):
    """Return the names of the classifier-head nodes to exclude from
    quantization: the Softmax producing the graph output plus the Gemm/MatMul
    feeding it. Resolved from the graph rather than hardcoded so a tf2onnx
    version bump that renames nodes doesn't silently quantize the head."""
    import onnx

    m = onnx.load(fp32_path)
    graph_outputs = {o.name for o in m.graph.output}
    excluded = []
    for node in m.graph.node:
        if node.op_type == "Softmax" and set(node.output) & graph_outputs:
            excluded.append(node.name)
            feeder_outputs = set(node.input)
            for prev in m.graph.node:
                if prev.op_type in ("Gemm", "MatMul") and set(prev.output) & feeder_outputs:
                    excluded.append(prev.name)
    if not excluded:
        raise SystemExit("no output-feeding Softmax found; head exclusion would be a no-op")
    return excluded


def quantize(fp32_path, onnx_path, calib_dir, work_dir):
    """Static QDQ per-channel int8 quantization calibrated on calib_dir."""
    import numpy as np
    from PIL import Image
    from onnxruntime.quantization import (
        CalibrationDataReader, QuantFormat, QuantType, quantize_static,
    )
    from onnxruntime.quantization.shape_inference import quant_pre_process

    paths = sorted(
        p for pat in ("*.jpg", "*.jpeg", "*.png", "*.webp")
        for p in glob.glob(os.path.join(calib_dir, pat))
    )
    if len(paths) < 10:
        raise SystemExit(
            f"--calib-dir {calib_dir} has {len(paths)} images; need at least 10 "
            "representative photos for calibration (30+ recommended)."
        )

    def prep(path):
        im = Image.open(path).convert("RGB").resize(
            (INPUT_SHAPE[2], INPUT_SHAPE[1]), Image.BILINEAR)
        return (np.asarray(im, np.float32) / NORMALIZE_SCALE)[None]

    class Reader(CalibrationDataReader):
        def __init__(self):
            self.it = iter([{INPUT_NAME: prep(p)} for p in paths])

        def get_next(self):
            return next(self.it, None)

    pre_path = os.path.join(work_dir, "model_fp32_pre.onnx")
    quant_pre_process(fp32_path, pre_path)  # shape inference + optimization first

    quantize_static(
        pre_path,
        onnx_path,
        Reader(),
        quant_format=QuantFormat.QDQ,
        activation_type=QuantType.QUInt8,
        weight_type=QuantType.QInt8,
        per_channel=True,
        nodes_to_exclude=head_node_names(pre_path),
    )
    print(f"quantized (static QDQ, per-channel, fp32 head) over {len(paths)} calibration images")


def write_manifest(manifest_path, digest):
    """Update manifest.yml in place: load, set derived fields, dump.

    Only the fields this pipeline actually derives are touched — name/version
    are provenance metadata set by hand when the upstream model version
    changes, not by this script.
    """
    with open(manifest_path) as f:
        manifest = yaml.safe_load(f)

    manifest["sha256"] = digest
    manifest["labels"] = LABELS
    manifest["input"] = {
        "name": INPUT_NAME,
        "layout": "NHWC",
        "width": INPUT_SHAPE[1],
        "height": INPUT_SHAPE[2],
    }
    manifest["output"] = {"name": OUTPUT_NAME}
    manifest["normalize"] = {
        "scale": NORMALIZE_SCALE,
        "mean": NORMALIZE_MEAN,
        "std": NORMALIZE_STD,
    }
    manifest["quantization"] = "int8"

    with open(manifest_path, "w") as f:
        yaml.safe_dump(manifest, f, sort_keys=False)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--calib-dir",
        required=True,
        help="directory of representative photos (jpg/png/webp) used to calibrate "
             "the static int8 quantization; 30+ varied real images recommended",
    )
    ap.add_argument(
        "--output-dir",
        default=os.path.join(os.path.dirname(__file__), "..", "..", "model"),
        help="directory to write model.onnx and update manifest.yml in (default: ../../model)",
    )
    ap.add_argument("--opset", type=int, default=13, help="ONNX opset to target (default: 13)")
    ap.add_argument(
        "--cache-dir",
        default=os.path.join(tempfile.gettempdir(), "imagewarden-preparemodel"),
        help="directory to cache the downloaded fp32 source in (default: a temp dir)",
    )
    args = ap.parse_args()

    out_dir = os.path.abspath(args.output_dir)
    os.makedirs(out_dir, exist_ok=True)
    onnx_path = os.path.join(out_dir, "model.onnx")
    manifest_path = os.path.join(out_dir, "manifest.yml")

    os.makedirs(args.cache_dir, exist_ok=True)

    source_path = download_source(args.cache_dir)

    with tempfile.TemporaryDirectory(prefix="preparemodel-") as work_dir:
        saved_model_dir = unzip_source(source_path, work_dir)
        fp32_path = convert_to_onnx(saved_model_dir, work_dir, args.opset)
        quantize(fp32_path, onnx_path, args.calib_dir, work_dir)

    digest = sha256_file(onnx_path)
    write_manifest(manifest_path, digest)

    print(f"wrote {onnx_path}")
    print(f"model.onnx sha256: {digest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
