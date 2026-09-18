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

# PHP apps. PHP_VERSION selects the php-fpm minor baked in; build with
# PHP_VERSION="" for a php-free image so realms that serve only static sites
# stay out of the blast radius of a PHP CVE and keep the smaller layer. The
# extension list is deliberately generous: a missing extension is the single
# most common "why doesn't my app boot", and it costs only disk.
#   docker build --build-arg PHP_VERSION=83 -t nginxpilot:php8.3 .
#   docker build --build-arg PHP_VERSION=""  -t nginxpilot:plain  .
ARG PHP_VERSION="83"
ARG PHP_EXTENSIONS="fpm opcache session mysqli pdo pdo_mysql pdo_pgsql pdo_sqlite gd mbstring xml curl zip intl fileinfo openssl phar tokenizer dom simplexml iconv ctype json bcmath exif sodium"

# git/openssh for git sources; certbot + nginx/DNS plugins for ACME issuance
# (certbot core also provides the webroot + standalone challenges). The DNS
# plugins install from pip — there are no apk packages for them.
# --upgrade libexpat forces apk to bump the base image's stale libexpat
# (2.7.0) to the current index version (2.8.x). The freshly-pulled python3 is
# built against the newer expat (its pyexpat needs the
# XML_SetAllocTrackerActivationThreshold symbol) but only declares an
# unversioned so:libexpat.so.1 dependency, so plain `apk add` treats the old
# lib as satisfying and leaves it in place — pyexpat then fails to relocate and
# every pip invocation crashes on `import pyexpat`. Naming libexpat with
# --upgrade is what actually moves it forward.
RUN apk add --no-cache --upgrade libexpat git openssh-client ca-certificates \
    tzdata su-exec libcap certbot py3-pip curl && \
    pip install --break-system-packages certbot-nginx ${CERTBOT_DNS_PLUGINS}

# php-fpm + extensions, only when PHP_VERSION is set. The pool files nginxpilot
# writes live in /etc/php/pool.d (created by the entrypoint on the writable
# layer, not baked in — same overlayfs/rename constraint as the nginx dirs), and
# php-fpm.conf is a thin shell that includes them. The stock www pool is removed:
# a catch-all pool running as a shared uid is exactly the isolation hole the
# per-app pools exist to close.
RUN if [ -n "$PHP_VERSION" ]; then \
        set -eu; \
        pkgs=""; \
        for ext in $PHP_EXTENSIONS; do pkgs="$pkgs php${PHP_VERSION}-${ext}"; done; \
        apk add --no-cache php${PHP_VERSION} $pkgs && \
        mkdir -p /etc/php && \
        rm -f /etc/php${PHP_VERSION}/php-fpm.d/www.conf && \
        printf '[global]\npid = /run/php/php-fpm.pid\nerror_log = /proc/self/fd/2\ndaemonize = no\n\ninclude=/etc/php/pool.d/*.conf\n' \
            > /etc/php/php-fpm.conf && \
        mkdir -p /etc/php/pool.d && \
        printf '; Placeholder pool. php-fpm refuses to start with zero pools, and\n; nginxpilot writes the real app-*.conf pools only AFTER it boots — so\n; without this the pool manager could never come up on a fresh container.\n; It serves nothing: no app vhost ever points at this socket, and the apply\n; engine only ever adds or removes app-*.conf, so it is left alone.\n[nginxpilot-placeholder]\nuser = nginxpilot\ngroup = nginx\nlisten = /run/php/.placeholder.sock\nlisten.owner = nginxpilot\nlisten.mode = 0600\npm = ondemand\npm.max_children = 1\npm.process_idle_timeout = 10s\nphp_admin_value[open_basedir] = /dev/null\nphp_admin_value[disable_functions] = exec,passthru,shell_exec,system,proc_open,popen,dl,pcntl_exec\n' \
            > /etc/php/pool.d/00-placeholder.conf && \
        ln -sf /usr/sbin/php-fpm${PHP_VERSION} /usr/local/bin/php-fpm; \
    fi

RUN addgroup -S nginxpilot 2>/dev/null; \
    adduser -S -D -H -G nginx nginxpilot && \
    mkdir -p /var/lib/nginxpilot/sites.d && \
    chown -R nginxpilot:nginx /var/lib/nginxpilot

# Managed mode (nginx.manage: true): nginxpilot writes the live nginx config
# into /etc/nginx/nginxpilot/{conf.d,stream.d}. Those dirs are deliberately NOT
# baked into the image: the apply engine replaces them with rename(2), and
# overlayfs returns EXDEV when renaming a directory that exists in a lower
# image layer — the entrypoint creates them fresh at runtime instead (writable
# layer, rename-safe). nginx.conf includes both at build time, so the image is
# managed-mode-ready; in generate-only mode the (empty) globs are inert. To use
# managed mode, point the config at these paths:
#   nginx: { manage: true, conf_dir: /etc/nginx/nginxpilot/conf.d,
#            stream_conf_dir: /etc/nginx/nginxpilot/stream.d,
#            managed_include_dir: /etc/nginx/nginxpilot/conf.d }
#
# nginx runs as the SAME unprivileged `nginxpilot` user as the daemon. The
# managed-mode contract requires the daemon to run `nginx -t` (opens the
# pidfile) and `nginx -s reload` (signals the master) — both impossible against
# a root master from an unprivileged process. setcap grants the low-port bind
# (80/443); the pidfile moves to a daemon-owned dir; the `user` directive is
# dropped (meaningless for a non-root master — workers inherit its uid).
#
# The temp dirs are created HERE rather than left to nginx. nginx creates a
# missing one at 0700 owned by whoever creates it, so a dir left over from a
# root master (uid 101 `nginx`) is unwritable by the uid 100 `nginxpilot`
# workers — and 0700 means sharing the `nginx` group does not help. nginx then
# fails to buffer any upstream response larger than proxy_buffers, aborting it
# mid-body after Content-Length went out: ERR_CONTENT_LENGTH_MISMATCH on every
# large proxied response. Pre-created, mkdir hits EEXIST and the owner stands.
RUN printf '# nginxpilot managed http-context config (nested include).\ninclude /etc/nginx/nginxpilot/conf.d/*.conf;\n' \
        > /etc/nginx/conf.d/zz-nginxpilot-managed.conf && \
    printf '\n# nginxpilot managed stream-context (L4 TCP/UDP) config.\nstream {\n    include /etc/nginx/nginxpilot/stream.d/*.conf;\n}\n' \
        >> /etc/nginx/nginx.conf && \
    sed -i -e 's|^pid[[:space:]].*|pid /run/nginxpilot/nginx.pid;|' \
           -e '/^user[[:space:]]/d' /etc/nginx/nginx.conf && \
    setcap cap_net_bind_service=+ep /usr/sbin/nginx && \
    mkdir -p /var/cache/nginx/client_temp /var/cache/nginx/proxy_temp \
             /var/cache/nginx/fastcgi_temp /var/cache/nginx/scgi_temp \
             /var/cache/nginx/uwsgi_temp && \
    chown -R nginxpilot:nginx /var/cache/nginx

# certbot state (account, archive/, live/, renewal/) + the default HTTP-01
# webroot, owned by the unprivileged daemon so it can issue/renew/delete certs.
# Point tls.cert_dir at /etc/letsencrypt/live and acme.config_dir at
# /etc/letsencrypt so issued certs are discovered and served. nginx's master
# runs as the same `nginxpilot` user, so daemon-owned 0600 keys stay readable.
RUN mkdir -p /etc/letsencrypt /var/www/acme && \
    chown -R nginxpilot:nginx /etc/letsencrypt /var/www/acme

# sites.d/ lives UNDER data_dir so the unprivileged daemon (which owns data_dir)
# can write fragments there itself when a control plane drives config over the
# admin API (POST/DELETE /sites). Point the config's `include:` at
# /var/lib/nginxpilot/sites.d/*.yml. Because data_dir is a VOLUME, Docker seeds a
# fresh volume from this pre-created, daemon-owned dir on first mount.

# Replace the stock welcome page with a silent catch-all: unmatched hosts get
# 444 (connection closed, zero response bytes) on 80 and a rejected TLS
# handshake on 443, so an unconfigured host looks like nothing is served. The
# ipv6-by-default entrypoint script only edits a file named default.conf, so it
# skips this one (both listen families are already declared).
RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/default.conf /etc/nginx/conf.d/00-nginxpilot-default.conf

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
# 80/443 = nginx, 9090 = daemon admin endpoint (set admin.listen: 0.0.0.0:9090
# in config to expose it beyond the container's loopback).
EXPOSE 80 443 9090

# Requires admin.listen to be non-empty (default: 127.0.0.1:9090).
# Disabling the admin endpoint (admin.listen: "") also disables this healthcheck.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:9090/healthz >/dev/null 2>&1 || exit 1

# No arguments → supervise daemon + nginx. With arguments → run the CLI:
#   docker run --rm ... <image> validate
ENTRYPOINT ["/usr/local/bin/nginxpilot-entrypoint.sh"]
