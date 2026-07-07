#!/bin/sh
# Entrypoint for the combined nginx + nginxpilot image.
#
# nginx serves the sites; the sync daemon runs next to it. In generate-only
# mode the daemon only ever writes under /var/lib/nginxpilot. In managed mode
# (nginx.manage: true) it also writes the live nginx config under
# /etc/nginx/nginxpilot/ and reloads nginx — but nginx is only ever handed
# config that already passed `nginx -t`, so a bad resource is quarantined, never
# fatal. Both processes run as the unprivileged `nginxpilot` user (group
# `nginx`): the daemon must `nginx -t` (opens the pidfile) and `nginx -s reload`
# (signals the master), which only works when the master shares its uid. Low
# ports come from the cap_net_bind_service file capability set at build.
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

# Managed-mode dirs are created at runtime, NOT baked into the image: the apply
# engine swaps them with rename(2), and overlayfs returns EXDEV when renaming a
# directory that exists in a lower image layer. Created here they live on the
# container's writable layer, where rename works. /run/nginxpilot holds the
# nginx pidfile — daemon-owned so its `nginx -t` can open it.
mkdir -p /etc/nginx/nginxpilot/conf.d /etc/nginx/nginxpilot/stream.d /run/nginxpilot
chown nginxpilot:nginx /etc/nginx/nginxpilot /etc/nginx/nginxpilot/conf.d \
    /etc/nginx/nginxpilot/stream.d /run/nginxpilot
chmod 0750 /etc/nginx/nginxpilot /etc/nginx/nginxpilot/conf.d /etc/nginx/nginxpilot/stream.d
chmod 0770 /run/nginxpilot

# nginx.default_catch_all: true makes nginxpilot render its OWN JSON-logged
# default/catch-all vhost into its managed conf.d — remove the image's static
# plain-text one first, or both declare `default_server` and nginxpilot's
# quarantine pass silently disables its copy (never fatal, but the feature
# would never actually take effect). Coarse grep, not a YAML parse, but both
# key names are distinctive enough not to false-match.
if [ -f /etc/nginx/conf.d/00-nginxpilot-default.conf ] && [ -f "$NGINXPILOT_CONFIG" ] \
    && grep -Eq '^[[:space:]]*manage:[[:space:]]*true[[:space:]]*$' "$NGINXPILOT_CONFIG" \
    && grep -Eq '^[[:space:]]*default_catch_all:[[:space:]]*true[[:space:]]*$' "$NGINXPILOT_CONFIG"; then
    rm -f /etc/nginx/conf.d/00-nginxpilot-default.conf
fi

# The nginx:alpine log symlinks (/var/log/nginx/*.log → /dev/stdout|stderr)
# reopen the container's std streams. Those pipe inodes belong to root (PID 1
# is this supervisor), so hand them to the unprivileged children or nginx
# fails at startup with "could not open error log file". No stream redirects
# on these commands — /dev/stderr resolves through the command's OWN fd 2, so
# a `2>/dev/null` would make chown target /dev/null instead of the pipe.
chown nginxpilot:nginx /dev/stdout /dev/stderr || \
    chmod 666 /dev/stdout /dev/stderr || true

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
    su-exec nginxpilot:nginx /docker-entrypoint.sh nginx -g 'daemon off;' &
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
