#!/bin/sh
# Wharf client bootstrap — served by the Agent server at $WHARF_URL/install.sh
# (planning §6.4). A target container downloads the matching wharf-client binary
# at boot and execs it, so the app image needs no Wharf code baked in.
#
# Typical entrypoint:
#   ENTRYPOINT ["sh", "-c", "wget -qO- \"$WHARF_URL/install.sh\" | sh -s -- exec -- \"$@\"", "sh"]
#   CMD ["./my-app", "--serve"]
set -eu
: "${WHARF_URL:?WHARF_URL required}"

os=$(uname -s | tr '[:upper:]' '[:lower:]')                 # linux | darwin
arch=$(uname -m)
case "$arch" in
    x86_64) arch=amd64 ;;
    aarch64 | arm64) arch=arm64 ;;
esac

bin="${WHARF_BIN:-/tmp/wharf-client}"

# Download the matching binary (wget or curl).
if command -v wget >/dev/null 2>&1; then
    wget -qO "$bin" "$WHARF_URL/v1/client/$os/$arch"
elif command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$bin" "$WHARF_URL/v1/client/$os/$arch"
else
    echo "wharf install.sh: need wget or curl" >&2
    exit 1
fi
chmod +x "$bin"

# Optional integrity check against the published checksums.
if [ "${WHARF_VERIFY:-0}" = "1" ] && command -v sha256sum >/dev/null 2>&1; then
    sums=$(wget -qO- "$WHARF_URL/v1/client/checksums" 2>/dev/null || curl -fsSL "$WHARF_URL/v1/client/checksums" 2>/dev/null || true)
    want=$(printf '%s\n' "$sums" | grep "./$os/$arch/wharf-client" | awk '{print $1}')
    got=$(sha256sum "$bin" | awk '{print $1}')
    if [ -n "$want" ] && [ "$want" != "$got" ]; then
        echo "wharf install.sh: checksum mismatch" >&2
        exit 1
    fi
fi

exec "$bin" "$@"
