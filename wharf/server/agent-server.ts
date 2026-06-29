// Agent API — the separate-port machine server (planning §5). A second node:http
// listener in the SAME process as the Next dashboard, on AGENT_PORT, sharing the
// node:sqlite singleton + cipher + services. Cookieless, read-only, instance-key
// authenticated. Bind to the internal network only — never publish it.
//
// Routes:
//   GET /healthz                 -> 200 (no auth)
//   GET /v1/config               -> { env, flags, version }            [instance key]
//   GET /v1/env[?format=dotenv]  -> { KEY: val } | dotenv text         [instance key]
//   GET /v1/flags                -> { key: { enabled, value, type } }  [instance key]
//   GET /install.sh              -> POSIX bootstrap                     (no auth)
//   GET /v1/client/{os}/{arch}   -> the static wharf-client binary      (no auth)
//   GET /v1/client/checksums     -> SHA-256 sums                        (no auth)

import 'server-only'
import http from 'node:http'
import crypto from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { config } from '@/server/config'
import { authenticateInstance } from '@/server/services/instance-keys'
import { resolveInstance } from '@/server/services/env-vars'
import { listFlagsWithValues } from '@/server/services/flags'
import * as environmentRepo from '@/server/data/repositories/environment-repo'
import * as instanceRepo from '@/server/data/repositories/instance-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { stringify as dotenvStringify } from '@/server/domain/env-file'

declare global {
    var __wharfAgentServer: http.Server | undefined
}

// ── deterministic version / ETag (gap-4) ──────────────────────────────────────

function canonical(v: unknown): string {
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']'
    if (v && typeof v === 'object') {
        return (
            '{' +
            Object.keys(v as Record<string, unknown>)
                .sort()
                .map((k) => JSON.stringify(k) + ':' + canonical((v as Record<string, unknown>)[k]))
                .join(',') +
            '}'
        )
    }
    return JSON.stringify(v)
}

function computeVersion(env: Record<string, string>, flags: Record<string, unknown>): string {
    return crypto.createHash('sha256').update(canonical({ env, flags })).digest('hex').slice(0, 16)
}

// ── in-memory token-bucket rate limiting (gap-6; resets on restart) ────────────

interface Bucket {
    tokens: number
    last: number
}
const instanceBuckets = new Map<string, Bucket>()
const ipBuckets = new Map<string, Bucket>()

function allow(map: Map<string, Bucket>, key: string, capacity: number, perSecond: number): boolean {
    const now = Date.now()
    let b = map.get(key)
    if (!b) {
        b = { tokens: capacity, last: now }
        map.set(key, b)
    }
    b.tokens = Math.min(capacity, b.tokens + ((now - b.last) / 1000) * perSecond)
    b.last = now
    if (b.tokens < 1) return false
    b.tokens -= 1
    return true
}

// ── helpers ────────────────────────────────────────────────────────────────────

function send(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
    const payload = typeof body === 'string' ? body : JSON.stringify(body)
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers })
    res.end(payload)
}

/** Resolve an instance's env + flags maps for the Agent response (secrets included). */
function buildPayload(projectId: string, instanceId: string, environmentId: string) {
    const resolved = resolveInstance(projectId, instanceId, /* canReadSecrets */ true)
    const env: Record<string, string> = {}
    for (const e of resolved.env) env[e.key] = e.value

    const flags: Record<string, { enabled: boolean; value: unknown; type: string }> = {}
    for (const fw of listFlagsWithValues(projectId)) {
        const v = fw.values[environmentId]
        flags[fw.flag.key] = {
            enabled: v?.enabled ?? false,
            value: v?.value ?? null,
            type: fw.flag.type,
        }
    }
    return { env, flags, missingRequired: resolved.missingRequired }
}

const INSTALL_SH = `#!/bin/sh
# Wharf client bootstrap (served by the Agent server). Planning §6.4.
set -eu
: "\${WHARF_URL:?WHARF_URL required}"
os=$(uname -s | tr '[:upper:]' '[:lower:]')
arch=$(uname -m)
case "$arch" in x86_64) arch=amd64 ;; aarch64|arm64) arch=arm64 ;; esac
bin="\${WHARF_BIN:-/tmp/wharf-client}"
if command -v wget >/dev/null 2>&1; then wget -qO "$bin" "$WHARF_URL/v1/client/$os/$arch";
elif command -v curl >/dev/null 2>&1; then curl -fsSL -o "$bin" "$WHARF_URL/v1/client/$os/$arch";
else echo "need wget or curl" >&2; exit 1; fi
chmod +x "$bin"
exec "$bin" "$@"
`

function serveClientBinary(res: http.ServerResponse, os: string, arch: string) {
    // Allowlist os/arch to prevent path traversal.
    if (!/^[a-z0-9]+$/.test(os) || !/^[a-z0-9]+$/.test(arch)) return send(res, 400, { error: 'bad target' })
    const file = path.join(config.clientDir, os, arch, 'wharf-client')
    if (!existsSync(file)) return send(res, 404, { error: 'binary not built for this target' })
    res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(statSync(file).size),
    })
    createReadStream(file).pipe(res)
}

// ── request handler ────────────────────────────────────────────────────────────

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://agent')
    const pathname = url.pathname
    const ip = (req.socket.remoteAddress ?? 'unknown').replace(/^::ffff:/, '')

    if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' })

    // Liveness.
    if (pathname === '/healthz') return send(res, 200, { ok: true })

    // Unauthenticated client distribution (internal-only port; rate-limit by IP).
    if (pathname === '/install.sh' || pathname.startsWith('/v1/client/')) {
        if (!allow(ipBuckets, ip, 30, 1)) return send(res, 429, { error: 'rate limited' }, { 'Retry-After': '5' })
        if (pathname === '/install.sh') {
            res.writeHead(200, { 'Content-Type': 'text/x-shellscript; charset=utf-8' })
            return res.end(INSTALL_SH)
        }
        if (pathname === '/v1/client/checksums') {
            const file = path.join(config.clientDir, 'checksums.txt')
            if (!existsSync(file)) return send(res, 404, { error: 'checksums not available' })
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
            return res.end(readFileSync(file))
        }
        const m = pathname.match(/^\/v1\/client\/([^/]+)\/([^/]+)$/)
        if (m) return serveClientBinary(res, m[1], m[2])
        return send(res, 404, { error: 'not found' })
    }

    // Authenticated config routes.
    if (pathname === '/v1/config' || pathname === '/v1/env' || pathname === '/v1/flags') {
        const auth = authenticateInstance(
            req.headers['x-wharf-instance'] as string | undefined,
            req.headers['x-wharf-environment'] as string | undefined,
            (req.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, ''),
        )
        if (!auth.ok) return send(res, auth.status, { error: auth.status === 404 ? 'unknown instance' : 'unauthorized' })

        if (!allow(instanceBuckets, auth.instanceId, 60, 1)) {
            return send(res, 429, { error: 'rate limited' }, { 'Retry-After': '5' })
        }

        const { env, flags, missingRequired } = buildPayload(auth.projectId, auth.instanceId, auth.environmentId)

        // Strict mode (decision #11): fail closed rather than boot incomplete.
        const environment = environmentRepo.byId(auth.environmentId)
        if (environment?.strictRequired && missingRequired.length > 0) {
            return send(res, 409, { error: 'missing required keys', missingRequired })
        }

        const version = computeVersion(env, flags)
        const nowIso = new Date().toISOString()

        // ETag / 304: a 304 still stamps last_fetch_at (the watermark) but is NOT
        // audited, bounding audit growth (gap-3).
        if (req.headers['if-none-match'] === version) {
            instanceRepo.touchFetch(auth.instanceId, nowIso)
            return res.writeHead(304, { ETag: version }).end()
        }

        instanceRepo.touchFetch(auth.instanceId, nowIso)
        try {
            auditRepo.append({
                githubId: null,
                login: 'agent',
                action: 'runtime.fetch',
                projectId: auth.projectId,
                detail: `${pathname} instance:${auth.instanceId}`,
            })
        } catch {
            /* best-effort */
        }

        if (pathname === '/v1/env') {
            if (url.searchParams.get('format') === 'dotenv') {
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', ETag: version })
                return res.end(dotenvStringify(Object.entries(env).map(([key, value]) => ({ key, value }))))
            }
            return send(res, 200, env, { ETag: version })
        }
        if (pathname === '/v1/flags') return send(res, 200, flags, { ETag: version })
        return send(res, 200, { env, flags, version }, { ETag: version })
    }

    return send(res, 404, { error: 'not found' })
}

/** Start the Agent listener once per process (globalThis-cached). */
export function ensureAgentServerStarted(): void {
    if (globalThis.__wharfAgentServer) return
    const server = http.createServer((req, res) => {
        handle(req, res).catch((err) => {
            try {
                send(res, 500, { error: 'internal error' })
            } catch {
                /* response already sent */
            }
            console.error('[wharf] agent request error:', (err as Error).message)
        })
    })
    server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`[wharf] AGENT_PORT ${config.agentPort} in use — agent API not started.`)
        } else {
            console.error('[wharf] agent server error:', err.message)
        }
    })
    server.listen(config.agentPort, config.agentHost, () => {
        console.log(`[wharf] agent API listening on ${config.agentHost}:${config.agentPort}`)
    })
    globalThis.__wharfAgentServer = server
}
