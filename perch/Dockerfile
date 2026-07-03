# syntax=docker/dockerfile:1
#
# perch ships as ONE image:
#   1. cross-compile the Go client (static binaries) FIRST (move_wharf_to_perch.md
#      §9) — served unauthenticated by the instance-fetch API at /api/agent/v1/client/*.
#   2. build the Next.js app SECOND — perch is an npm workspace whose @toolcase/*
#      deps are file:../ siblings, so the build needs the WHOLE monorepo: build
#      context is the repo root and every COPY path below is repo-root-relative.
#      Node >= 22.5 for the built-in node:sqlite.
#   3. assemble a slim runner LAST, with the stage-1 binaries alongside the app.

# ── Stage 1 — Go client: cross-compile static binaries FIRST ───────────────────
FROM golang:1.23 AS client
WORKDIR /src
COPY perch/client-go/ ./
ENV CGO_ENABLED=0
ARG PERCH_CLIENT_VERSION=dev
RUN set -eu; for p in linux/amd64 linux/arm64; do \
      os=${p%/*}; arch=${p#*/}; \
      GOOS=$os GOARCH=$arch go build -trimpath -ldflags="-s -w -X main.version=${PERCH_CLIENT_VERSION}" \
        -o /out/$os/$arch/perch-client ./cmd/perch-client; \
    done

# ── Stage 2 — Next.js builder: build the app SECOND ────────────────────────────
FROM node:22-slim AS builder
WORKDIR /repo

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm ci \
    && npm run build -w @toolcase/base -w @toolcase/web-components -w @toolcase/perch

# ── Stage 3 — runner: serve LAST ────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV PERCH_CLIENT_DIR=/app/perch/client-bin

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# non-root user
RUN useradd -m -u 10001 app

# Next standalone tree nests the app under ./perch — mirror it exactly.
COPY --from=builder --chown=app:app /repo/perch/.next/standalone ./
COPY --from=builder --chown=app:app /repo/perch/.next/static ./perch/.next/static
COPY --from=builder --chown=app:app /repo/perch/public ./perch/public
# client binaries from stage 1 → served by /api/agent/v1/client/*
COPY --from=client   --chown=app:app /out ./perch/client-bin

# Next writes its incremental cache here at runtime; run-docker.sh may run the
# container as an arbitrary host uid, so the dir must be writable by any uid.
RUN mkdir -p /app/perch/.next/cache && chmod -R 0777 /app/perch/.next/cache

# Durable control-plane state (the SQLite store) under WORKSPACE_DIR=/workspace.
RUN mkdir -p /workspace && chown app:app /workspace

USER app
EXPOSE 3000
CMD ["node", "perch/server.js"]
