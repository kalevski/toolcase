#!/usr/bin/env bash
#
# smoke.sh — container smoke test for binvault's hardened runtime contract
# (spec §2.2, §9, §12). Integration check, NOT a unit test: it builds the image
# and drives the real binary inside it to prove what `go test` cannot —
# distroless (no shell), nonroot, boots under `--read-only --cap-drop ALL` with
# a data volume, the self-probing HEALTHCHECK, entrypoint-as-CLI passthrough
# (`validate`), the admin API on a published loopback port, and a real
# SigV4-signed upload/download over the S3 port.
#
# Usage (from the repo root):
#
#     bash binvault/test/smoke.sh
#
# Requires Docker, curl and openssl on the host. Overridable via environment:
# IMG, S3_PORT, ADMIN_PORT. Exits 0 and prints "SMOKE OK" on success; non-zero
# with "SMOKE FAIL: …" on the first unmet assertion.

set -euo pipefail

IMG=${IMG:-binvault:smoke}
S3_PORT=${S3_PORT:-19300}
ADMIN_PORT=${ADMIN_PORT:-19301}
cid=""
vol="binvault-smoke-$$"
tmp=$(mktemp -d)

cleanup() {
  [ -n "$cid" ] && docker rm -f "$cid" >/dev/null 2>&1 || true
  docker volume rm -f "$vol" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

fail() { echo "SMOKE FAIL: $*" >&2; exit 1; }

for bin in docker curl openssl; do
  command -v "$bin" >/dev/null 2>&1 || fail "required host tool not found: $bin"
done
# curl --aws-sigv4 must also send the x-amz-content-sha256 header S3-style SigV4 needs: curl >= 8.1
cver=$(curl --version | sed -n '1s/^curl \([0-9]*\.[0-9]*\).*/\1/p')
cmaj=${cver%%.*}; cmin=${cver#*.}
if [ "${cmaj:-0}" -lt 8 ] || { [ "${cmaj:-0}" -eq 8 ] && [ "${cmin:-0}" -lt 1 ]; }; then
  fail "curl ${cver:-?} is too old: --aws-sigv4 needs curl >= 8.1 (it has to send x-amz-content-sha256)"
fi

ADMIN_TOKEN=$(openssl rand -hex 24)
MASTER_KEY=$(openssl rand -base64 32)

echo "[smoke] build $IMG"
docker build -q -t "$IMG" binvault >/dev/null

echo "[smoke] version + validate (entrypoint passthrough)"
docker run --rm "$IMG" version | grep -q '^binvault ' || fail "version did not print"
docker volume create "$vol" >/dev/null
docker run --rm -v "$vol":/var/lib/binvault \
  -e BINVAULT_ADMIN_TOKEN="$ADMIN_TOKEN" -e BINVAULT_MASTER_KEY="$MASTER_KEY" "$IMG" validate \
  || fail "validate exited non-zero"
# secrets are mandatory: the container must refuse to boot without them
if docker run --rm "$IMG" validate >/dev/null 2>&1; then
  fail "validate passed without the required secrets"
fi

echo "[smoke] run under --read-only --cap-drop ALL"
cid=$(docker run -d --read-only --cap-drop ALL --security-opt no-new-privileges \
        -v "$vol":/var/lib/binvault \
        -e BINVAULT_ADMIN_TOKEN="$ADMIN_TOKEN" -e BINVAULT_MASTER_KEY="$MASTER_KEY" \
        -e BINVAULT_ENDPOINT_URL="http://127.0.0.1:${S3_PORT}" \
        -p "${S3_PORT}:9000" -p "127.0.0.1:${ADMIN_PORT}:9001" "$IMG")

ready=""
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${S3_PORT}/_healthz" >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[ "$ready" = 1 ] || { docker logs "$cid" >&2 || true; fail "server never became ready (crashed under --read-only?)"; }

st=""
for _ in $(seq 1 40); do
  st=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || echo none)
  [ "$st" = healthy ] && break
  sleep 1
done
[ "$st" = healthy ] || fail "HEALTHCHECK never reported healthy (got: ${st:-none})"

echo "[smoke] admin API: create bucket and token"
admin() { curl -fsS -H "Authorization: Bearer ${ADMIN_TOKEN}" -H 'Content-Type: application/json' "$@"; }
admin -X POST -d '{"name":"smoke"}' "http://127.0.0.1:${ADMIN_PORT}/_admin/v1/buckets" >/dev/null \
  || fail "bucket creation failed"
tok=$(admin -X POST -d '{"name":"smoke","grants":[{"actions":["read","write","list","delete"]}]}' \
  "http://127.0.0.1:${ADMIN_PORT}/_admin/v1/buckets/smoke/tokens")
AK=$(printf '%s' "$tok" | sed -n 's/.*"access_key_id":"\([^"]*\)".*/\1/p')
SK=$(printf '%s' "$tok" | sed -n 's/.*"secret_access_key":"\([^"]*\)".*/\1/p')
[ -n "$AK" ] && [ -n "$SK" ] || fail "token response had no credentials: $tok"

# the admin API is not reachable on the public port, the S3 API not on the admin port
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${ADMIN_TOKEN}" "http://127.0.0.1:${S3_PORT}/_admin/v1/status")
[ "$code" = 404 ] || fail "admin API reachable on the public listener ($code)"

echo "[smoke] signed upload / download / list / delete"
s3() { curl -fsS --aws-sigv4 "aws:amz:us-east-1:s3" --user "${AK}:${SK}" "$@"; }
head -c 3000000 /dev/urandom > "$tmp/blob.bin"
s3 -X PUT --data-binary "@$tmp/blob.bin" "http://127.0.0.1:${S3_PORT}/smoke/dir/blob.bin" >/dev/null || fail "PUT failed"
s3 -o "$tmp/back.bin" "http://127.0.0.1:${S3_PORT}/smoke/dir/blob.bin" || fail "GET failed"
cmp -s "$tmp/blob.bin" "$tmp/back.bin" || fail "downloaded bytes differ from the upload"
s3 "http://127.0.0.1:${S3_PORT}/smoke?list-type=2&prefix=dir/" | grep -q '<Key>dir/blob.bin</Key>' || fail "listing misses the key"
s3 -X DELETE "http://127.0.0.1:${S3_PORT}/smoke/dir/blob.bin" >/dev/null || fail "DELETE failed"
code=$(curl -s -o /dev/null -w '%{http_code}' --aws-sigv4 "aws:amz:us-east-1:s3" --user "${AK}:${SK}" "http://127.0.0.1:${S3_PORT}/smoke/dir/blob.bin")
[ "$code" = 404 ] || fail "deleted object still answers $code"

echo "[smoke] state survives a restart (same volume)"
s3 -X PUT --data-binary "persisted" "http://127.0.0.1:${S3_PORT}/smoke/keep.txt" >/dev/null
docker stop -t 30 "$cid" >/dev/null
docker start "$cid" >/dev/null
for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:${S3_PORT}/_healthz" >/dev/null 2>&1 && break
  sleep 1
done
[ "$(s3 "http://127.0.0.1:${S3_PORT}/smoke/keep.txt")" = persisted ] || fail "object lost across a restart"

[ "$(docker inspect --format '{{.State.Running}}' "$cid")" = true ] \
  || fail "container exited under --read-only --cap-drop ALL (needs a writable fs or a capability?)"

echo "SMOKE OK"
