# imagewarden

A local-only image safety classifier: a single Go binary running in a single
container that inspects an image and returns an unsafe-content verdict. There
is no cloud call and no third-party API — model weights are baked into the
image (or mounted in), inference runs on CPU via a quantized int8 MobileNetV2
CNN at 224×224, and the container makes zero network egress at runtime. Target
accuracy is 85–90% for unsafe-content classes (`porn`, `hentai`, `sexy`,
`drawings`, `neutral`), in line with published MobileNetV2 NSFW baselines.

## Quick start

The container's entrypoint is the `imagewarden` binary itself, so any CLI
subcommand can be passed straight to `docker run`:

```bash
# Serve the API (the default CMD is "run")
docker run --rm --read-only --cap-drop ALL -p 8080:8080 \
  -e IMAGEWARDEN_TOKEN=secret ghcr.io/kalevski/imagewarden run

# Validate config + model load + a self-test inference, then exit
docker run --rm ghcr.io/kalevski/imagewarden validate

# One-shot classification of a local file, no server
docker run --rm -v "$PWD":/in ghcr.io/kalevski/imagewarden classify /in/pic.jpg
```

`IMAGEWARDEN_TOKEN` is the bearer token clients must send to non-public
endpoints (`api.token_env` in the config, read at boot — never from the YAML
file itself). `--read-only --cap-drop ALL` works out of the box: the process
never writes to disk, needs no capabilities, and runs as a non-root user in a
distroless image.

## API surface

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /healthz` | none | liveness: model loaded + warmed → 200 |
| `GET /schema` | none | self-describing endpoint list |
| `GET /status` | bearer | model info, uptime, counters, latency p50/p95/p99, decisions by type |
| `POST /v1/classify` | bearer | classify one image |
| `GET /metrics` | bearer | Prometheus text exposition |
| `GET /version` | none | build info |

`POST /v1/classify` accepts raw image bytes (`Content-Type: image/*` is
advisory only — the format is sniffed) or `multipart/form-data` with an
`image` field:

```bash
curl -s -H "Authorization: Bearer $IMAGEWARDEN_TOKEN" \
  --data-binary @pic.jpg http://localhost:8080/v1/classify
```

```json
{
  "decision": "block",
  "unsafe_score": 0.94,
  "scores": { "porn": 0.91, "sexy": 0.05, "hentai": 0.03, "neutral": 0.01, "drawings": 0.00 },
  "model": { "name": "mobilenetv2-nsfw", "version": "1.2.0", "quantization": "int8" },
  "latency_ms": 38
}
```

Error responses are `{ "error": "code", "detail": "…" }`. Codes: `400` empty
body, `401` bad/missing token, `413` over the body size cap, `415`
undecodable image format, `422` corrupt or over the pixel cap, `429`
inference queue full, `503` model unavailable.

## Configuration

Config lives at `/etc/imagewarden/config.yml`; every value is defaulted, so
an empty file is valid. Key sections:

- `listen` — address the API binds to.
- `api.token_env` — name of the env var holding the bearer token.
- `model.dir` — directory containing `model.onnx` + `manifest.yml`.
- `inference` — `threads` (0 = all CPUs) and `concurrency` (the inference
  semaphore size).
- `limits` — request body/pixel caps and timeouts.
- `policy` — which classes count as unsafe/borderline and the block/review
  score thresholds.
- `log` — `logfmt` or `json`.

Run `imagewarden validate` (or `docker run --rm <image> validate`) to parse
the config, load the model, and run a self-test inference before deploying.

## Swapping the model

The binary is model-agnostic: all preprocessing constants, tensor layout,
and class labels come from `manifest.yml` beside `model.onnx`, never from
code. To use a different model, mount a directory containing both files over
`model.dir` and restart — no rebuild required:

```bash
docker run --rm -v /path/to/other-model:/usr/share/imagewarden/model \
  ghcr.io/kalevski/imagewarden run
```

## Building from source

Requires `CGO_ENABLED=1` and a `libonnxruntime.so` on the library path (point
`ORT_DYLIB_PATH` at it if it isn't in a standard location):

```bash
go build -o imagewarden ./cmd/imagewarden
```

The model-integration test is gated behind the `ort` build tag and needs the
real ONNX Runtime shared library to run:

```bash
go test -tags ort ./...
```

To regenerate the model artifacts (`model.onnx` + `manifest.yml`) from the
upstream fp32 weights, see `tools/preparemodel`.

## Privacy stance

Images are classified in memory only. They are never written to disk, never
logged, and never leave the process — the container runs with a read-only
filesystem (`--read-only`) because nothing it does requires writing.
