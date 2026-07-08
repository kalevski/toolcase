# syntax=docker/dockerfile:1
#
# taskforge is an npm workspace whose @toolcase/* deps are file:../ siblings, so
# the build needs the WHOLE monorepo: build context is the repo root and every
# COPY path below is repo-root-relative. Node >= 22.5 for the built-in
# node:sqlite (see taskforge/server/db.ts).

# ── build stage ──────────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /repo

# Manifests first so the npm-ci layer caches across source-only changes.
# Root `npm ci` needs EVERY workspace's package.json to satisfy the lockfile.
COPY package.json package-lock.json ./
COPY base/package.json base/package.json
COPY logging/package.json logging/package.json
COPY serializer/package.json serializer/package.json
COPY web-components/package.json web-components/package.json
COPY phaser-plus/package.json phaser-plus/package.json
COPY node/package.json node/package.json
COPY taskforge/package.json taskforge/package.json
COPY quaykeeper/package.json quaykeeper/package.json
COPY examples/package.json examples/package.json
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @toolcase/base -w @toolcase/web-components -w @toolcase/taskforge

# ── runtime stage ────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV WORKSPACE_DIR=/workspace
ENV APP_SKILLS_DIR=/app/skills

# git + openssh-client (git operations / SSH remotes) + the Claude Code CLI
# (default agent backend)
RUN apt-get update \
    && apt-get install -y --no-install-recommends git openssh-client ca-certificates wget curl \
    && rm -rf /var/lib/apt/lists/* \
    && npm i -g @anthropic-ai/claude-code \
    && npm cache clean --force

# run-docker.sh runs the container as an arbitrary host uid with no passwd entry;
# a SYSTEM-level config is read regardless of uid/$HOME (unlike --global) so git
# ops don't fail with "detected dubious ownership".
RUN git config --system --add safe.directory '*'

# non-root user that owns /workspace
RUN useradd -m -u 10001 app \
    && mkdir -p /workspace \
    && chown -R app:app /workspace

# Next standalone tree nests the app under ./taskforge — mirror it exactly.
COPY --from=builder --chown=app:app /repo/taskforge/.next/standalone ./
COPY --from=builder --chown=app:app /repo/taskforge/.next/static ./taskforge/.next/static
COPY --from=builder --chown=app:app /repo/taskforge/public ./taskforge/public
# bundled, read-only app-level skills (task-creator, commit-message)
COPY --from=builder --chown=app:app /repo/taskforge/skills ./skills

# Next writes its incremental cache here at runtime; the container may run as an
# arbitrary host uid, so the dir must be writable by any uid.
RUN mkdir -p /app/taskforge/.next/cache && chmod -R 0777 /app/taskforge/.next/cache

USER app
EXPOSE 3000
CMD ["node", "taskforge/server.js"]
