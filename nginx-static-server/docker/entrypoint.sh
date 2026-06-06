#!/bin/sh
# Entrypoint for the combined nginx + nginx-static-server image.
#
# nginx (PID from the official entrypoint) serves the sites; the sync
# daemon runs next to it and only ever writes under
# /var/lib/nginx-static-server. The daemon runs with group `nginx` so the
# 0750/0640 permissions it enforces stay readable by the nginx workers.
#
# Any argument bypasses the supervisor and runs the CLI directly:
#   docker run ... <image> validate
#   docker run ... <image> sync example.com
set -eu

NSS_CONFIG="${NSS_CONFIG:-/etc/nginx-static-server/config.yml}"

if [ "$#" -gt 0 ]; then
    exec su-exec 0:nginx nginx-static-server "$@"
fi

su-exec 0:nginx nginx-static-server run --config "$NSS_CONFIG" &
nss_pid=$!

# Official nginx entrypoint (envsubst templates, ipv6 detection) then nginx.
/docker-entrypoint.sh nginx -g 'daemon off;' &
nginx_pid=$!

# docker stop → SIGTERM lands on this script only; forward to both.
trap 'kill -TERM "$nss_pid" "$nginx_pid" 2>/dev/null || true' TERM INT

# Container lives as long as nginx. If the daemon dies, nginx keeps serving
# the last deployed content (restart the container to resync).
code=0
wait "$nginx_pid" || code=$?
kill -TERM "$nss_pid" 2>/dev/null || true
wait "$nss_pid" 2>/dev/null || true
exit $code
