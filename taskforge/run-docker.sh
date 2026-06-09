#!/usr/bin/env bash
#
# Start TaskForge on a headless Linux server using the HOST machine's `claude`
# CLI (binary + login + user-level skills), with the workspace bind-mounted from
# the host.
#
# Prereqs on the host:
#   1. Install the native `claude` CLI and run `claude login` once.
#   2. (optional) Put shared skills under ~/.claude/skills/<skill>/SKILL.md
#   3. cp .env.example .env  and fill in GITHUB_* + AUTH_SECRET + OAUTH_REDIRECT_URI
#   4. docker build -t taskforge .
#
# Then: ./run-docker.sh
#
set -euo pipefail

# ── tunables (override via env) ───────────────────────────────────────────────
IMAGE="${IMAGE:-taskforge}"
CONTAINER="${CONTAINER:-taskforge}"
PORT="${PORT:-3000}"

# Host workspace — durable state (projects/, tasks/, .auth/). Bind-mounted at /workspace.
HOST_WORKSPACE="${HOST_WORKSPACE:-/srv/taskforge/workspace}"

# Host claude native binary (run `which claude` on the host to confirm).
HOST_CLAUDE_BIN="${HOST_CLAUDE_BIN:-$HOME/.local/bin/claude}"

# Host claude config dir — holds .credentials.json (the login) AND the
# user-level skills/ subdir. Mounted whole so the container reuses both.
HOST_CLAUDE_CONFIG="${HOST_CLAUDE_CONFIG:-$HOME/.claude}"

ENV_FILE="${ENV_FILE:-$(dirname "$0")/.env}"
# ──────────────────────────────────────────────────────────────────────────────

# In-container mount targets.
C_CLAUDE_BIN=/usr/local/bin/claude          # overrides the image's bundled CLI
C_CLAUDE_CONFIG=/host-claude                 # CLAUDE_CONFIG_DIR + skills root

[ -x "$HOST_CLAUDE_BIN" ]   || { echo "claude binary not found/executable: $HOST_CLAUDE_BIN" >&2; exit 1; }
[ -d "$HOST_CLAUDE_CONFIG" ] || { echo "claude config dir not found: $HOST_CLAUDE_CONFIG (run 'claude login')" >&2; exit 1; }
[ -f "$ENV_FILE" ]          || { echo "env file not found: $ENV_FILE (cp .env.example .env)" >&2; exit 1; }

# Workspace must be owned by the uid we run as (below) so the engine can write it.
mkdir -p "$HOST_WORKSPACE"

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

exec docker run -d --restart unless-stopped \
  --name "$CONTAINER" \
  -p "${PORT}:3000" \
  --env-file "$ENV_FILE" \
  --user "$(id -u):$(id -g)" \
  -v "$HOST_WORKSPACE:/workspace" \
  -v "$HOST_CLAUDE_BIN:$C_CLAUDE_BIN:ro" \
  -v "$HOST_CLAUDE_CONFIG:$C_CLAUDE_CONFIG" \
  -e WORKSPACE_DIR=/workspace \
  -e CLAUDE_BIN="$C_CLAUDE_BIN" \
  -e CLAUDE_CONFIG_DIR="$C_CLAUDE_CONFIG" \
  -e SKILLS_DIR="$C_CLAUDE_CONFIG/skills" \
  -e HOSTNAME=0.0.0.0 \
  "$IMAGE"
