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
# php-fpm is the third process, started ONLY when the image carries it and the
# config turns php on. It is supervised the same way nginx is. An app whose pool
# is missing is quarantined by the daemon rather than served — serving a php file
# as text would publish the application's own credentials — so a php-fpm that
# fails to start degrades to "apps are down", never to "apps leak their source".
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

# php-fpm pool dir + socket dir, for the same overlayfs/rename reason as above.
# The daemon writes one pool file per app here and asks php-fpm to reload.
PHP_FPM_BIN="$(command -v php-fpm83 || command -v php-fpm82 || command -v php-fpm || true)"
if [ -n "$PHP_FPM_BIN" ]; then
    # /etc/php itself must be daemon-writable: the pool apply stages a temp
    # directory BESIDE pool.d, validates the whole set with `php-fpm -t`, and
    # only then swaps it in — so it needs to create siblings of pool.d.
    mkdir -p /etc/php/pool.d /run/php
    chown nginxpilot:nginx /etc/php /etc/php/pool.d /run/php
    chmod 0750 /etc/php /etc/php/pool.d
    chmod 0770 /run/php
fi

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
phpfpm_pid=""

on_term() {
    stopping=1
    [ -n "$nginxpilot_pid" ] && kill -TERM "$nginxpilot_pid" 2>/dev/null || true
    [ -n "$nginx_pid" ] && kill -TERM "$nginx_pid" 2>/dev/null || true
    [ -n "$phpfpm_pid" ] && kill -QUIT "$phpfpm_pid" 2>/dev/null || true
}
# docker stop → SIGTERM lands on this script only; forward to both children.
trap on_term TERM INT

# php-fpm first: the daemon's first apply writes pool files and asks it to
# reload, so the pool manager should already be listening. `php.enabled: true`
# in the config is what opts in; without it the binary sits unused.
if [ -n "$PHP_FPM_BIN" ] && [ -f "$NGINXPILOT_CONFIG" ] \
    && grep -Eq '^[[:space:]]*enabled:[[:space:]]*true[[:space:]]*$' "$NGINXPILOT_CONFIG" \
    && grep -q '^php:' "$NGINXPILOT_CONFIG"; then
    "$PHP_FPM_BIN" --nodaemonize --fpm-config /etc/php/php-fpm.conf &
    phpfpm_pid=$!
    # The daemon signals php-fpm to reload after writing pools; it needs the pid.
    echo "$phpfpm_pid" > /run/php/php-fpm.pid
    chown nginxpilot:nginx /run/php/php-fpm.pid
fi

su-exec nginxpilot:nginx nginxpilot run --config "$NGINXPILOT_CONFIG" &
nginxpilot_pid=$!

# Pool reloads must be done by root: the php-fpm master runs as root so each
# pool can switch to its own uid (the isolation floor), and the unprivileged
# daemon therefore cannot signal it. The daemon writes pool files; this watcher
# notices and does the privileged USR2 on its behalf.
if [ -n "$phpfpm_pid" ]; then
    (
        last=""
        while kill -0 "$phpfpm_pid" 2>/dev/null; do
            now=$(ls -l /etc/php/pool.d/ 2>/dev/null | md5sum)
            if [ -n "$last" ] && [ "$now" != "$last" ]; then
                echo "pool set changed; reloading php-fpm" >&2
                kill -USR2 "$phpfpm_pid" 2>/dev/null || true
            fi
            last="$now"
            sleep 5
        done
    ) &
fi

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

# Shutting down: stop the daemon and php-fpm too, and drain them.
kill -TERM "$nginxpilot_pid" 2>/dev/null || true
wait "$nginxpilot_pid" 2>/dev/null || true
if [ -n "$phpfpm_pid" ]; then
    kill -QUIT "$phpfpm_pid" 2>/dev/null || true
    wait "$phpfpm_pid" 2>/dev/null || true
fi
exit 0
