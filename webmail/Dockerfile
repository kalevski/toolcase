# syntax=docker/dockerfile:1

# ── SPA ──────────────────────────────────────────────────────────────────
# Built against the PUBLISHED @toolcase/web-components (web/package-lock.json),
# not the monorepo sources.
FROM node:22-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# vite writes to ../internal/web/dist
RUN mkdir -p /src/internal/web && npm run build

# ── Go binary ────────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Replace whatever was in the context with the freshly built SPA.
RUN rm -rf internal/web/dist
COPY --from=web /src/internal/web/dist internal/web/dist
ARG VERSION=dev
ARG COMMIT=unknown
# Pure-Go SQLite (modernc.org/sqlite): no cgo, a fully static binary.
RUN CGO_ENABLED=0 go build -trimpath \
    -ldflags "-s -w -X main.version=${VERSION} -X main.commit=${COMMIT}" \
    -o /out/webmail ./cmd/webmail
# distroless has no shell: create the data dir here so a fresh volume is nonroot-owned.
RUN mkdir -p /out/data

# ── Runtime ──────────────────────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/webmail /usr/local/bin/webmail
COPY --from=build --chown=65532:65532 /out/data /var/lib/webmail

# Inside a container loopback is unreachable from the host, so the admin
# listener (/_metrics only) binds all interfaces. Publish it on the host's
# loopback only:  -p 127.0.0.1:8081:8081
ENV WEBMAIL_DATA_DIR=/var/lib/webmail \
    WEBMAIL_ADMIN_LISTEN=0.0.0.0:8081

VOLUME /var/lib/webmail
EXPOSE 8080 8081
USER nonroot

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD ["/usr/local/bin/webmail", "healthcheck"]

# CMD supplies the default subcommand; arguments override it:
#   docker run --rm img validate
ENTRYPOINT ["/usr/local/bin/webmail"]
CMD ["run"]
