#!/usr/bin/env python3
"""Offline accuracy / threshold-tuning harness for imagewarden (spec §3.2, §11).

This is the analysis layer on top of the `imagewarden classify` subcommand
(task 026): `classify` emits one JSON verdict per file, this harness consumes
that JSONL over a *labeled* sample directory and reports how well the model +
policy do — top-1 accuracy, a per-class confusion matrix, decision-level
precision/recall against the policy, and a `block_threshold` sweep so an
operator picks the knee "from output, not by feel" (spec §11).

It never re-implements inference: it shells out to `imagewarden classify`
(or reads a captured JSONL stream via --from-jsonl), so the numbers always
reflect production preprocessing and policy. The only thing it computes itself
is the threshold sweep, which recomputes `unsafe_score = Σ scores[unsafe]`
from the raw per-class scores already in the verdict — one classify pass feeds
the whole sweep, no re-inference.

Dependencies: Python 3.8+ standard library only (no numpy / PyYAML / third
party). It needs the `imagewarden` binary on PATH (or --bin ./imagewarden) and
a config it can load + a model it can run — like `tools/preparemodel`, this is
a dev-machine / CI-model-job tool, never shipped in the image (`tools/` is in
`.dockerignore`, task 033).

Layout of the sample directory (ground truth = the parent directory name):

    samples/<label>/<file>          e.g. samples/porn/img001.jpg
                                         samples/neutral/img002.png

See README.md for how to point --samples at a private labeled corpus.
"""

import argparse
import json
import math
import os
import subprocess
import sys

# The model's five labels, in the fixed manifest order (spec §6.1). Confusion
# matrix rows/cols use exactly this order; ground-truth directory names must be
# a subset of it (unknown label dirs are warned about and skipped).
LABELS = ["drawings", "hentai", "neutral", "porn", "sexy"]

# Default "unsafe" positive set — the policy's unsafe_classes (spec §4.2/§6).
# Overridable with --unsafe-classes for a policy that scores a different set.
DEFAULT_UNSAFE = ["porn", "hentai"]

# Image extensions the harness discovers under samples/ (spec §5 decoders:
# jpeg/png/gif via stdlib, webp via golang.org/x/image). Format is sniffed by
# classify, not trusted from the extension; this is only the discovery filter.
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

# The spec §6.1 default block_threshold — annotated in the sweep table so the
# operator sees where the shipped policy sits on the precision/recall curve.
DEFAULT_BLOCK_THRESHOLD = 0.80


# ── sample discovery ───────────────────────────────────────────────────────


def discover(samples_dir):
    """Walk samples/<label>/* and return [(path, label)], sorted for stable
    output. label is the immediate parent directory name. Files whose label is
    not one of the model's five classes are dropped with a warning (they can
    never be a correct top-1 prediction and would break the 5×5 matrix)."""
    found = []
    unknown = set()
    for label in sorted(os.listdir(samples_dir)):
        class_dir = os.path.join(samples_dir, label)
        if not os.path.isdir(class_dir):
            continue
        files = []
        for name in sorted(os.listdir(class_dir)):
            ext = os.path.splitext(name)[1].lower()
            if ext in IMAGE_EXTS:
                files.append(os.path.join(class_dir, name))
        if not files:
            continue
        if label not in LABELS:
            unknown.add(label)
            continue
        for p in files:
            found.append((p, label))
    if unknown:
        warn(
            "ignoring sample dirs with labels not in the model's classes: "
            + ", ".join(sorted(unknown))
            + " (known: " + ", ".join(LABELS) + ")"
        )
    return found


# ── obtaining verdicts (shell classify, or read captured JSONL) ─────────────


def run_classify(bin_path, config, paths):
    """Run `imagewarden classify` over every path in ONE pass and parse its
    stdout JSONL (one verdict object per line, keyed by "file"). Returns
    {file_path: verdict_dict}. Per-file failures go to classify's stderr and
    are surfaced as warnings; they simply don't appear in the returned map, so
    the caller counts them as errors. A non-zero exit from classify (partial
    success) is expected and not fatal here."""
    cmd = [bin_path, "classify"]
    if config:
        cmd += ["--config", config]
    cmd += paths
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True)
    except FileNotFoundError:
        fail("classify binary not found: %s (set --bin)" % bin_path)
    if proc.stderr.strip():
        # classify prints per-file errors and warnings as JSONL/plain text on
        # stderr; echo it so the operator sees decode failures etc.
        for line in proc.stderr.splitlines():
            warn("classify: " + line)
    return parse_jsonl(proc.stdout.splitlines())


def parse_jsonl(lines):
    """Parse verdict lines into {file_path: verdict}. Lines without a "file"
    key or that don't parse are skipped with a warning."""
    verdicts = {}
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as e:
            warn("skipping unparseable JSONL line %d: %s" % (i + 1, e))
            continue
        f = obj.get("file")
        if not f:
            warn("skipping JSONL line %d with no \"file\" key" % (i + 1))
            continue
        verdicts[f] = obj
    return verdicts


def load_jsonl_file(path):
    with open(path, "r", encoding="utf-8") as fh:
        return parse_jsonl(fh.readlines())


# ── metrics ────────────────────────────────────────────────────────────────


def argmax_label(scores):
    """Predicted class = argmax over the fixed LABELS order; ties resolve to
    the earlier label (strict >), so the result is deterministic and matches
    the manifest label order (spec §6.1)."""
    best, best_score = None, -math.inf
    for lab in LABELS:
        s = float(scores.get(lab, 0.0))
        if s > best_score:
            best, best_score = lab, s
    return best


def confusion_matrix(rows):
    """rows: [(truth_label, pred_label)] → nested dict cm[truth][pred] = count,
    initialised to the full 5×5 grid so every cell prints even at zero."""
    cm = {t: {p: 0 for p in LABELS} for t in LABELS}
    for truth, pred in rows:
        cm[truth][pred] += 1
    return cm


def prf(tp, fp, fn):
    """precision, recall, F1 as (value or None). None marks an undefined ratio
    (zero denominator) so the report can print n/a instead of a misleading 0."""
    precision = tp / (tp + fp) if (tp + fp) else None
    recall = tp / (tp + fn) if (tp + fn) else None
    if precision and recall and (precision + recall) > 0:
        f1 = 2 * precision * recall / (precision + recall)
    else:
        f1 = None
    return precision, recall, f1


def decision_metrics(records, unsafe_set):
    """Decision-level precision/recall treating truth ∈ unsafe_set as the
    positive class (spec §11):

      block:  positive prediction = decision == "block"
      review: positive prediction = decision in {"review", "block"}
              (block is a stricter review, so blocked items are reviewed-or-worse)
    """
    out = {}
    for name, positive_decisions in (
        ("block", {"block"}),
        ("review", {"review", "block"}),
    ):
        tp = fp = fn = tn = 0
        for r in records:
            truth_unsafe = r["label"] in unsafe_set
            pred_positive = r["decision"] in positive_decisions
            if pred_positive and truth_unsafe:
                tp += 1
            elif pred_positive and not truth_unsafe:
                fp += 1
            elif not pred_positive and truth_unsafe:
                fn += 1
            else:
                tn += 1
        p, r_, f1 = prf(tp, fp, fn)
        out[name] = {
            "precision": p,
            "recall": r_,
            "f1": f1,
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "tn": tn,
        }
    return out


def frange(start, stop, step):
    """Inclusive float range that avoids accumulated FP drift by indexing."""
    n = int(round((stop - start) / step)) + 1
    return [round(start + i * step, 10) for i in range(n)]


def threshold_sweep(records, unsafe_set, start, stop, step):
    """Recompute unsafe_score = Σ scores[unsafe_set] per file and sweep
    block_threshold, reporting precision/recall/blocked at each step. This is
    the "tune from output, not feel" workflow (spec §11): it works purely off
    the scores already in each verdict — it does NOT re-run classify, so one
    classify pass feeds every row."""
    sweep = []
    for bt in frange(start, stop, step):
        tp = fp = fn = blocked = 0
        for r in records:
            truth_unsafe = r["label"] in unsafe_set
            unsafe_score = sum(float(r["scores"].get(c, 0.0)) for c in unsafe_set)
            pred_block = unsafe_score >= bt
            if pred_block:
                blocked += 1
            if pred_block and truth_unsafe:
                tp += 1
            elif pred_block and not truth_unsafe:
                fp += 1
            elif not pred_block and truth_unsafe:
                fn += 1
        p, rec, _ = prf(tp, fp, fn)
        sweep.append(
            {
                "block_threshold": bt,
                "precision": p,
                "recall": rec,
                "blocked": blocked,
            }
        )
    return sweep


# ── reporting ──────────────────────────────────────────────────────────────


def fmt_ratio(v):
    return "n/a" if v is None else "%.3f" % v


def render_report(summary):
    """Concise human report to stdout."""
    c = summary["counts"]
    out = []
    out.append("imagewarden accuracy eval")
    out.append(
        "samples: %s  (%d files, %d classified, %d errors)"
        % (summary["samples"], c["total"], c["classified"], c["errors"])
    )
    out.append("unsafe_classes: %s" % ", ".join(summary["unsafe_classes"]))
    out.append("")

    if summary["classified"] == 0:
        out.append("no classified files — nothing to score")
        return "\n".join(out)

    out.append(
        "Top-1 accuracy: %.4f  (%d/%d)"
        % (summary["accuracy"], summary["correct"], summary["classified"])
    )
    out.append("")

    # Confusion matrix (rows = truth, cols = predicted).
    out.append("Confusion matrix (rows = truth, cols = predicted):")
    colw = max(8, *(len(l) for l in LABELS))
    header = " " * (colw + 2) + "".join("%*s" % (colw + 1, l) for l in LABELS)
    out.append(header)
    for t in LABELS:
        cells = "".join("%*d" % (colw + 1, summary["confusion"][t][p]) for p in LABELS)
        out.append("  %-*s%s" % (colw, t, cells))
    out.append("")

    # Decision-level precision/recall.
    out.append(
        "Decision metrics (positive = truth in unsafe_classes; N_pos=%d, N_neg=%d):"
        % (summary["counts"]["positives"], summary["counts"]["negatives"])
    )
    out.append("  %-9s %9s %8s %7s %5s %4s %4s" % (
        "decision", "precision", "recall", "f1", "TP", "FP", "FN"))
    for name in ("block", "review"):
        d = summary["decisions"][name]
        out.append(
            "  %-9s %9s %8s %7s %5d %4d %4d"
            % (
                name,
                fmt_ratio(d["precision"]),
                fmt_ratio(d["recall"]),
                fmt_ratio(d["f1"]),
                d["tp"],
                d["fp"],
                d["fn"],
            )
        )
    out.append("")

    # Threshold sweep.
    out.append(
        "Threshold sweep (unsafe_score = Σ scores[%s]):"
        % ", ".join(summary["unsafe_classes"])
    )
    out.append("  %-15s %9s %7s %8s" % ("block_threshold", "precision", "recall", "blocked"))
    for row in summary["sweep"]:
        mark = ""
        if abs(row["block_threshold"] - DEFAULT_BLOCK_THRESHOLD) < 1e-9:
            mark = "   <- default (§6.1)"
        out.append(
            "  %-15.2f %9s %7s %8d%s"
            % (
                row["block_threshold"],
                fmt_ratio(row["precision"]),
                fmt_ratio(row["recall"]),
                row["blocked"],
                mark,
            )
        )
    return "\n".join(out)


# ── plumbing ───────────────────────────────────────────────────────────────


def warn(msg):
    print("warning: " + msg, file=sys.stderr)


def fail(msg, code=2):
    print("error: " + msg, file=sys.stderr)
    sys.exit(code)


def parse_args(argv):
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(
        description="Offline accuracy / threshold-tuning harness for imagewarden."
    )
    ap.add_argument(
        "--samples",
        default=os.path.join(here, "samples"),
        help="labeled sample dir laid out as <label>/<file> (default: ./samples)",
    )
    ap.add_argument(
        "--bin",
        default="imagewarden",
        help="imagewarden binary (default: 'imagewarden' on PATH; e.g. ./imagewarden)",
    )
    ap.add_argument(
        "--config",
        default=None,
        help="config passed through to 'imagewarden classify --config' (optional)",
    )
    ap.add_argument(
        "--from-jsonl",
        default=None,
        metavar="FILE",
        help="skip running classify; analyze a captured JSONL stream instead "
        "(labels are recovered from each verdict's \"file\" path)",
    )
    ap.add_argument(
        "--unsafe-classes",
        default=",".join(DEFAULT_UNSAFE),
        help="comma-separated positive/unsafe ground-truth set (default: %s)"
        % ",".join(DEFAULT_UNSAFE),
    )
    ap.add_argument("--sweep-start", type=float, default=0.50)
    ap.add_argument("--sweep-end", type=float, default=0.95)
    ap.add_argument("--sweep-step", type=float, default=0.05)
    ap.add_argument(
        "--json",
        default=None,
        metavar="OUT",
        help="also write a machine-readable JSON summary to OUT",
    )
    ap.add_argument(
        "--min-accuracy",
        type=float,
        default=None,
        help="exit non-zero if top-1 accuracy < this (CI gate on the 85–90%% "
        "target, spec §3.2); default: report only, exit 0",
    )
    return ap.parse_args(argv)


def main(argv):
    args = parse_args(argv)

    unsafe_set = [c.strip() for c in args.unsafe_classes.split(",") if c.strip()]
    unknown_unsafe = [c for c in unsafe_set if c not in LABELS]
    if unknown_unsafe:
        fail("--unsafe-classes has labels not in the model: " + ", ".join(unknown_unsafe))

    # 1. Gather verdicts, joined to their ground-truth label.
    if args.from_jsonl:
        verdicts = load_jsonl_file(args.from_jsonl)
        # Recover labels from each verdict's "file" path (parent dir name).
        discovered = [(f, os.path.basename(os.path.dirname(f))) for f in verdicts]
        discovered = [(f, l) for (f, l) in discovered if l in LABELS]
        total = len(verdicts)
    else:
        if not os.path.isdir(args.samples):
            fail("samples dir not found: %s" % args.samples)
        discovered = discover(args.samples)
        if not discovered:
            fail("no image files found under %s" % args.samples)
        paths = [p for p, _ in discovered]
        verdicts = run_classify(args.bin, args.config, paths)
        total = len(discovered)

    # 2. Build per-file records for the files that classified successfully.
    records = []
    for path, label in discovered:
        v = verdicts.get(path)
        if v is None:
            continue  # classify failed on this file (counted as an error below)
        scores = v.get("scores") or {}
        records.append(
            {
                "file": path,
                "label": label,
                "scores": scores,
                "decision": v.get("decision", ""),
                "pred": argmax_label(scores),
            }
        )

    classified = len(records)
    errors = total - classified

    # 3. Metrics.
    correct = sum(1 for r in records if r["pred"] == r["label"])
    accuracy = correct / classified if classified else 0.0
    cm = confusion_matrix([(r["label"], r["pred"]) for r in records])
    positives = sum(1 for r in records if r["label"] in unsafe_set)

    summary = {
        "samples": args.samples if not args.from_jsonl else args.from_jsonl,
        "unsafe_classes": unsafe_set,
        "labels": LABELS,
        "counts": {
            "total": total,
            "classified": classified,
            "errors": errors,
            "positives": positives,
            "negatives": classified - positives,
        },
        "classified": classified,
        "correct": correct,
        "accuracy": accuracy,
        "confusion": cm,
        "decisions": decision_metrics(records, unsafe_set),
        "sweep": threshold_sweep(
            records, unsafe_set, args.sweep_start, args.sweep_end, args.sweep_step
        ),
        "thresholds": {"block_default": DEFAULT_BLOCK_THRESHOLD},
    }

    # 4. Output.
    print(render_report(summary))
    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(summary, fh, indent=2)
            fh.write("\n")
        print("\nwrote JSON summary: %s" % args.json, file=sys.stderr)

    # 5. CI gate: fail if accuracy fell below --min-accuracy (spec §3.2).
    if args.min_accuracy is not None:
        if classified == 0:
            fail("--min-accuracy set but no files classified", code=1)
        if accuracy < args.min_accuracy:
            print(
                "\nFAIL: top-1 accuracy %.4f < --min-accuracy %.4f"
                % (accuracy, args.min_accuracy),
                file=sys.stderr,
            )
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
