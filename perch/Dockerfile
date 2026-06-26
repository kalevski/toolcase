# syntax=docker/dockerfile:1

# ── build stage ──────────────────────────────────────────────────────────────
# perch is an npm workspace whose @toolcase/* deps are `file:../` siblings
# (base, web-components) consumed from their gitignored built `lib/`. The build
# therefore needs the WHOLE monorepo, so the CI build context is the repo root.
# This Dockerfile lives in perch/ but every COPY path below is repo-root-relative.
#
# Node >= 22.5 required for the built-in `node:sqlite` module (stable, flag-free
# on Node 24) used by the control-plane store once it lands. See
# notes/static-hosting-app-design.md §5.
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
COPY perch/package.json perch/package.json
COPY examples/package.json examples/package.json
RUN npm ci

# Sources, then build only what perch consumes (base, then web-components —
# order matters: web-components imports base's built `lib/`), then perch.
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@toolcase/base \
    && npm run build --workspace=@toolcase/web-components \
    && npm run build --workspace=@toolcase/perch

# ── runtime stage ────────────────────────────────────────────────────────────
# Perch is only the control plane — it talks to GitHub and the nginxpilot daemon
# over HTTP and never sits in the request path, so the runtime image needs no
# git / CLI tooling, only a TLS trust store.
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

# Next standalone output. In a monorepo Next nests the app under its workspace
# path (perch/) inside the standalone tree, so server.js, static and public all
# sit under ./perch — mirror that layout exactly.
COPY --from=builder --chown=app:app /repo/perch/.next/standalone ./
COPY --from=builder --chown=app:app /repo/perch/.next/static ./perch/.next/static
COPY --from=builder --chown=app:app /repo/perch/public ./perch/public

# run-docker.sh may run the container as an arbitrary HOST uid (to own a bind-
# mounted state volume), NOT the image's `app` user. Next writes its incremental
# cache under perch/.next/cache at runtime, so that dir must be writable by any
# uid — otherwise every cached response logs `EACCES … mkdir .next/cache`.
RUN mkdir -p /app/perch/.next/cache && chmod -R 0777 /app/perch/.next/cache

# Durable control-plane state (the SQLite store) lives under WORKSPACE_DIR=/workspace.
# Pre-create it owned by `app` so a fresh named volume mounted here is seeded with
# that ownership and the default `app` user can write the DB. (run-docker.sh instead
# bind-mounts a host dir as an arbitrary host uid, which masks this dir — unaffected.)
RUN mkdir -p /workspace && chown app:app /workspace

USER app
EXPOSE 3000
CMD ["node", "perch/server.js"]
