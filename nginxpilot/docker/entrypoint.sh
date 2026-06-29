#!/bin/sh
# Entrypoint for the combined nginx + nginxpilot image.
#
# nginx serves the sites; the sync daemon runs next to it. In generate-only
# mode the daemon only ever writes under /var/lib/nginxpilot. In managed mode
# (nginx.manage: true) it also writes the live nginx config under
# /etc/nginx/nginxpilot/ and reloads nginx — but nginx is only ever handed
# config that already passed `nginx -t`, so a bad resource is quarantined, never
# fatal. The daemon runs with group `nginx` so the 0750/0640 permissions it
# enforces stay readable by the nginx workers.
#
# nginx is supervised: if it crashes (or a worker dies), it is restarted instead
# of taking the container down. The daemon re-applies managed config on its next
# tick / reload.
#
# Any argument bypasses the supervisor and runs the CLI directly:
#   docker run ... <image> validate
#   docker run ... <image> sync example.com
#   docker run ... <image> print-include
set -eu

NGINXPILOT_CONFIG="${NGINXPILOT_CONFIG:-/etc/nginxpilot/config.yml}"

if [ "$#" -gt 0 ]; then
    exec su-exec nginxpilot:nginx nginxpilot "$@"
fi

stopping=0
nginx_pid=""
nginxpilot_pid=""

on_term() {
    stopping=1
    [ -n "$nginxpilot_pid" ] && kill -TERM "$nginxpilot_pid" 2>/dev/null || true
    [ -n "$nginx_pid" ] && kill -TERM "$nginx_pid" 2>/dev/null || true
}
# docker stop → SIGTERM lands on this script only; forward to both children.
trap on_term TERM INT

su-exec nginxpilot:nginx nginxpilot run --config "$NGINXPILOT_CONFIG" &
nginxpilot_pid=$!

# Supervise nginx in the foreground: restart on crash so a worker fault never
# takes the container down. The official nginx entrypoint (envsubst templates,
# ipv6 detection) runs each cycle.
while [ "$stopping" -eq 0 ]; do
    /docker-entrypoint.sh nginx -g 'daemon off;' &
    nginx_pid=$!
    wait "$nginx_pid" && code=0 || code=$?
    [ "$stopping" -eq 1 ] && break
    echo "nginx exited (code ${code:-?}); restarting in 1s" >&2
    sleep 1
done

# Shutting down: stop the daemon too and drain it.
kill -TERM "$nginxpilot_pid" 2>/dev/null || true
wait "$nginxpilot_pid" 2>/dev/null || true
exit 0
