// The companion agent server — a second, cookieless `node:http` listener on
// `QUAYKEEPER_AGENT_PORT` (default 4101), started from `instrumentation.register`
// alongside the Next.js app. It carries the entire machine-facing surface so the
// human UI/API port and the agent port can be exposed independently:
//
//   • `GET /v1/config`                → { env, flags, version } (ETag/304)
//   • `GET /v1/env[?format=dotenv|shell]` → resolved env vars (ETag/304)
//   • `GET /v1/flags`                 → { key: { enabled } } (ETag/304)
//   • `GET /v1/client/{os}/{arch}`    → the static quaykeeper-client binary
//   • `GET /v1/install.sh`            → bootstrap script (download binary + exec)
//   • `GET /healthz`                  → liveness
//
// The data endpoints authenticate with `X-Quaykeeper-Instance` + a bearer fetch
// key (`services/agent-fetch.ts`); the binary/install endpoints are public, like
// any release-download URL. The owner points clients here via the `instanceUrl`
// admin setting (`QUAYKEEPER_URL` in a client's env).

import 'server-only'
import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { pipeline } from 'node:stream'
import path from 'node:path'
import { config } from '@/server/config'
import { beginAgentFetch } from '@/server/services/agent-fetch'
import { stringify as dotenvStringify } from '@/server/domain/env-file'
import { toShellExports } from '@/server/domain/env-export'
import { slog } from '@/server/infrastructure/server-log'

const INSTALL_SH = `#!/bin/sh
set -eu
: "\${QUAYKEEPER_URL:?QUAYKEEPER_URL required}"

os=$(uname -s | tr '[:upper:]' '[:lower:]')
arch=$(uname -m)
case "$arch" in
    x86_64) arch=amd64 ;;
    aarch64 | arm64) arch=arm64 ;;
esac

bin="\${QUAYKEEPER_BIN:-/tmp/quaykeeper-client}"

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
`

function sendJson(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
    const text = JSON.stringify(body)
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(text),
        ...headers,
    })
    res.end(text)
}

function sendText(res: http.ServerResponse, status: number, text: string, contentType: string, headers: Record<string, string> = {}): void {
    res.writeHead(status, {
        'Content-Type': contentType,
        'Content-Length': Buffer.byteLength(text),
        ...headers,
    })
    res.end(text)
}

/** First value of a possibly-multi request header. */
function header(req: http.IncomingMessage, name: string): string | undefined {
    const v = req.headers[name]
    return Array.isArray(v) ? v[0] : v
}

/** Run one authenticated fetch and answer 401/304 inline; returns the snapshot on 200. */
function fetchOr(req: http.IncomingMessage, res: http.ServerResponse, pathname: string) {
    const result = beginAgentFetch(
        {
            instanceName: header(req, 'x-quaykeeper-instance'),
            bearer: (header(req, 'authorization') ?? '').replace(/^Bearer\s+/i, '') || undefined,
            ifNoneMatch: header(req, 'if-none-match'),
        },
        pathname,
    )
    if (result.kind === 'unauthorized') {
        sendJson(res, 401, { error: 'unauthorized' })
        return null
    }
    if (result.kind === 'not_modified') {
        res.writeHead(304, { ETag: result.version })
        res.end()
        return null
    }
    return result.snapshot
}

function serveClientBinary(res: http.ServerResponse, os: string, arch: string): void {
    // Allowlist os/arch to prevent path traversal.
    if (!/^[a-z0-9]+$/.test(os) || !/^[a-z0-9]+$/.test(arch)) {
        sendJson(res, 400, { error: 'bad_target' })
        return
    }
    const file = path.join(config.clientDir, os, arch, 'quaykeeper-client')
    if (!existsSync(file)) {
        sendJson(res, 404, { error: 'binary not built for this target' })
        return
    }
    res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(statSync(file).size),
    })
    // pipeline (not .pipe) forwards a source read error into the callback instead
    // of an unhandled 'error' event — .pipe alone would crash the whole process
    // if the binary disappears mid-stream (e.g. during a redeploy).
    pipeline(createReadStream(file), res, (err) => {
        if (err) {
            slog('warn', 'agent', 'client binary stream failed', { file, error: String(err) })
            res.destroy()
        }
    })
}

function handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? '/', 'http://agent.internal')
    const pathname = url.pathname

    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'method_not_allowed' })
        return
    }

    if (pathname === '/healthz') {
        sendJson(res, 200, { ok: true })
        return
    }

    if (pathname === '/v1/install.sh') {
        sendText(res, 200, INSTALL_SH, 'text/x-shellscript; charset=utf-8')
        return
    }

    const client = /^\/v1\/client\/([^/]+)\/([^/]+)$/.exec(pathname)
    if (client) {
        serveClientBinary(res, client[1], client[2])
        return
    }

    if (pathname === '/v1/config') {
        const snapshot = fetchOr(req, res, pathname)
        if (!snapshot) return
        const { env, flags, logs, version } = snapshot
        // `logs` is omitted when the instance has no destinations; the Go client
        // treats an absent `logs` as "ship nothing" (its zero value).
        sendJson(res, 200, { env, flags, ...(logs ? { logs } : {}), version }, { ETag: version })
        return
    }

    if (pathname === '/v1/env') {
        const snapshot = fetchOr(req, res, pathname)
        if (!snapshot) return
        const format = url.searchParams.get('format')
        if (format === 'dotenv') {
            const text = dotenvStringify(Object.entries(snapshot.env).map(([key, value]) => ({ key, value })))
            sendText(res, 200, text, 'text/plain; charset=utf-8', { ETag: snapshot.version })
            return
        }
        if (format === 'shell') {
            // Sourceable `export KEY='…'` lines (single-quoted, expansion-proof) —
            // what the docker-run snippets' inline entrypoint consumes at boot.
            const text = toShellExports(Object.entries(snapshot.env).map(([key, value]) => ({ key, value })))
            sendText(res, 200, text, 'text/x-shellscript; charset=utf-8', { ETag: snapshot.version })
            return
        }
        sendJson(res, 200, snapshot.env, { ETag: snapshot.version })
        return
    }

    if (pathname === '/v1/flags') {
        const snapshot = fetchOr(req, res, pathname)
        if (!snapshot) return
        sendJson(res, 200, snapshot.flags, { ETag: snapshot.version })
        return
    }

    sendJson(res, 404, { error: 'not_found' })
}

// Survive dev-mode re-registration: the listener is process-global.
const globalStore = globalThis as { __quaykeeperAgentServer?: http.Server }

/** Idempotently start the agent listener (called from `instrumentation.register`). */
export function ensureAgentServerStarted(): void {
    if (globalStore.__quaykeeperAgentServer) return
    const server = http.createServer((req, res) => {
        try {
            handle(req, res)
        } catch (err) {
            slog('error', 'agent', 'unhandled agent-server error', {
                error: err instanceof Error ? err.message : String(err),
            })
            if (!res.headersSent) sendJson(res, 500, { error: 'internal_error' })
            else res.end()
        }
    })
    server.on('error', (err) => {
        slog('error', 'agent', 'agent server failed to listen', {
            port: config.agentPort,
            error: err instanceof Error ? err.message : String(err),
        })
        globalStore.__quaykeeperAgentServer = undefined
    })
    server.listen(config.agentPort, () => {
        slog('info', 'agent', 'agent server listening', { port: config.agentPort })
    })
    globalStore.__quaykeeperAgentServer = server
}
