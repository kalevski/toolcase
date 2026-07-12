# tools/eval

Offline accuracy / threshold-tuning harness (spec §3.2, §11).

`classify` (task 026) can tell you *what* the model thinks about one image;
this harness tells you *how well* it does over a labeled set and *where to set
the thresholds*. It closes the gap between "we can classify" and "we can
measure accuracy / tune the policy" — the "tune from output, not by feel"
workflow of spec §11.

## What it does

`eval.py` takes a directory of labeled images, runs `imagewarden classify`
over all of them in one pass, parses the JSONL verdicts (spec §5:
`.decision`, `.unsafe_score`, `.scores{…}`), and reports:

- **Top-1 accuracy** — predicted class = `argmax(scores)`; accuracy =
  correct / total.
- **5×5 confusion matrix** over the model's five labels in manifest order
  (`drawings, hentai, neutral, porn, sexy`, spec §6.1).
- **Decision-level precision/recall/F1** for the `block` and `review`
  decisions, treating the policy's `unsafe_classes` (default `[porn, hentai]`)
  as the positive ground-truth set — so you see the effect of the shipped
  `block_threshold` / `review_threshold`.
- **A `block_threshold` sweep** (`0.50..0.95 step 0.05` by default) with
  precision/recall/blocked at each step, so you can eyeball the knee. The
  sweep recomputes `unsafe_score = Σ scores[unsafe_classes]` from the raw
  scores already in each verdict — it does **not** re-run classify, so one
  classify pass feeds every row.

It never re-implements inference: it shells out to `imagewarden classify`, so
the numbers always match production preprocessing and policy. Like
`tools/preparemodel`, this is a **dev-machine / CI-model-job tool** — it never
enters the image (`tools/` is in `.dockerignore`, task 033).

## Dependencies

- **Python 3.8+ standard library only** — no numpy, no PyYAML, no third-party
  packages. (`tools/preparemodel/requirements.txt` is a separate, unrelated
  dependency set; nothing here needs it.)
- The `imagewarden` binary on `PATH` (or pass `--bin ./imagewarden`), a config
  it can load, and a model it can run (CGO + `libonnxruntime.so`, spec §3.1).

## `samples/` layout

Ground truth is the directory name; one subdirectory per model label:

```
samples/
├── drawings/*.png
├── hentai/*.jpg
├── neutral/*.jpg
├── porn/*.jpg
└── sexy/*.jpg
```

Recognized extensions: `.jpg .jpeg .png .webp .gif` (format is sniffed by
`classify`, not trusted from the extension). Directories whose name is not one
of the five model labels are ignored with a warning.

### The checked-in `samples/`

The committed `samples/` holds **only tiny synthetic/neutral placeholders**
(`neutral/solid.png`, `drawings/solid.png` — copies of the repo's real 1×1
`cmd/imagewarden/onepixel.png`). They exist so the harness plumbing runs end-to-end
out of the box; they are **not** a meaningful accuracy corpus (two identical
neutral pixels won't move any metric). **No real unsafe imagery is committed to
this repository, ever** (spec privacy stance, §8). To grow the built-in
synthetic set, use the generator:

```bash
python3 samples/gen.py            # writes more solid-color / noise PNGs
```

`gen.py` is pure stdlib and only ever produces harmless synthetic images in the
`neutral` and `drawings` classes.

### Pointing at a private labeled corpus

Real accuracy measurement uses an **out-of-tree** labeled set you keep private
(never committed):

```bash
python3 eval.py --samples /path/to/private/corpus
```

Lay the private corpus out with the same `<label>/<file>` structure. Keep it
outside the repo working tree (or in a git-ignored path) so unsafe imagery is
never staged.

## Running it

From this directory (`imagewarden/tools/eval/`), with `imagewarden` on `PATH`:

```bash
# default: report over ./samples, exit 0
python3 eval.py

# a real private corpus, custom binary + config, JSON summary out
python3 eval.py \
    --samples /data/nsfw-eval \
    --bin ../../imagewarden \
    --config ../../docker/config.yml \
    --json report.json

# CI model-job gate on the 85–90% target (spec §3.2): non-zero exit below 0.85
python3 eval.py --samples /data/nsfw-eval --min-accuracy 0.85
```

Split the classify pass from the analysis (e.g. run classify on the model-job
box, analyze elsewhere) with `--from-jsonl`:

```bash
imagewarden classify /data/nsfw-eval/*/* > verdicts.jsonl
python3 eval.py --from-jsonl verdicts.jsonl        # labels recovered from each "file" path
```

### Options

| Flag | Default | Purpose |
|---|---|---|
| `--samples DIR` | `./samples` | labeled sample dir (`<label>/<file>`) |
| `--bin PATH` | `imagewarden` | classify binary (e.g. `./imagewarden`) |
| `--config PATH` | — | passed through to `classify --config` |
| `--from-jsonl FILE` | — | analyze a captured JSONL stream; skip running classify |
| `--unsafe-classes a,b` | `porn,hentai` | positive/unsafe ground-truth set |
| `--sweep-start / --sweep-end / --sweep-step` | `0.50 / 0.95 / 0.05` | `block_threshold` sweep range |
| `--json OUT` | — | also write a machine-readable JSON summary |
| `--min-accuracy X` | — | exit non-zero if top-1 accuracy `< X` (CI gate) |

## Output

A concise human report to stdout (accuracy line, confusion matrix, decision
metrics, sweep table) — the default row of the sweep (`block_threshold` 0.80,
spec §6.1) is annotated so you can see where the shipped policy sits:

```
Threshold sweep (unsafe_score = Σ scores[porn, hentai]):
  block_threshold  precision  recall  blocked
  0.50                 0.780   0.960      142
  0.55                 0.830   0.940      131
  ...
  0.80                 0.950   0.880       98   <- default (§6.1)
  0.95                 0.990   0.710       71
```

`--json OUT` additionally writes
`{samples, counts, unsafe_classes, labels, accuracy, correct, confusion,
decisions:{block:{precision,recall,f1,tp,fp,fn,tn}, review:{…}}, sweep:[…]}`.

Exit code: `0` normally; `1` if `--min-accuracy` is set and top-1 falls below
it (so a CI model-job can gate on the 85–90% target); `2` on a usage/setup
error (missing samples dir, unknown `--unsafe-classes`, classify binary not
found).
