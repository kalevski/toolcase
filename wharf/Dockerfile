# syntax=docker/dockerfile:1
#
# Wharf ships as ONE image from an ordered multi-stage build (planning §13):
#   1. cross-compile the Go client (static binaries) FIRST,
#   2. build the Next.js app SECOND,
#   3. assemble a slim runner LAST that serves both ports (Next on PORT + the
#      in-process Agent listener on AGENT_PORT, which vends the stage-1 binaries).
# Build context is the monorepo root — every COPY path below is repo-root-relative.

# ── Stage 1 — Go client: cross-compile static binaries FIRST ───────────────────
FROM golang:1.23 AS client
WORKDIR /src
COPY wharf/client-go/ ./
ENV CGO_ENABLED=0
ARG WHARF_CLIENT_VERSION=dev
RUN set -eu; for p in linux/amd64 linux/arm64; do \
      os=${p%/*}; arch=${p#*/}; \
      GOOS=$os GOARCH=$arch go build -trimpath -ldflags="-s -w -X main.version=${WHARF_CLIENT_VERSION}" \
        -o /out/$os/$arch/wharf-client ./cmd/wharf-client; \
    done; \
    cd /out && find . -type f -name wharf-client -exec sha256sum {} \; > checksums.txt

# ── Stage 2 — Next.js builder: build the app SECOND ────────────────────────────
FROM node:24-slim AS builder
WORKDIR /repo
# manifests first so the deps layer caches across source-only changes. `npm ci`
# needs every workspace package.json present to validate against the root lockfile.
COPY package.json package-lock.json ./
COPY base/package.json base/package.json
COPY logging/package.json logging/package.json
COPY serializer/package.json serializer/package.json
COPY web-components/package.json web-components/package.json
COPY phaser-plus/package.json phaser-plus/package.json
COPY node/package.json node/package.json
COPY taskforge/package.json taskforge/package.json
COPY perch/package.json perch/package.json
COPY wharf/package.json wharf/package.json
COPY examples/package.json examples/package.json
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# build toolcase deps in order, then the app (Next output: 'standalone')
RUN npm run build --workspace=@toolcase/base \
 && npm run build --workspace=@toolcase/web-components \
 && npm run build --workspace=@toolcase/wharf

# ── Stage 3 — runner: serve LAST (Next on PORT + Agent on AGENT_PORT) ──────────
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 AGENT_PORT=4000 WORKSPACE_DIR=/workspace \
    WHARF_CLIENT_DIR=/app/wharf/client-bin
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 10001 app && mkdir -p /workspace && chown -R app:app /workspace
# Next standalone tree nests the app under ./wharf/ — mirror it exactly.
COPY --from=builder --chown=app:app /repo/wharf/.next/standalone ./
COPY --from=builder --chown=app:app /repo/wharf/.next/static ./wharf/.next/static
COPY --from=builder --chown=app:app /repo/wharf/public ./wharf/public
# client binaries from stage 1 → served by the Agent listener at /v1/client/*
COPY --from=client   --chown=app:app /out ./wharf/client-bin
RUN mkdir -p /app/wharf/.next/cache && chmod -R 0777 /app/wharf/.next/cache
USER app
EXPOSE 3000 4000
# server.js boots Next on PORT; instrumentation.ts starts the Agent server on AGENT_PORT.
CMD ["node", "wharf/server.js"]
