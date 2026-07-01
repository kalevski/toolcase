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

# certbot DNS plugins to install (space-separated). Default covers the common
# providers; override at build time, e.g.
#   --build-arg CERTBOT_DNS_PLUGINS="certbot-dns-cloudflare certbot-dns-route53"
ARG CERTBOT_DNS_PLUGINS="certbot-dns-digitalocean certbot-dns-cloudflare certbot-dns-route53 certbot-dns-google"

# git/openssh for git sources; certbot + nginx/DNS plugins for ACME issuance
# (certbot core also provides the webroot + standalone challenges). The DNS
# plugins install from pip — there are no apk packages for them.
RUN apk add --no-cache git openssh-client ca-certificates tzdata su-exec \
    certbot py3-pip && \
    pip install --break-system-packages certbot-nginx ${CERTBOT_DNS_PLUGINS}

RUN addgroup -S nginxpilot 2>/dev/null; \
    adduser -S -D -H -G nginx nginxpilot && \
    mkdir -p /var/lib/nginxpilot/sites.d && \
    chown -R nginxpilot:nginx /var/lib/nginxpilot

# Managed mode (nginx.manage: true): nginxpilot writes the live nginx config
# into these dirs. The daemon (nginxpilot:nginx) owns the PARENT dir so it can
# atomically rename its conf.d/stream.d children into place while unprivileged.
# nginx.conf includes both at build time, so the image is managed-mode-ready; in
# generate-only mode the (empty) globs are inert. To use managed mode, point the
# config at these paths:
#   nginx: { manage: true, conf_dir: /etc/nginx/nginxpilot/conf.d,
#            stream_conf_dir: /etc/nginx/nginxpilot/stream.d,
#            managed_include_dir: /etc/nginx/nginxpilot/conf.d }
RUN mkdir -p /etc/nginx/nginxpilot/conf.d /etc/nginx/nginxpilot/stream.d && \
    chown -R nginxpilot:nginx /etc/nginx/nginxpilot && \
    chmod -R 0750 /etc/nginx/nginxpilot && \
    printf '# nginxpilot managed http-context config (nested include).\ninclude /etc/nginx/nginxpilot/conf.d/*.conf;\n' \
        > /etc/nginx/conf.d/zz-nginxpilot-managed.conf && \
    printf '\n# nginxpilot managed stream-context (L4 TCP/UDP) config.\nstream {\n    include /etc/nginx/nginxpilot/stream.d/*.conf;\n}\n' \
        >> /etc/nginx/nginx.conf

# certbot state (account, archive/, live/, renewal/) + the default HTTP-01
# webroot, owned by the unprivileged daemon so it can issue/renew/delete certs.
# Point tls.cert_dir at /etc/letsencrypt/live and acme.config_dir at
# /etc/letsencrypt so issued certs are discovered and served. nginx's master
# runs as root and reads cert/key files, so daemon-owned 0600 keys are fine.
RUN mkdir -p /etc/letsencrypt /var/www/acme && \
    chown -R nginxpilot:nginx /etc/letsencrypt /var/www/acme

# sites.d/ lives UNDER data_dir so the unprivileged daemon (which owns data_dir)
# can write fragments there itself when a control plane drives config over the
# admin API (POST/DELETE /sites). Point the config's `include:` at
# /var/lib/nginxpilot/sites.d/*.yml. Because data_dir is a VOLUME, Docker seeds a
# fresh volume from this pre-created, daemon-owned dir on first mount.

COPY --from=build /out/nginxpilot /usr/local/bin/nginxpilot
COPY docker/entrypoint.sh /usr/local/bin/nginxpilot-entrypoint.sh
RUN chmod +x /usr/local/bin/nginxpilot-entrypoint.sh

# Deployed content; point each vhost at .../sites/<domain>/current.
VOLUME /var/lib/nginxpilot

# Persist certbot's ACME account + issued certs across container recreation
# (a fresh /etc/letsencrypt would lose certs and risk CA rate limits on re-issue).
VOLUME /etc/letsencrypt

# Mount your vhosts into /etc/nginx/conf.d/ — e.g. generate one with:
#   docker run --rm -v <config>:/etc/nginxpilot:ro <image> print-vhost <domain>
# 80 = nginx, 9090 = daemon admin endpoint (set admin.listen: 0.0.0.0:9090
# in config to expose it beyond the container's loopback).
EXPOSE 80 9090

# Requires admin.listen to be non-empty (default: 127.0.0.1:9090).
# Disabling the admin endpoint (admin.listen: "") also disables this healthcheck.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:9090/healthz >/dev/null 2>&1 || exit 1

# No arguments → supervise daemon + nginx. With arguments → run the CLI:
#   docker run --rm ... <image> validate
ENTRYPOINT ["/usr/local/bin/nginxpilot-entrypoint.sh"]
