#!/bin/sh
# Perch client bootstrap — served by the fetch API at $PERCH_URL/api/agent/v1/install.sh
# (move_wharf_to_perch.md §9). A target container downloads the matching
# perch-client binary at boot and execs it, so the app image needs no Perch
# code baked in.
#
# Typical entrypoint:
#   ENTRYPOINT ["sh", "-c", "wget -qO- \"$PERCH_URL/api/agent/v1/install.sh\" | sh -s -- exec -- \"$@\"", "sh"]
#   CMD ["./my-app", "--serve"]
set -eu
: "${PERCH_URL:?PERCH_URL required}"

os=$(uname -s | tr '[:upper:]' '[:lower:]')                 # linux | darwin
arch=$(uname -m)
case "$arch" in
    x86_64) arch=amd64 ;;
    aarch64 | arm64) arch=arm64 ;;
esac

bin="${PERCH_BIN:-/tmp/perch-client}"

# Download the matching binary (wget or curl).
if command -v wget >/dev/null 2>&1; then
    wget -qO "$bin" "$PERCH_URL/api/agent/v1/client/$os/$arch"
elif command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$bin" "$PERCH_URL/api/agent/v1/client/$os/$arch"
else
    echo "perch install.sh: need wget or curl" >&2
    exit 1
fi
chmod +x "$bin"

exec "$bin" "$@"
