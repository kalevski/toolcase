#!/usr/bin/env bash
#
# smoke.sh — container smoke test for the hardened imagewarden runtime contract
# (spec §9). Integration check, NOT a unit test: it builds the image and drives
# the real binary inside it to prove the claims `go test` cannot — distroless
# (no shell), nonroot, boots under `--read-only --cap-drop ALL`, the self-probing
# HEALTHCHECK, entrypoint-as-CLI passthrough, and the §5 HTTP response shape.
#
# The load-bearing assertion is that the container stays up under
# `--read-only --cap-drop ALL`: that is the container-level counterpart to the
# in-process privacy tests (task 040) and proves the no-writable-fs / privacy
# stance (spec §8) — a handler that started writing to disk would fail here.
#
# Usage (from the repo root, so `imagewarden` is the build context and
# `imagewarden/testdata` is mountable):
#
#     bash imagewarden/tools/smoke.sh
#
# Requires Docker plus `jq` and `curl` on the host (all preinstalled on
# GitHub's `ubuntu-latest`). Dependency-light by design — no Go toolchain, no
# test framework. Overridable via environment: IMG, TOKEN, PORT, TESTIMG.
#
# Exits 0 and prints "SMOKE OK" on success; non-zero with "SMOKE FAIL: …" on the
# first unmet assertion (`set -e` guarantees this).

set -euo pipefail

IMG=${IMG:-imagewarden:smoke}
TOKEN=${TOKEN:-test}
PORT=${PORT:-8080}
TESTIMG=${TESTIMG:-imagewarden/testdata/ok.jpg}
cid=""

# Teardown on every exit path (success, failed assertion, or interrupt).
cleanup() { [ -n "$cid" ] && docker rm -f "$cid" >/dev/null 2>&1 || true; }
trap cleanup EXIT

fail() { echo "SMOKE FAIL: $*" >&2; exit 1; }

# Host prerequisites — fail with a clear message rather than a cryptic
# "command not found" mid-run.
for bin in docker curl jq; do
  command -v "$bin" >/dev/null 2>&1 || fail "required host tool not found: $bin"
done
[ -f "$TESTIMG" ] || fail "test image not found: $TESTIMG (generate testdata fixtures — see imagewarden/testdata/README.md)"

# 1. Build the image (context = imagewarden/, per spec §9 / task 032). Single
# arch (host amd64 in CI) — this is a boot test, and QEMU-emulated arm64 is far
# too slow; the multi-arch push stays in the workflow's `docker` job.
echo "[smoke] build $IMG"
docker build -t "$IMG" imagewarden

# 2. `validate` via entrypoint passthrough — config parse + model load (sha256)
# + one self-test inference on the embedded 1x1 image, all offline in-image.
echo "[smoke] validate (entrypoint passthrough)"
docker run --rm "$IMG" validate || fail "validate exited non-zero"

# 3. One-shot `classify` of a mounted test image → one JSON verdict on stdout.
# Read-only mount, matching the runtime privacy stance.
echo "[smoke] classify /in/ok.jpg (one-shot, no server)"
out=$(docker run --rm -v "$PWD/${TESTIMG%/*}:/in:ro" "$IMG" classify "/in/${TESTIMG##*/}") \
  || fail "classify exited non-zero"
echo "$out" | jq -e '.decision and .scores' >/dev/null \
  || fail "classify did not emit a §5 verdict: $out"

# 4. Boot the server with the EXACT hardened flags from spec §9.
echo "[smoke] run server under --read-only --cap-drop ALL"
cid=$(docker run -d --read-only --cap-drop ALL \
        -e IMAGEWARDEN_TOKEN="$TOKEN" -p "$PORT:8080" "$IMG" run)

# Readiness. There is no shell in the distroless image, so `docker exec` cannot
# run a probe — we assert from the host in two independent ways.

# 4a. Poll the unauthenticated liveness endpoint from the host. A 200 here means
# the model loaded and warmed AND the process survived boot under --read-only.
ready=""
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[ "$ready" = 1 ] || fail "server never became ready (crashed under --read-only, or model failed to load?)"

# 4b. Trust the image's self-probing HEALTHCHECK too (the binary probes its own
# /healthz — spec §7, §9): assert Docker's managed health status reaches healthy.
st=""
for _ in $(seq 1 30); do
  st=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || echo none)
  [ "$st" = healthy ] && break
  sleep 1
done
[ "$st" = healthy ] || fail "HEALTHCHECK never reported healthy (got: ${st:-none})"

# 4c. Authorized classify → 200 + the exact §5 response shape.
echo "[smoke] POST /v1/classify (authorized)"
code=$(curl -s -o /tmp/imagewarden_smoke_body.json -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" \
  --data-binary "@${TESTIMG}" \
  "http://127.0.0.1:${PORT}/v1/classify")
[ "$code" = 200 ] || fail "authorized classify returned $code (want 200): $(cat /tmp/imagewarden_smoke_body.json 2>/dev/null)"
jq -e '.decision and .unsafe_score != null and .scores and .model.name and .latency_ms != null' \
  /tmp/imagewarden_smoke_body.json >/dev/null \
  || fail "response missing §5 fields: $(cat /tmp/imagewarden_smoke_body.json)"

# 4d. Missing token → 401 (bearer auth is enforced, spec §5).
echo "[smoke] POST /v1/classify (no token → 401)"
code=$(curl -s -o /dev/null -w '%{http_code}' \
  --data-binary "@${TESTIMG}" \
  "http://127.0.0.1:${PORT}/v1/classify")
[ "$code" = 401 ] || fail "unauthenticated classify returned $code (want 401)"

# 5. Still running under --read-only --cap-drop ALL ⇒ the runtime needed no
# writable filesystem and no capabilities. This is the container-level proof of
# the privacy / no-writable-fs stance (spec §8).
[ "$(docker inspect --format '{{.State.Running}}' "$cid")" = true ] \
  || fail "container exited under --read-only --cap-drop ALL (needs a writable fs or a capability?)"

echo "SMOKE OK"
