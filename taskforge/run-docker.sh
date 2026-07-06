#!/usr/bin/env bash
#
# Run TaskForge in Docker on a Linux host, reusing the HOST machine's `claude`
# CLI (binary + login + user-level skills) and keeping the workspace on the
# host filesystem.
#
# Prereqs on the host:
#   1. Install the native `claude` CLI (curl -fsSL https://claude.ai/install.sh | bash)
#      and run `claude login` once.
#   2. (optional) Put shared skills under ~/.claude/skills/<skill>/SKILL.md
#   3. cp .env.example .env  and fill in GITHUB_* + AUTH_SECRET + OAUTH_REDIRECT_URI
#   4. docker build -t taskforge .   (from this directory)
#
# Then: ./run-docker.sh
#
# IMPORTANT: run this script as the user that owns ~/.claude and the workspace
# dir — the container starts with that uid:gid so every bind mount stays
# readable/writable on both sides.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── tunables (override via env) ───────────────────────────────────────────────
IMAGE="${IMAGE:-taskforge}"
CONTAINER="${CONTAINER:-taskforge}"
PORT="${PORT:-3000}"
# Optional docker network for reverse-proxy setups. When set, the port is NOT
# published on the host (the proxy reaches the container over the network).
NETWORK="${NETWORK:-}"

# Host workspace — durable state (projects/, skills/, taskforge.db).
HOST_WORKSPACE="${HOST_WORKSPACE:-$HOME/taskforge-workspace}"

# Host claude CLI. The native installer puts a symlink at ~/.local/bin/claude;
# we resolve it below because bind-mounting a symlink mounts the link, not the
# binary it points at.
HOST_CLAUDE_BIN="${HOST_CLAUDE_BIN:-$(command -v claude || echo "$HOME/.local/bin/claude")}"

# Host claude config dir — holds .credentials.json (the login) AND the
# user-level skills/ subdir. Mounted whole (read-write: the CLI writes session
# state next to its credentials) so the container reuses both.
HOST_CLAUDE_CONFIG="${HOST_CLAUDE_CONFIG:-$HOME/.claude}"

# Optional git-over-SSH credentials for clone/fetch/push. If the key is absent
# these mounts are skipped — set GIT_REMOTE_TOKEN in .env to push over HTTPS
# instead. known_hosts must already contain the git host (e.g. github.com).
HOST_SSH_DIR="${HOST_SSH_DIR:-$HOME/.ssh}"
HOST_SSH_KEY="${HOST_SSH_KEY:-id_ed25519}"
HOST_GITCONFIG="${HOST_GITCONFIG:-$HOME/.gitconfig}"

ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env}"
# ──────────────────────────────────────────────────────────────────────────────

# In-container mount targets. The binary deliberately does NOT shadow the
# image's /usr/local/bin/claude (an npm symlink — mounting over it is fragile);
# the app spawns whatever CLAUDE_BIN points at, so a clean path is enough.
C_CLAUDE_BIN=/opt/claude/claude
C_CLAUDE_CONFIG=/host-claude
C_SSH_DIR=/host-ssh
C_GITCONFIG=/host-gitconfig

# ── preflight ─────────────────────────────────────────────────────────────────
CLAUDE_BIN_RESOLVED="$(readlink -f "$HOST_CLAUDE_BIN" 2>/dev/null || true)"
[ -n "$CLAUDE_BIN_RESOLVED" ] && [ -x "$CLAUDE_BIN_RESOLVED" ] \
    || { echo "claude binary not found/executable: $HOST_CLAUDE_BIN (override via HOST_CLAUDE_BIN)" >&2; exit 1; }
[ -d "$HOST_CLAUDE_CONFIG" ] \
    || { echo "claude config dir not found: $HOST_CLAUDE_CONFIG (run 'claude login' first)" >&2; exit 1; }
[ -f "$HOST_CLAUDE_CONFIG/.credentials.json" ] \
    || echo "warning: $HOST_CLAUDE_CONFIG/.credentials.json missing — did 'claude login' succeed?" >&2
[ -f "$ENV_FILE" ] \
    || { echo "env file not found: $ENV_FILE (cp .env.example .env)" >&2; exit 1; }

mkdir -p "$HOST_WORKSPACE" "$HOST_CLAUDE_CONFIG/skills"

# ── optional git credential mounts ───────────────────────────────────────────
GIT_ARGS=()
if [ -f "$HOST_SSH_DIR/$HOST_SSH_KEY" ]; then
    GIT_ARGS+=(
        -v "$HOST_SSH_DIR:$C_SSH_DIR:ro"
        -e GIT_SSH_COMMAND="ssh -i $C_SSH_DIR/$HOST_SSH_KEY -o UserKnownHostsFile=$C_SSH_DIR/known_hosts -o IdentitiesOnly=yes"
        # tells the app `git push` is possible without an HTTPS token
        -e GIT_SSH_CONFIGURED=1
    )
else
    echo "note: no SSH key at $HOST_SSH_DIR/$HOST_SSH_KEY — git push needs GIT_REMOTE_TOKEN in .env" >&2
fi
if [ -f "$HOST_GITCONFIG" ]; then
    GIT_ARGS+=(
        -v "$HOST_GITCONFIG:$C_GITCONFIG:ro"
        -e GIT_CONFIG_GLOBAL="$C_GITCONFIG"
    )
fi

# ── network: publish the port OR join a proxy network ───────────────────────
if [ -n "$NETWORK" ]; then
    NET_ARGS=( --network "$NETWORK" )
else
    NET_ARGS=( -p "$PORT:3000" )
fi

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

# Notes on the run flags:
#  --user            the container runs as YOUR uid:gid so it owns /workspace
#                    and can read ~/.claude. The image pre-chmods /app/.next/cache
#                    and `git config --system safe.directory '*'` for this case.
#  --tmpfs           keeps Next's runtime cache writes out of the container layer.
#  HOME=/workspace   arbitrary uids have no passwd entry (HOME would be unset);
#                    the CLI and agent-spawned tools need a writable $HOME.
#  -e PORT=3000      pins the in-container listen port regardless of what .env
#                    sets, since the host mapping above targets 3000.
docker run -d --restart unless-stopped \
    --name "$CONTAINER" \
    --env-file "$ENV_FILE" \
    --user "$(id -u):$(id -g)" \
    "${NET_ARGS[@]}" \
    -v "$HOST_WORKSPACE:/workspace" \
    -v "$CLAUDE_BIN_RESOLVED:$C_CLAUDE_BIN:ro" \
    -v "$HOST_CLAUDE_CONFIG:$C_CLAUDE_CONFIG" \
    --tmpfs /app/.next/cache:rw,mode=1777 \
    ${GIT_ARGS[@]+"${GIT_ARGS[@]}"} \
    -e WORKSPACE_DIR=/workspace \
    -e CLAUDE_BIN="$C_CLAUDE_BIN" \
    -e CLAUDE_CONFIG_DIR="$C_CLAUDE_CONFIG" \
    -e SKILLS_DIR="$C_CLAUDE_CONFIG/skills" \
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
