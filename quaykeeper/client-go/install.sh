#!/bin/sh
# Quaykeeper client bootstrap — served by the fetch API at $QUAYKEEPER_URL/v1/install.sh
# (move_wharf_to_perch.md §9). A target container downloads the matching
# quaykeeper-client binary at boot and execs it, so the app image needs no Quaykeeper
# code baked in.
#
# Typical entrypoint:
#   ENTRYPOINT ["sh", "-c", "wget -qO- \"$QUAYKEEPER_URL/v1/install.sh\" | sh -s -- exec -- \"$@\"", "sh"]
#   CMD ["./my-app", "--serve"]
set -eu
: "${QUAYKEEPER_URL:?QUAYKEEPER_URL required}"

os=$(uname -s | tr '[:upper:]' '[:lower:]')                 # linux | darwin
arch=$(uname -m)
case "$arch" in
    x86_64) arch=amd64 ;;
    aarch64 | arm64) arch=arm64 ;;
esac

bin="${QUAYKEEPER_BIN:-/tmp/quaykeeper-client}"

# Download the matching binary (wget or curl).
if command -v wget >/dev/null 2>&1; then
    wget -qO "$bin" "$QUAYKEEPER_URL/v1/client/$os/$arch"
elif command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$bin" "$QUAYKEEPER_URL/v1/client/$os/$arch"
else
    echo "quaykeeper install.sh: need wget or curl" >&2
    exit 1
fi
chmod +x "$bin"

exec "$bin" "$@"
