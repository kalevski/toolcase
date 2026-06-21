# syntax=docker/dockerfile:1

# ── Build stage ──────────────────────────────────────────────────────────
FROM golang:1.24-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
ARG VERSION=dev
RUN CGO_ENABLED=0 go build -trimpath \
    -ldflags "-s -w -X main.version=${VERSION}" \
    -o /out/nginxpilot ./cmd/nginxpilot

# ── Runtime stage ────────────────────────────────────────────────────────
# nginx base image: one container runs nginx AND the sync daemon, sharing
# /var/lib/nginxpilot directly. git + openssh-client are required
# for git sources (the daemon shells out to the system git binary);
# su-exec runs the daemon as the unprivileged `nginxpilot` user (group `nginx`)
# so deployed files (0750/0640) stay readable by the nginx workers.
FROM nginx:1.27-alpine
RUN apk add --no-cache git openssh-client ca-certificates tzdata su-exec

RUN addgroup -S nginxpilot 2>/dev/null; \
    adduser -S -D -H -G nginx nginxpilot && \
    mkdir -p /var/lib/nginxpilot && \
    chown -R nginxpilot:nginx /var/lib/nginxpilot

COPY --from=build /out/nginxpilot /usr/local/bin/nginxpilot
COPY docker/entrypoint.sh /usr/local/bin/nginxpilot-entrypoint.sh
RUN chmod +x /usr/local/bin/nginxpilot-entrypoint.sh

# Deployed content; point each vhost at .../sites/<domain>/current.
VOLUME /var/lib/nginxpilot

# Mount your vhosts into /etc/nginx/conf.d/ — e.g. generate one with:
#   docker run --rm -v <config>:/etc/nginxpilot:ro <image> print-vhost <domain>
# 80 = nginx, 9090 = daemon admin endpoint (set admin.listen: 0.0.0.0:9090
# in config to expose it beyond the container's loopback).
EXPOSE 80 9090

# No arguments → supervise daemon + nginx. With arguments → run the CLI:
#   docker run --rm ... <image> validate
ENTRYPOINT ["/usr/local/bin/nginxpilot-entrypoint.sh"]
