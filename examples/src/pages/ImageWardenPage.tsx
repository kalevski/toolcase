import { CopyLine } from './_chrome'
import { AppIntro, CodeSection, FeatureGrid, SectionHead, SourceCard } from './_app'

const archDiagram = `image bytes ──POST /v1/classify──► imagewarden ──decode + resize 224×224──► MobileNetV2 (int8, ONNX Runtime, CPU)
                                        │                                         │
                                        │◄──────── scores per class ──────────────┘
                                        ▼
                              policy thresholds ──► { decision: allow | review | block }

no disk writes · no logging of images · zero network egress`

const quickStart = `# Serve the API (the default CMD is "run")
docker run --rm --read-only --cap-drop ALL -p 8080:8080 \\
  -e IMAGEWARDEN_TOKEN=secret ghcr.io/kalevski/toolcase/imagewarden run

# Validate config + model load + a self-test inference, then exit
docker run --rm ghcr.io/kalevski/toolcase/imagewarden validate

# One-shot classification of local files, no server — one JSON verdict per line
docker run --rm -v "$PWD":/in ghcr.io/kalevski/toolcase/imagewarden classify /in/pic.jpg

# Threshold tuning over a labeled sample dir
imagewarden classify sample/*.jpg | jq -r '[.file, .decision, .unsafe_score] | @tsv'`

const classifyExample = `curl -s -H "Authorization: Bearer $IMAGEWARDEN_TOKEN" \\
  --data-binary @pic.jpg http://localhost:8080/v1/classify

{
  "decision": "block",
  "unsafe_score": 0.94,
  "scores": { "porn": 0.91, "sexy": 0.05, "hentai": 0.03, "neutral": 0.01, "drawings": 0.00 },
  "model": { "name": "mobilenetv2-nsfw", "version": "1.2.0", "quantization": "int8" },
  "latency_ms": 38
}

# Raw bytes or multipart/form-data with an "image" field; the format is sniffed.
# JPEG, PNG, GIF (first frame), WebP, BMP, TIFF.`

const endpoints = `GET  /healthz       none    model loaded + warmed → 200
GET  /schema        none    self-describing endpoint list
GET  /version       none    build info
GET  /status        bearer  model info, uptime, counters, latency p50/p95/p99, decisions
POST /v1/classify   bearer  classify one image
GET  /metrics       bearer  Prometheus text exposition

errors: { "error": "code", "detail": "…" }
  400 empty body · 401 bad token · 413 body cap · 415 undecodable format
  422 corrupt / pixel cap · 429 inference queue full · 503 model unavailable`

const configExample = `# /etc/imagewarden/config.yml — every value is defaulted; an empty file is valid
listen: 0.0.0.0:8080
api:
  token_env: IMAGEWARDEN_TOKEN     # name of the env var holding the bearer token
model:
  dir: /usr/share/imagewarden/model   # model.onnx + manifest.yml
inference:
  threads: 0                       # 0 = all CPUs
  concurrency: 2                   # inference semaphore size
limits:
  max_body_mb: 10
  max_pixels: 40000000
  queue_timeout: 5s
  request_timeout: 30s
policy:
  unsafe_classes: [porn, hentai]
  borderline_classes: [sexy]
  block_threshold: 0.8
  review_threshold: 0.5
log:
  format: json                     # logfmt | json`

const envExample = `# Every key has an env override: defaults < config file < environment.
docker run --rm --read-only --cap-drop ALL -p 8080:8080 \\
  -e IMAGEWARDEN_TOKEN=secret \\
  -e IMAGEWARDEN_POLICY_BLOCK_THRESHOLD=0.9 \\
  -e IMAGEWARDEN_LIMITS_MAX_BODY_MB=25 \\
  -e IMAGEWARDEN_POLICY_UNSAFE_CLASSES=porn,hentai \\
  ghcr.io/kalevski/toolcase/imagewarden run

# IMAGEWARDEN_TOKEN holds the token value;
# IMAGEWARDEN_API_TOKEN_ENV changes which variable it is read from.`

const modelSwap = `# The binary is model-agnostic: preprocessing constants, tensor layout and
# class labels come from manifest.yml beside model.onnx, never from code.
docker run --rm -v /path/to/other-model:/usr/share/imagewarden/model \\
  ghcr.io/kalevski/toolcase/imagewarden run

# Regenerate model.onnx + manifest.yml from upstream fp32 weights: tools/preparemodel`

const buildSnippet = `# CGO + libonnxruntime (ONNX Runtime 1.20.1)
export ORT_DYLIB_PATH=/path/to/lib/libonnxruntime.dylib
go build -o imagewarden ./cmd/imagewarden
go test -tags ort ./...              # model-integration test needs the real ORT library

# Container contract: distroless, nonroot, --read-only --cap-drop ALL, HEALTHCHECK
bash imagewarden/tools/smoke.sh      # needs docker, jq, curl — also runs in CI`

const features = [
    {
        title: 'Local only',
        body: 'Weights are baked into the image (or mounted in) and inference runs on CPU. No cloud call, no third-party API, zero network egress at runtime.',
    },
    {
        title: 'Private by construction',
        body: 'Images are classified in memory, never written to disk, never logged. The container boots under --read-only --cap-drop ALL as a non-root user in a distroless image.',
    },
    {
        title: 'Policy, not just scores',
        body: 'Per-class scores are folded into allow / review / block by configurable unsafe and borderline classes and two thresholds — tunable offline with the classify CLI.',
    },
    {
        title: 'Swappable model',
        body: 'The default is a quantized int8 MobileNetV2 at 224×224 (85–90% target accuracy). Mount any ONNX model with a manifest.yml and restart — no rebuild.',
    },
]

export const ImageWardenPage = () => {
    return (
        <main className="site-container">
            <AppIntro
                name="imagewarden"
                eyebrow="App · Service · Go"
                lead="A local-only image safety classifier: one Go binary in one container that inspects an image and returns an unsafe-content verdict. The model runs on CPU inside the container — images never leave the process and never touch disk."
                chips={['Go', 'ONNX Runtime', 'MobileNetV2 int8', 'distroless', 'Prometheus', 'no egress']}
                meta={[
                    { label: 'Language', value: 'Go 1.24' },
                    { label: 'Model', value: 'MobileNetV2 int8' },
                    { label: 'Dependencies', value: '3' },
                    { label: 'License', value: 'MIT' },
                ]}
            />

            <CodeSection
                title="How it works"
                count="decode → infer → apply policy"
                file="architecture"
                code={archDiagram}
            />
            <FeatureGrid features={features} />

            <CodeSection
                title="Quick start"
                count="entrypoint is the binary · any subcommand works"
                file="quickstart.sh"
                code={quickStart}
            />
            <CodeSection
                title="Classify"
                count="POST /v1/classify · raw bytes or multipart"
                file="classify.sh"
                code={classifyExample}
            />
            <CodeSection
                title="API surface"
                count="bearer auth on non-public routes"
                file="endpoints.txt"
                code={endpoints}
            />
            <CodeSection
                title="Configuration"
                count="YAML · every key defaulted"
                file="config.yml"
                code={configExample}
            />
            <CodeSection
                title="Environment overrides"
                count="configure a container with no YAML at all"
                file="env.sh"
                code={envExample}
            />
            <CodeSection
                title="Swapping the model"
                count="manifest-driven · mount and restart"
                file="model.sh"
                code={modelSwap}
            />
            <CodeSection
                title="Building from source"
                count="CGO · ONNX Runtime · container smoke test"
                file="build.sh"
                code={buildSnippet}
            />

            <SectionHead title="Run it" count="one container, read-only" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
                <CopyLine cmd="docker pull ghcr.io/kalevski/toolcase/imagewarden:latest" />
                <CopyLine cmd="imagewarden validate && imagewarden classify pic.jpg" />
            </div>

            <SourceCard dir="imagewarden" tagline="Go module, model artifacts, Dockerfile, smoke test" />
        </main>
    )
}
