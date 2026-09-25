# syntax=docker/dockerfile:1

# ── Build stage ──────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
ARG VERSION=dev
RUN CGO_ENABLED=0 go build -trimpath \
    -ldflags "-s -w -X main.version=${VERSION}" \
    -o /out/zonewright ./cmd/zonewright

# ── Runtime stage ────────────────────────────────────────────────────────
# One container runs named AND the zonewright daemon. named starts as root
# only to bind :53, then drops to the `named` user (-u named). The daemon runs
# as the unprivileged `zonewright` user in group `named`: the zone files and
# conf fragment it writes (0640) are group-readable by named, and it can read
# the rndc key (root:named 0640) to run `rndc reload`.
FROM alpine:3.21

# bind = named, rndc, rndc-confgen, named-checkzone, named-checkconf;
# bind-tools = dig/nsupdate for debugging from inside the container.
RUN apk add --no-cache bind bind-tools su-exec ca-certificates tzdata

# /var/bind is named's private working dir (0700: the daemon shares group
# `named` and has no business there). The package's build-time rndc.key is
# removed — the entrypoint generates a fresh one per container.
RUN adduser -S -D -H -G named zonewright && \
    mkdir -p /var/lib/zonewright/zones.d /var/lib/zonewright/zones /var/bind && \
    chown -R zonewright:named /var/lib/zonewright && \
    chmod 0750 /var/lib/zonewright && \
    chown named:named /var/bind && chmod 0700 /var/bind && \
    rm -f /etc/bind/rndc.key

COPY docker/named.conf /etc/bind/named.conf
COPY --from=build /out/zonewright /usr/local/bin/zonewright
COPY docker/entrypoint.sh /usr/local/bin/zonewright-entrypoint.sh
RUN chmod +x /usr/local/bin/zonewright-entrypoint.sh

# The replicated store (zonewright.db — also this deployment's node id), zone
# files, the named.conf zone list and serial state. Persist it: a fresh volume
# is a new deployment with a new id that re-syncs everything from its peers.
VOLUME /var/lib/zonewright

# 53 = DNS, 9053 = zonewright admin API, 9153 = cluster peer sync.
EXPOSE 53/udp 53/tcp 9053 9153

# Requires admin.listen to be non-empty (default: 127.0.0.1:9053).
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:9053/healthz >/dev/null 2>&1 || exit 1

# No arguments → supervise daemon + named. With arguments → run the CLI:
#   docker run --rm ... <image> validate
ENTRYPOINT ["/usr/local/bin/zonewright-entrypoint.sh"]
