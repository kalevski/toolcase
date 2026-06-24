# syntax=docker/dockerfile:1

# ── build stage ──────────────────────────────────────────────────────────────
# taskforge is an npm workspace whose @toolcase/* deps are `file:../` siblings
# (base, web-components) consumed from their gitignored built `lib/`. The build
# therefore needs the WHOLE monorepo, so the CI build context is the repo root
# (see .github/workflows/taskforge.yml). This Dockerfile lives in taskforge/ but
# every COPY path below is repo-root-relative.
#
# Node >= 22.5 required for the built-in `node:sqlite` module (stable, flag-free
# on Node 24). See taskforge/server/db.ts.
FROM node:24-slim AS builder
WORKDIR /repo

# Install workspace deps first, keyed only on the manifests so this layer caches
# across source-only changes. The single root lockfile links the file:../ deps;
# `npm ci` needs every workspace package.json present to validate against it.
COPY package.json package-lock.json ./
COPY base/package.json base/package.json
COPY logging/package.json logging/package.json
COPY serializer/package.json serializer/package.json
COPY web-components/package.json web-components/package.json
COPY phaser-plus/package.json phaser-plus/package.json
COPY node/package.json node/package.json
COPY taskforge/package.json taskforge/package.json
COPY examples/package.json examples/package.json
RUN npm ci

# Sources, then build only what taskforge consumes (base, then web-components —
# order matters: web-components imports base's built `lib/`), then taskforge.
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@toolcase/base \
    && npm run build --workspace=@toolcase/web-components \
    && npm run build --workspace=@toolcase/taskforge

# ── runtime stage ────────────────────────────────────────────────────────────
FROM node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV WORKSPACE_DIR=/workspace
ENV APP_SKILLS_DIR=/app/skills

# git (for the git operations) + openssh-client (SSH remotes / GIT_SSH_CONFIGURED)
# + the Claude Code CLI (the default agent backend)
RUN apt-get update \
    && apt-get install -y --no-install-recommends git openssh-client ca-certificates \
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

# Next standalone output. In a monorepo Next nests the app under its workspace
# path (taskforge/) inside the standalone tree, so server.js, static and public
# all sit under ./taskforge — mirror that layout exactly.
COPY --from=builder --chown=app:app /repo/taskforge/.next/standalone ./
COPY --from=builder --chown=app:app /repo/taskforge/.next/static ./taskforge/.next/static
COPY --from=builder --chown=app:app /repo/taskforge/public ./taskforge/public
# bundled, read-only app-level skills (task-creator, commit-message)
COPY --from=builder --chown=app:app /repo/taskforge/skills ./skills

# run-docker.sh runs the container as an arbitrary HOST uid (to own the bind-
# mounted /workspace), NOT the image's `app` user. Next writes its incremental /
# data cache under taskforge/.next/cache at runtime, so that dir must be writable
# by any uid — otherwise every cached response logs `EACCES … mkdir .next/cache`.
RUN mkdir -p /app/taskforge/.next/cache && chmod -R 0777 /app/taskforge/.next/cache

USER app
EXPOSE 3000
CMD ["node", "taskforge/server.js"]
