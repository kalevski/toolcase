// GET /api/agent/v1/install.sh — bootstrap script (unauthenticated), ported
// from wharf's install.sh and re-pointed at PERCH_URL + the new binary path
// (move_wharf_to_perch.md §9). Typical container entrypoint:
//
//   wget -qO- "$PERCH_URL/api/agent/v1/install.sh" | sh -s -- exec -- "$@"

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INSTALL_SH = `#!/bin/sh
set -eu
: "\${PERCH_URL:?PERCH_URL required}"

os=$(uname -s | tr '[:upper:]' '[:lower:]')
arch=$(uname -m)
case "$arch" in
    x86_64) arch=amd64 ;;
    aarch64 | arm64) arch=arm64 ;;
esac

bin="\${PERCH_BIN:-/tmp/perch-client}"

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
`

export async function GET() {
    return new NextResponse(INSTALL_SH, {
        status: 200,
        headers: { 'Content-Type': 'text/x-shellscript; charset=utf-8' },
    })
}
