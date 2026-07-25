# syntax=docker/dockerfile:1
#
# quaykeeper ships as ONE image:
#   1. cross-compile the Go client (static binaries) FIRST (move_wharf_to_perch.md
#      §9) — served unauthenticated by the agent server at /v1/client/*.
#   2. build the Next.js app SECOND — quaykeeper is an npm workspace whose @toolcase/*
#      deps are file:../ siblings, so the build needs the WHOLE monorepo: build
#      context is the repo root and every COPY path below is repo-root-relative.
#      Node >= 22.5 for the built-in node:sqlite.
#   3. assemble a slim runner LAST, with the stage-1 binaries alongside the app.

# ── Stage 1 — Go client: cross-compile static binaries FIRST ───────────────────
FROM golang:1.23 AS client
WORKDIR /src
COPY quaykeeper/client-go/ ./
ENV CGO_ENABLED=0
ARG QUAYKEEPER_CLIENT_VERSION=dev
RUN set -eu; for p in linux/amd64 linux/arm64; do \
      os=${p%/*}; arch=${p#*/}; \
      GOOS=$os GOARCH=$arch go build -trimpath -ldflags="-s -w -X main.version=${QUAYKEEPER_CLIENT_VERSION}" \
        -o /out/$os/$arch/quaykeeper-client ./cmd/quaykeeper-client; \
    done

# ── Stage 2 — Next.js builder: build the app SECOND ────────────────────────────
FROM node:22-slim AS builder
WORKDIR /repo

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm ci \
    && npm run build -w @toolcase/base -w @toolcase/web-components -w @toolcase/quaykeeper

# ── Stage 3 — runner: serve LAST ────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV QUAYKEEPER_AGENT_PORT=4101
ENV QUAYKEEPER_CLIENT_DIR=/app/quaykeeper/client-bin

# Runtime tools. Beyond ca-certificates/curl, the Databases tab's export/import
# shells out to the NATIVE dump clients (`server/infrastructure/db-dump.ts`), so
# both engines' clients must exist in this image:
#
#   • postgresql-client from PGDG, not Debian: bookworm ships 15, and pg_dump
#     REFUSES a server newer than itself. A current client dumps every older
#     server fine, so pin the newest major and bump PG_CLIENT_MAJOR over time.
#   • mysql-community-client from Oracle, not Debian's default-mysql-client
#     (MariaDB): quaykeeper passes MySQL-8 client flags (--column-statistics,
#     --set-gtid-purged) that MariaDB's dumper rejects. This client dumps MariaDB
#     servers fine — both flags are client-side.
#
# Repo suites follow the base image's own codename (node:22-slim = bookworm);
# override MYSQL_APT_CODENAME when repo.mysql.com lags a newer Debian release.
ARG PG_CLIENT_MAJOR=18
ARG MYSQL_APT_SUITE=mysql-8.4-lts
ARG MYSQL_APT_CODENAME=
RUN set -eu; \
    . /etc/os-release; \
    mysql_codename="${MYSQL_APT_CODENAME:-$VERSION_CODENAME}"; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg; \
    install -d -m 0755 /usr/share/keyrings; \
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg; \
    echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list; \
    curl -fsSL https://repo.mysql.com/RPM-GPG-KEY-mysql-2023 \
      | gpg --dearmor -o /usr/share/keyrings/mysql.gpg; \
    echo "deb [signed-by=/usr/share/keyrings/mysql.gpg] https://repo.mysql.com/apt/debian ${mysql_codename} ${MYSQL_APT_SUITE}" \
      > /etc/apt/sources.list.d/mysql.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      "postgresql-client-${PG_CLIENT_MAJOR}" mysql-community-client; \
    apt-get purge -y gnupg; \
    apt-get autoremove -y; \
    rm -rf /var/lib/apt/lists/*; \
    pg_dump --version; psql --version; mysqldump --version; mysql --version

# non-root user
RUN useradd -m -u 10001 app

# Next standalone tree nests the app under ./quaykeeper — mirror it exactly.
COPY --from=builder --chown=app:app /repo/quaykeeper/.next/standalone ./
COPY --from=builder --chown=app:app /repo/quaykeeper/.next/static ./quaykeeper/.next/static
COPY --from=builder --chown=app:app /repo/quaykeeper/public ./quaykeeper/public
# client binaries from stage 1 → served by the agent server's /v1/client/*
COPY --from=client   --chown=app:app /out ./quaykeeper/client-bin

# Next writes its incremental cache here at runtime; run-docker.sh may run the
# container as an arbitrary host uid, so the dir must be writable by any uid.
RUN mkdir -p /app/quaykeeper/.next/cache && chmod -R 0777 /app/quaykeeper/.next/cache

# Durable control-plane state (the SQLite store) under WORKSPACE_DIR=/workspace.
RUN mkdir -p /workspace && chown app:app /workspace

USER app
# 3000 = UI/API (Next.js); 4101 = agent server (instance fetch + client download)
EXPOSE 3000 4101
CMD ["node", "quaykeeper/server.js"]
