#!/bin/sh
# Entrypoint for the combined named + zonewright image.
#
# zonewright renders zone files and the named.conf zone list under
# /var/lib/zonewright and asks named to load them with `rndc reload`; named
# serves them. named is only ever handed zones that passed named-checkzone, so
# a bad zone keeps serving its last known-good file rather than taking the
# server down.
#
# named is supervised: if it exits it is restarted instead of taking the
# container down. zonewright retries a failed reload every 30s, so whichever
# process comes up first, the other catches up.
#
# Any argument bypasses the supervisor and runs the CLI directly:
#   docker run ... <image> validate
#   docker run ... <image> print-zone example.com
set -eu

ZONEWRIGHT_CONFIG="${ZONEWRIGHT_CONFIG:-/etc/zonewright/config.yml}"
DATA=/var/lib/zonewright

# Root only ever touches paths the daemon cannot control. Everything INSIDE
# data_dir is daemon-owned, so a compromised daemon could plant symlinks there
# (zones -> /usr/local/bin); a root chown/chmod/write on such a path follows
# the link and hands the daemon root-owned files. So root prepares only the
# volume root itself (its parent /var/lib is root-owned, so it cannot be
# swapped) and everything below it is created as the daemon user.
if [ -L "$DATA" ]; then
    echo "refusing to start: $DATA is a symlink" >&2
    exit 1
fi
mkdir -p "$DATA" /run/named
chown zonewright:named "$DATA"
chmod 0750 "$DATA"
chown named:named /run/named

su-exec zonewright:named sh -eu -c '
    cd "$1"
    mkdir -p zones.d zones
    chmod 0750 zones.d zones
    # named.conf includes the zone list; it must exist before named first
    # starts, even if the daemon has not rendered it yet.
    if [ ! -e named.zones.conf ]; then
        printf "// (no zones yet - written by zonewright)\n" > named.zones.conf
        chmod 0640 named.zones.conf
    fi
' sh "$DATA"

# rndc key: a fresh one on every start. The distro package generates a key at
# image build time, which would make every container from this image share
# one publicly downloadable control key. /etc/bind is root-owned (not
# group-writable), so these root operations cannot be redirected. Group
# `named` lets the unprivileged daemon read it for `rndc reload`.
rm -f /etc/bind/rndc.key
rndc-confgen -a -k rndc-key -c /etc/bind/rndc.key >/dev/null 2>&1
chown root:named /etc/bind/rndc.key
chmod 0640 /etc/bind/rndc.key

if [ "$#" -gt 0 ]; then
    exec su-exec zonewright:named zonewright "$@"
fi

stopping=0
named_pid=""
zonewright_pid=""

on_term() {
    stopping=1
    [ -n "$zonewright_pid" ] && kill -TERM "$zonewright_pid" 2>/dev/null || true
    [ -n "$named_pid" ] && kill -TERM "$named_pid" 2>/dev/null || true
}
# docker stop → SIGTERM lands on this script only; forward to both children.
trap on_term TERM INT

# The daemon first, so its initial apply writes the zones named loads.
su-exec zonewright:named zonewright run --config "$ZONEWRIGHT_CONFIG" &
zonewright_pid=$!

while [ "$stopping" -eq 0 ]; do
    # -g: foreground, log to stderr. -u: drop to `named` after binding :53.
    named -g -u named -c /etc/bind/named.conf &
    named_pid=$!
    wait "$named_pid" && code=0 || code=$?
    [ "$stopping" -eq 1 ] && break
    echo "named exited (code ${code:-?}); restarting in 1s" >&2
    sleep 1
done

kill -TERM "$zonewright_pid" 2>/dev/null || true
wait "$zonewright_pid" 2>/dev/null || true
exit 0
