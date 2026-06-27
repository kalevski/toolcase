#!/usr/bin/env bash
#
# Perch e2e — boots a real nginxpilot daemon AND a real Perch server, then runs the
# HTTP assertions in test.mjs against them (branding/settings + custom-domain ingress,
# plus a Perch↔nginxpilot round-trip). Self-contained: builds the daemon, writes its
# config to a scratch dir, starts both processes, waits for health, runs the tests,
# and always tears the processes down on exit.
#
# Requires: Go (nginxpilot build) + Node >= 22.5 (Perch `node:sqlite`). Pass the Node
# path via $NODE_BIN_DIR if `node` on PATH is older (the script defaults to an nvm 24).
#
# Usage:  perch/e2e/run-e2e.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PERCH="$ROOT/perch"
NP="$ROOT/nginxpilot"

# Node >= 22.5 for node:sqlite. Override with NODE_BIN_DIR if needed.
NODE_BIN_DIR="${NODE_BIN_DIR:-$HOME/.nvm/versions/node/v24.8.0/bin}"
export PATH="$NODE_BIN_DIR:$PATH"

SCRATCH="${E2E_SCRATCH:-$(mktemp -d)}"
NP_PORT=9091
PERCH_PORT=4100

echo "== Perch e2e =="
echo "scratch: $SCRATCH"
echo "node:    $(node -v)  ($(command -v node))"

# ── perch env (OAuth values are dummies — we bypass sign-in via a seeded cookie) ─
export PERCH_GITHUB_CLIENT_ID="e2e"
export PERCH_GITHUB_CLIENT_SECRET="e2e"
export PERCH_OAUTH_REDIRECT_URI="http://localhost:${PERCH_PORT}/api/auth/github/callback"
export PERCH_AUTH_SECRET="e2e-test-secret-0123456789abcdef"
export PERCH_DB_PATH="$SCRATCH/perch.db"
export PERCH_NGINXPILOT_ADMIN_URL="http://127.0.0.1:${NP_PORT}"
export WORKSPACE_DIR="$SCRATCH"
export PORT="$PERCH_PORT"
# PERCH_INGRESS_IPV4 deliberately UNSET — the e2e drives the ingress IP via Settings.
unset PERCH_INGRESS_IPV4 PERCH_INGRESS_IPV6

NP_PID=""
PERCH_PID=""
cleanup() {
    [ -n "$PERCH_PID" ] && kill "$PERCH_PID" 2>/dev/null
    [ -n "$NP_PID" ] && kill "$NP_PID" 2>/dev/null
    # give them a moment, then hard-kill any survivors
    sleep 1
    [ -n "$PERCH_PID" ] && kill -9 "$PERCH_PID" 2>/dev/null
    [ -n "$NP_PID" ] && kill -9 "$NP_PID" 2>/dev/null
}
trap cleanup EXIT

# ── 1. build nginxpilot ─────────────────────────────────────────────────────────
echo "-- building nginxpilot…"
( cd "$NP" && go build -o "$SCRATCH/nginxpilot" ./cmd/nginxpilot ) || { echo "go build failed"; exit 1; }

# ── 2. nginxpilot config + dirs ─────────────────────────────────────────────────
mkdir -p "$SCRATCH/np/sites.d" "$SCRATCH/np-data"
cat > "$SCRATCH/np/config.yml" <<EOF
data_dir: $SCRATCH/np-data
admin:
  listen: 127.0.0.1:${NP_PORT}
defaults:
  interval: 5m
  keep_releases: 3
include:
  - sites.d/*.yml
EOF

# ── 3. start nginxpilot ─────────────────────────────────────────────────────────
echo "-- starting nginxpilot…"
"$SCRATCH/nginxpilot" run --config "$SCRATCH/np/config.yml" > "$SCRATCH/nginxpilot.log" 2>&1 &
NP_PID=$!

for i in $(seq 1 30); do
    curl -sf "http://127.0.0.1:${NP_PORT}/healthz" >/dev/null 2>&1 && break
    sleep 1
done
if ! curl -sf "http://127.0.0.1:${NP_PORT}/healthz" >/dev/null 2>&1; then
    echo "nginxpilot did not become healthy"; tail -20 "$SCRATCH/nginxpilot.log"; exit 1
fi
echo "   nginxpilot healthy on :${NP_PORT}"

# ── 4. start Perch (next dev — compiles routes on demand) ────────────────────────
echo "-- starting Perch (next dev)…"
( cd "$PERCH" && npx next dev -p "$PERCH_PORT" > "$SCRATCH/perch.log" 2>&1 ) &
PERCH_PID=$!

echo "-- waiting for Perch /api/settings (first hit compiles the route)…"
UP=""
for i in $(seq 1 90); do
    if curl -sf "http://127.0.0.1:${PERCH_PORT}/api/settings" >/dev/null 2>&1; then UP=1; break; fi
    sleep 1
done
if [ -z "$UP" ]; then
    echo "Perch did not come up"; tail -40 "$SCRATCH/perch.log"; exit 1
fi
echo "   Perch up on :${PERCH_PORT}"

# ── 5. run the assertions ────────────────────────────────────────────────────────
echo "-- running assertions…"
node "$PERCH/e2e/test.mjs"
RESULT=$?

if [ "$RESULT" -ne 0 ]; then
    echo "-- perch.log tail --"; tail -30 "$SCRATCH/perch.log"
fi
exit "$RESULT"
