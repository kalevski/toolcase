# tools

Developer tooling for imagewarden that lives outside the Go module's runtime
path.

## `smoke.sh` — container smoke test (spec §9)

An integration check — **not** a `go test` — that builds the image and drives
the real binary inside it to verify the hardened runtime contract spec §9
promises: distroless (no shell), nonroot, boots under `--read-only --cap-drop
ALL`, the self-probing `HEALTHCHECK`, entrypoint-as-CLI passthrough, and the §5
HTTP response shape. A regression the unit suite can't catch — e.g. a handler
that starts writing to disk, breaking `--read-only` — fails here.

The load-bearing assertion is that the container stays up under `--read-only
--cap-drop ALL`: the container-level counterpart to the in-process privacy tests
(task 040), proving the no-writable-fs / privacy stance (spec §8).

### Running it locally

From the **repo root** (so `imagewarden` is the Docker build context and
`imagewarden/testdata` is mountable):

```bash
bash imagewarden/tools/smoke.sh
```

Requires Docker plus `jq` and `curl` on the host — nothing else (no Go
toolchain). Overridable via environment: `IMG`, `TOKEN`, `PORT`, `TESTIMG`.

It builds `imagewarden:smoke`, then in order: runs `validate` and one-shot
`classify` through the entrypoint, boots the server with the exact §9 hardened
flags, waits for readiness (polling `/healthz` from the host **and** trusting
Docker's managed `HEALTHCHECK` status — there is no shell for `docker exec`),
asserts an authorized `POST /v1/classify` returns `200` with the §5 fields and a
tokenless one returns `401`, and finally that the container is still running
under `--read-only`. It tears the container down on every exit path and prints
`SMOKE OK` / `SMOKE FAIL: …`, exiting non-zero on the first failed assertion.

The test image defaults to `imagewarden/testdata/ok.jpg`; generate the testdata
fixtures first if it is absent (see `imagewarden/testdata/README.md`).

### In CI

The `smoke` job in `.github/workflows/imagewarden.yml` runs this on
`ubuntu-latest` (`needs: build`, LFS checkout for the baked model + test image).
It does its own single-arch `docker build`; the multi-arch push stays in the
`docker` job.

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
