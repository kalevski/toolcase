#!/usr/bin/env bash
#
# Run Wharf in Docker on a Linux host, keeping state (the SQLite store + encrypted
# backups) on the host filesystem. Publishes the human dashboard port (PORT) to
# the host; the machine Agent API (AGENT_PORT) stays on the internal Docker
# network — NEVER publish it externally (planning §5).
#
# Prereqs on the host:
#   1. cp .env.example .env  and fill GITHUB_* + AUTH_SECRET + ENCRYPTION_KEY +
#      OAUTH_REDIRECT_URI.
#   2. docker build -t wharf -f wharf/Dockerfile .   (build context is the repo root)
#
# Then: ./run-docker.sh
#
# Run this as the user that owns the workspace dir — the container starts with
# that uid:gid so the bind-mounted state stays readable/writable on both sides.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

IMAGE="${IMAGE:-wharf}"
CONTAINER="${CONTAINER:-wharf}"
PORT="${PORT:-3000}"
AGENT_PORT="${AGENT_PORT:-4000}"
# Optional docker network for reverse-proxy + agent-on-internal-network setups.
# When set, the dashboard port is NOT published; the proxy reaches it over the
# network and target containers reach the Agent API over the same network.
NETWORK="${NETWORK:-}"

HOST_WORKSPACE="${HOST_WORKSPACE:-$HOME/wharf-workspace}"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env}"

[ -f "$ENV_FILE" ] \
    || { echo "env file not found: $ENV_FILE (cp .env.example .env)" >&2; exit 1; }

mkdir -p "$HOST_WORKSPACE"

if [ -n "$NETWORK" ]; then
    NET_ARGS=( --network "$NETWORK" )
else
    # Publish ONLY the dashboard port. The Agent port stays unpublished — reachable
    # only from containers sharing this container's network namespace / links.
    NET_ARGS=( -p "$PORT:3000" )
fi

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

docker run -d --restart unless-stopped \
    --name "$CONTAINER" \
    --env-file "$ENV_FILE" \
    --user "$(id -u):$(id -g)" \
    "${NET_ARGS[@]}" \
    -v "$HOST_WORKSPACE:/workspace" \
    --tmpfs /app/wharf/.next/cache:rw,mode=1777 \
    -e WORKSPACE_DIR=/workspace \
    -e BACKUP_DIR=/workspace/backups \
    -e HOME=/workspace \
    -e PORT=3000 \
    -e AGENT_PORT="$AGENT_PORT" \
    -e HOSTNAME=0.0.0.0 \
    "$IMAGE"

echo "started '$CONTAINER' (image: $IMAGE)"
if [ -n "$NETWORK" ]; then
    echo "  network: $NETWORK (ports not published on host)"
else
    echo "  dashboard: http://localhost:$PORT   (agent API on :$AGENT_PORT stays internal)"
fi
echo "  logs: docker logs -f $CONTAINER"
