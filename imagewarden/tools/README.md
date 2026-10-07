# tools

Developer tooling for imagewarden that lives outside the Go module's runtime
path.

## `preparemodel/`

Offline model pipeline (fp32 → ONNX → int8 → `model/` artifacts). See
`preparemodel/README.md`.

## `eval/`

Offline accuracy / threshold-tuning harness (spec §3.2, §11). `eval.py` runs
`imagewarden classify` over a labeled sample directory and reports top-1
accuracy, a per-class confusion matrix, decision-level precision/recall, and a
`block_threshold` sweep so thresholds are "tuned from output, not by feel". It
never re-implements inference — it parses `classify`'s JSONL (task 026) — and,
like `preparemodel`, is a dev-machine / CI-model-job tool only. Pure Python 3
stdlib. See `eval/README.md`.
