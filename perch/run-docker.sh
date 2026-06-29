#!/usr/bin/env bash
#
# Run Perch in Docker on a Linux host, keeping control-plane state (the SQLite
# store) on the host filesystem. Perch is only the control plane — it talks to
# GitHub and the nginxpilot daemon over HTTP and never sits in the request path,
# so (unlike TaskForge) it needs no claude CLI, SSH keys, or git mounts.
#
# Prereqs on the host:
#   1. cp .env.example .env  and fill in GITHUB_* + AUTH_SECRET + OAUTH_REDIRECT_URI
#      (none required yet — this is a scaffold).
#   2. docker build -t perch -f perch/Dockerfile .   (build context is the repo root)
#
# Then: ./run-docker.sh
#
# IMPORTANT: run this script as the user that owns the workspace dir — the
# container starts with that uid:gid so the bind-mounted state stays
# readable/writable on both sides.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── tunables (override via env) ───────────────────────────────────────────────
IMAGE="${IMAGE:-perch}"
CONTAINER="${CONTAINER:-perch}"
PORT="${PORT:-3000}"
# Optional docker network for reverse-proxy setups. When set, the port is NOT
# published on the host (the proxy reaches the container over the network); this
# is also how Perch reaches the nginxpilot daemon's loopback admin API.
NETWORK="${NETWORK:-}"

# Host workspace — durable state (the SQLite store lives here).
HOST_WORKSPACE="${HOST_WORKSPACE:-$HOME/perch-workspace}"

ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env}"
# ──────────────────────────────────────────────────────────────────────────────

# ── preflight ─────────────────────────────────────────────────────────────────
[ -f "$ENV_FILE" ] \
    || { echo "env file not found: $ENV_FILE (cp .env.example .env)" >&2; exit 1; }

mkdir -p "$HOST_WORKSPACE"

# ── network: publish the port OR join a proxy network ───────────────────────
if [ -n "$NETWORK" ]; then
    NET_ARGS=( --network "$NETWORK" )
else
    NET_ARGS=( -p "$PORT:3000" )
fi

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

# Notes on the run flags:
#  --user            the container runs as YOUR uid:gid so it owns the bind-
#                    mounted state. The image pre-chmods /app/perch/.next/cache
#                    for this case.
#  --tmpfs           keeps Next's runtime cache writes out of the container layer.
#  HOME=/workspace   arbitrary uids have no passwd entry (HOME would be unset);
#                    give the process a writable $HOME.
#  -e PORT=3000      pins the in-container listen port regardless of what .env
#                    sets, since the host mapping above targets 3000.
docker run -d --restart unless-stopped \
    --name "$CONTAINER" \
    --env-file "$ENV_FILE" \
    --user "$(id -u):$(id -g)" \
    "${NET_ARGS[@]}" \
    -v "$HOST_WORKSPACE:/workspace" \
    --tmpfs /app/perch/.next/cache:rw,mode=1777 \
    -e WORKSPACE_DIR=/workspace \
    -e HOME=/workspace \
    -e PORT=3000 \
    -e HOSTNAME=0.0.0.0 \
    "$IMAGE"

echo "started '$CONTAINER' (image: $IMAGE)"
if [ -n "$NETWORK" ]; then
    echo "  network: $NETWORK (port not published on host)"
else
    echo "  http://localhost:$PORT"
fi
echo "  logs: docker logs -f $CONTAINER"
