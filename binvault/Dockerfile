# syntax=docker/dockerfile:1

# ── Build ────────────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ARG VERSION=dev
ARG COMMIT=unknown
# Pure-Go SQLite (modernc.org/sqlite): no cgo, a fully static binary.
RUN CGO_ENABLED=0 go build -trimpath \
    -ldflags "-s -w -X main.version=${VERSION} -X main.commit=${COMMIT}" \
    -o /out/binvault ./cmd/binvault
# The data dir is created here (distroless has no shell) so a fresh volume
# inherits nonroot ownership.
RUN mkdir -p /out/data

# ── Runtime ──────────────────────────────────────────────────────────────
# distroless/static: no shell, no package manager, nonroot uid 65532.
FROM gcr.io/distroless/static-debian12:nonroot
# OCI image labels. VERSION and COMMIT are the build args the binary is stamped with;
# CI also passes the labels of docker/metadata-action, which take precedence.
ARG VERSION=dev
ARG COMMIT=unknown
LABEL org.opencontainers.image.title="binvault" \
      org.opencontainers.image.description="S3-compatible object store with before/after-save pipelines, in one static binary" \
      org.opencontainers.image.source="https://github.com/kalevski/toolcase" \
      org.opencontainers.image.url="https://github.com/kalevski/toolcase/tree/main/binvault" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${COMMIT}"
COPY --from=build /out/binvault /usr/local/bin/binvault
COPY --from=build --chown=65532:65532 /out/data /var/lib/binvault

# Inside a container loopback is unreachable from the host, so the admin
# listener binds all interfaces over plain HTTP. Publish it on the host's
# loopback only:  -p 127.0.0.1:9001:9001
ENV BINVAULT_DATA_DIR=/var/lib/binvault \
    BINVAULT_ADMIN_LISTEN=0.0.0.0:9001 \
    BINVAULT_ADMIN_INSECURE_HTTP=true

# meta.db, blobs/, uploads/ and tmp/ live here and must share one filesystem.
VOLUME /var/lib/binvault

# 9000 = S3 API, 9001 = admin API + metrics, 9100 = cluster peer listener
# (cluster mode only).
EXPOSE 9000 9001 9100

USER nonroot

# distroless has no wget/curl: the binary probes itself (GET /_healthz).
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD ["/usr/local/bin/binvault", "healthcheck"]

# Entrypoint-as-CLI passthrough (nginxpilot idiom): CMD supplies the default
# subcommand, arguments override it —
#   docker run --rm img validate
# Hardened run:
#   docker run --read-only --cap-drop ALL -v bv:/var/lib/binvault \
#     -p 9000:9000 -p 127.0.0.1:9001:9001 \
#     -e BINVAULT_ADMIN_TOKEN=... -e BINVAULT_MASTER_KEY=... img
ENTRYPOINT ["/usr/local/bin/binvault"]
CMD ["run"]
