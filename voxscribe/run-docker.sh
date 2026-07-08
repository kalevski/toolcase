#!/usr/bin/env bash
#
# Run voxscribe in Docker, keeping durable state (SQLite DB, uploaded media,
# ggml models, notes) on the host filesystem.
#
# Prereqs on the host:
#   1. cp .env.example .env  and fill in VOXSCRIBE_GITHUB_* + VOXSCRIBE_AUTH_SECRET
#      + VOXSCRIBE_OAUTH_REDIRECT_URI.
#   2. docker build -t voxscribe -f voxscribe/Dockerfile .   (build context is the repo root)
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
IMAGE="${IMAGE:-voxscribe}"
CONTAINER="${CONTAINER:-voxscribe}"
PORT="${PORT:-4200}"
# Optional docker network for reverse-proxy setups. When set, the port is NOT
# published on the host (the proxy reaches the container over the network).
NETWORK="${NETWORK:-}"
# Container memory cap — a backstop under the 6 GB machine budget (spec §2).
MEMORY="${MEMORY:-5g}"

# Host workspace — durable state (SQLite, media/, models/, notes/).
HOST_WORKSPACE="${HOST_WORKSPACE:-$HOME/voxscribe-workspace}"

ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env}"
# ──────────────────────────────────────────────────────────────────────────────

[ -f "$ENV_FILE" ] \
    || { echo "env file not found: $ENV_FILE (cp .env.example .env)" >&2; exit 1; }

mkdir -p "$HOST_WORKSPACE"

if [ -n "$NETWORK" ]; then
    NET_ARGS=( --network "$NETWORK" )
else
    NET_ARGS=( -p "$PORT:4200" )
fi

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

# Notes on the run flags:
#  --user            the container runs as YOUR uid:gid so it owns the bind-
#                    mounted state. The image pre-chmods /app/voxscribe/.next/cache
#                    for this case.
#  --memory          hard cap as a backstop for the whisper.cpp RAM budget.
#  --tmpfs           keeps Next's runtime cache writes out of the container layer.
#  HOME=/workspace   arbitrary uids have no passwd entry (HOME would be unset);
#                    give the process a writable $HOME.
docker run -d --restart unless-stopped \
    --name "$CONTAINER" \
    --env-file "$ENV_FILE" \
    --user "$(id -u):$(id -g)" \
    --memory "$MEMORY" \
    "${NET_ARGS[@]}" \
    -v "$HOST_WORKSPACE:/workspace" \
    --tmpfs /app/voxscribe/.next/cache:rw,mode=1777 \
    -e WORKSPACE_DIR=/workspace \
    -e HOME=/workspace \
    -e PORT=4200 \
    -e HOSTNAME=0.0.0.0 \
    "$IMAGE"

echo "started '$CONTAINER' (image: $IMAGE)"
if [ -n "$NETWORK" ]; then
    echo "  network: $NETWORK (port not published on host)"
else
    echo "  http://localhost:$PORT"
fi
echo "  logs: docker logs -f $CONTAINER"
