# syntax=docker/dockerfile:1
#
# voxscribe ships as ONE image (spec §11):
#   1. compile whisper.cpp FIRST (portable binary, -DGGML_NATIVE=OFF) — the
#      transcription engine, spawned as a child process at runtime.
#   2. fetch the seed ggml model — the default 'small' tier, baked so the image
#      transcribes out of the box.
#   3. build the Next.js app — voxscribe is an npm workspace whose @toolcase/*
#      deps are sibling workspaces, so the build needs the WHOLE monorepo: build
#      context is the repo root and every COPY path below is repo-root-relative.
#      Node >= 22.5 for the built-in node:sqlite.
#   4. assemble a slim runner LAST with ffmpeg + whisper-cli alongside the app.
#
# Only the seed model is baked; larger tiers still live in the mounted
# ${WORKSPACE_DIR}/models volume, fetched via the admin model manager. Because
# that volume SHADOWS the image's model dir at runtime, the seed blob is baked
# to /opt/voxscribe/seed-models and copied into the volume on start by
# docker-entrypoint.sh (idempotent — operator downloads stay durable).

# ── Stage 1 — whisper.cpp: compile the engine FIRST ────────────────────────────
FROM debian:bookworm-slim AS whisper
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential cmake git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ARG WHISPER_CPP_VERSION=v1.7.5
RUN git clone --depth 1 --branch ${WHISPER_CPP_VERSION} https://github.com/ggml-org/whisper.cpp /src
WORKDIR /src
# -DGGML_NATIVE=OFF → portable binary (no -march=native), runs on any x86-64/arm64.
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=OFF -DBUILD_SHARED_LIBS=OFF \
    && cmake --build build --config Release -j "$(nproc)" --target whisper-cli \
    && install -m 0755 build/bin/whisper-cli /usr/local/bin/whisper-cli

# ── Stage 2 — seed model: bake the default 'small' ggml blob ─────────────────────
FROM debian:bookworm-slim AS model
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# Which tier to bake. Must match server/config.ts defaultModel to work out-of-box.
ARG SEED_MODEL=small
RUN mkdir -p /seed-models \
    && curl -fSL --retry 3 \
        -o "/seed-models/ggml-${SEED_MODEL}.bin" \
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${SEED_MODEL}.bin" \
    && test -s "/seed-models/ggml-${SEED_MODEL}.bin"

# ── Stage 3 — Next.js builder ───────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /repo

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm ci \
    && npm run build -w @toolcase/base -w @toolcase/web-components -w @toolcase/voxscribe

# ── Stage 4 — runner ─────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4200

# ffmpeg/ffprobe for decode validation + 16 kHz mono transcode; curl for HEALTHCHECK.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

# non-root user
RUN useradd -m -u 10001 app

# the engine from stage 1
COPY --from=whisper /usr/local/bin/whisper-cli /usr/local/bin/whisper-cli

# the seed model from stage 2 — copied into the volume at start by the entrypoint
# (a+rX so any runtime uid can read it before copying).
COPY --from=model /seed-models /opt/voxscribe/seed-models
RUN chmod -R a+rX /opt/voxscribe/seed-models

# start-time model seeder (idempotent; survives the ${WORKSPACE_DIR} volume mount)
COPY voxscribe/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 0755 /usr/local/bin/docker-entrypoint.sh

# Next standalone tree nests the app under ./voxscribe — mirror it exactly.
COPY --from=builder --chown=app:app /repo/voxscribe/.next/standalone ./
COPY --from=builder --chown=app:app /repo/voxscribe/.next/static ./voxscribe/.next/static
COPY --from=builder --chown=app:app /repo/voxscribe/public ./voxscribe/public

# Next writes its incremental cache here at runtime; run-docker.sh may run the
# container as an arbitrary host uid, so the dir must be writable by any uid.
RUN mkdir -p /app/voxscribe/.next/cache && chmod -R 0777 /app/voxscribe/.next/cache

# Durable state (SQLite + media + models + notes) under WORKSPACE_DIR=/workspace.
RUN mkdir -p /workspace && chown app:app /workspace
VOLUME ["/workspace"]

USER app
EXPOSE 4200
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
    CMD curl -fsS http://127.0.0.1:4200/api/health || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "voxscribe/server.js"]
