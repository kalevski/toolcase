# syntax=docker/dockerfile:1

# ── build stage ──────────────────────────────────────────────────────────────
# Node >= 22.5 required for the built-in `node:sqlite` module (stable, flag-free
# on Node 24). See server/db.ts.
FROM node:24-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── runtime stage ────────────────────────────────────────────────────────────
FROM node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV WORKSPACE_DIR=/workspace
ENV APP_SKILLS_DIR=/app/skills

# git (for the git operations) + the Claude Code CLI (the default agent backend)
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm i -g @anthropic-ai/claude-code \
    && npm cache clean --force

# run-docker.sh starts the container with `--user $(id -u)` and bind-mounts
# /workspace from the host, so cloned repos are owned by an arbitrary uid with no
# passwd entry. Without this, every git op fails with "detected dubious ownership".
# A SYSTEM-level config (/etc/gitconfig) is read regardless of uid/$HOME, unlike
# `git config --global` which needs a writable home the runtime user lacks.
RUN git config --system --add safe.directory '*'

# non-root user that owns /workspace
RUN useradd -m -u 10001 app \
    && mkdir -p /workspace \
    && chown -R app:app /workspace

# Next standalone output
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
# bundled, read-only app-level skills (task-creator, commit-message)
COPY --from=builder --chown=app:app /app/skills ./skills

# run-docker.sh runs the container as an arbitrary HOST uid (to own the bind-
# mounted /workspace), NOT the image's `app` user. Next writes its incremental /
# data cache under /app/.next/cache at runtime, so that dir must be writable by
# any uid — otherwise every cached response logs `EACCES … mkdir /app/.next/cache`.
RUN mkdir -p /app/.next/cache && chmod -R 0777 /app/.next/cache

USER app
EXPOSE 3000
CMD ["node", "server.js"]
