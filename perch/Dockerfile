# syntax=docker/dockerfile:1
#
# perch is an npm workspace whose @toolcase/* deps are file:../ siblings, so the
# build needs the WHOLE monorepo: build context is the repo root and every COPY
# path below is repo-root-relative. Node >= 22.5 for the built-in node:sqlite.

# ── build stage ──────────────────────────────────────────────────────────────
FROM node:24-slim AS builder
WORKDIR /repo

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm ci \
    && npm run build --workspace=@toolcase/base \
    && npm run build --workspace=@toolcase/web-components \
    && npm run build --workspace=@toolcase/perch

# ── runtime stage ────────────────────────────────────────────────────────────
FROM node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# non-root user
RUN useradd -m -u 10001 app

# Next standalone tree nests the app under ./perch — mirror it exactly.
COPY --from=builder --chown=app:app /repo/perch/.next/standalone ./
COPY --from=builder --chown=app:app /repo/perch/.next/static ./perch/.next/static
COPY --from=builder --chown=app:app /repo/perch/public ./perch/public

# Next writes its incremental cache here at runtime; run-docker.sh may run the
# container as an arbitrary host uid, so the dir must be writable by any uid.
RUN mkdir -p /app/perch/.next/cache && chmod -R 0777 /app/perch/.next/cache

# Durable control-plane state (the SQLite store) under WORKSPACE_DIR=/workspace.
RUN mkdir -p /workspace && chown app:app /workspace

USER app
EXPOSE 3000
CMD ["node", "perch/server.js"]
