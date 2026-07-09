#!/usr/bin/env python3
"""Offline model pipeline: fp32 NSFW model -> ONNX -> int8 -> model/ artifacts.

NEVER runs in the Docker build or at runtime (spec §3.2, §9.1). Dev-machine /
CI-model-job only — see README.md in this directory.

Pipeline:
  1. Download the pinned fp32 source model (GantMan/nsfw_model lineage),
     verifying it against SOURCE_SHA256 before use.
  2. Convert it to ONNX via tf2onnx, input named `input_1`, shape
     [1, 224, 224, 3] (NHWC) — matches model/manifest.yml.
  3. Apply onnxruntime.quantization.quantize_dynamic to produce the int8
     model (~7-10 MB, spec §3.2).
  4. Compute the sha256 of the resulting model.onnx.
  5. Write model/model.onnx and update model/manifest.yml in place — the
     Go binary (internal/model.LoadManifest) treats manifest.yml as the
     single source of truth for the sha256, input contract, normalization,
     and labels, so this script writes there rather than anywhere in Go
     code (spec §6.1).

Output (model/model.onnx) is committed via Git LFS (task 029); model/manifest.yml
is a plain-text diff. Re-running this script with the same pinned source is
idempotent: it skips the download if the pinned archive is already present
locally with a matching sha256, and reproduces the same digest and manifest.
"""
import argparse
import hashlib
import os
import subprocess
import sys
import tempfile
import urllib.request

import yaml  # PyYAML

# Pin the upstream fp32 source (GantMan/nsfw_model lineage) by URL + expected
# sha256, so the conversion is reproducible and the download is verified
# before anything downstream touches it.
SOURCE_URL = "https://github.com/GantMan/nsfw_model/releases/download/1.2.0/nsfw_mobilenet2.224x224.h5"  # PIN
SOURCE_SHA256 = "<PIN — sha256 of the downloaded fp32 .h5/SavedModel archive>"

# Must match model/manifest.yml's input/labels blocks (spec §6.1) — this
# script is the thing that derives those fields, so keep it and the manifest
# in lockstep by hand whenever either changes.
INPUT_NAME = "input_1"           # graph input node name
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


def convert_to_onnx(source_path, work_dir, opset):
    """Run the fp32 source model through tf2onnx, producing model_fp32.onnx.

    The GantMan/nsfw_model release ships as a Keras HDF5 (.h5) file, so this
    uses tf2onnx's --keras entry point; a SavedModel directory would instead
    take --saved-model. Both take the same --inputs/--opset shape, and both
    match the command documented in model/MODEL.md.
    """
    fp32_path = os.path.join(work_dir, "model_fp32.onnx")
    source_flag = "--keras" if source_path.endswith((".h5", ".keras")) else "--saved-model"
    cmd = [
        sys.executable, "-m", "tf2onnx.convert",
        source_flag, source_path,
        "--output", fp32_path,
        "--opset", str(opset),
        "--inputs", f"{INPUT_NAME}:0[{','.join(str(d) for d in INPUT_SHAPE)}]",
    ]
    print("running:", " ".join(cmd))
    subprocess.run(cmd, check=True)
    return fp32_path


def quantize(fp32_path, onnx_path):
    """Dynamic int8 weight quantization: fp32 ONNX graph -> int8 model.onnx."""
    from onnxruntime.quantization import quantize_dynamic, QuantType

    quantize_dynamic(fp32_path, onnx_path, weight_type=QuantType.QInt8)


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
        fp32_path = convert_to_onnx(source_path, work_dir, args.opset)
        quantize(fp32_path, onnx_path)

    digest = sha256_file(onnx_path)
    write_manifest(manifest_path, digest)

    print(f"wrote {onnx_path}")
    print(f"model.onnx sha256: {digest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
