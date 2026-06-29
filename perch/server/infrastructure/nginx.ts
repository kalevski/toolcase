// nginx + certbot + DNS seam for CUSTOM domains (§10, §16). Subdomain sites never
// reach this module — the wildcard `*.basedomain` server block + wildcard TLS already
// cover them with zero nginx work (§4). A custom domain, by contrast, needs its own
// server block and its own cert, so this module owns the raw I/O that path requires:
//
//   • `resolveIpv4`  — authoritative A-record lookup for the "Verify" step (§10).
//   • `installVhost` / `removeVhost` — atomic write/delete of a per-domain vhost in
//     nginx `conf.d/`, at a server-derived path (§16: never user input in the path).
//   • `obtainCert` / `dropCert` — certbot HTTP-01 issue/teardown.
//   • `reload` — reload nginx so an installed/dropped vhost takes effect.
//
// The *policy* (validate → verify → provision → mark live, and teardown) lives in the
// server-only `services/domains.ts`; this module is just the side effects, isolated so
// the service stays testable-by-reading and the shell-outs have one home.
//
// Server-only. Never import from a client component.
// See notes/static-hosting-app-design.md §4, §10, §16.

import 'server-only'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve4 } from 'node:dns/promises'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { config } from '@/server/config'
import { slog } from '@/server/infrastructure/server-log'
import { checkDomain } from '@/server/domain/hostname'

const run = promisify(execFile)

/**
 * Timeouts for the certbot / nginx-reload shell-outs (I2). A stalled certbot HTTP-01
 * challenge or a hung `nginx -s reload` would otherwise block the Node handler
 * indefinitely. `execFile`'s `timeout` kills the child (SIGTERM) past the limit; the
 * resulting error is mapped to `NginxError` (→ 502) by the callers below. Reload is
 * quick (seconds); certbot's ACME round-trip can take longer, hence a larger budget.
 * Both overridable via env.
 */
function envMs(name: string, fallback: number): number {
    const raw = Number(process.env[name])
    return Number.isFinite(raw) && raw > 0 ? raw : fallback
}
const RELOAD_TIMEOUT_MS = envMs('PERCH_NGINX_RELOAD_TIMEOUT_MS', 30_000)
const CERTBOT_TIMEOUT_MS = envMs('PERCH_CERTBOT_TIMEOUT_MS', 120_000)

export class NginxError extends Error {
    constructor(
        message: string,
        public cause?: unknown,
    ) {
        super(message)
        this.name = 'NginxError'
    }
}

// ── DNS (the "Verify" lookup, §10) ─────────────────────────────────────────────

/**
 * Resolve a domain's A-records via the system resolver — the public lookup behind the
 * custom-domain "Verify" action (§10). Returns the IPv4 set, or `[]` for NXDOMAIN /
 * "no A record" / any resolver error, so the caller's verification fails closed (§16)
 * rather than throwing. Uses `resolve4` (a real DNS query), not `lookup` (which would
 * consult the local hosts file) — we want the domain's *published* A record.
 */
export async function resolveIpv4(domain: string): Promise<string[]> {
    try {
        return await resolve4(domain)
    } catch (err) {
        slog('info', 'nginx', 'A-record resolution failed', { domain, error: (err as Error).message })
        return []
    }
}

// ── vhost install / remove (atomic, server-derived path) ───────────────────────

/** Throw unless `domain` is a valid FQDN; returns the normalized form (path-safe). */
function safeDomain(domain: string): string {
    const checked = checkDomain(domain)
    if (!checked.ok) {
        throw new NginxError(`refusing to derive a vhost path from invalid domain ${JSON.stringify(domain)}`)
    }
    return checked.domain
}

/** Absolute path of a custom domain's vhost file, inside the configured `conf.d/`. */
export function vhostPath(domain: string): string {
    // `safeDomain` rejects anything that isn't a clean FQDN (lowercase LDH labels +
    // dots), so the join can never contain a slash or `..` and never escapes confDir.
    return path.join(config.nginxConfDir, `perch-${safeDomain(domain)}.conf`)
}

/**
 * Render-text → atomic write of a custom domain's vhost into nginx `conf.d/`: write a
 * sibling temp file, then `rename` over the target (atomic on one filesystem, so nginx
 * never reads a half-written config). Does NOT reload — the caller pairs this with
 * `reload()`. Returns the path.
 */
export async function installVhost(domain: string, vhost: string): Promise<string> {
    const dest = vhostPath(domain)
    await mkdir(config.nginxConfDir, { recursive: true })
    const tmp = `${dest}.tmp-${randomBytes(6).toString('hex')}`
    try {
        await writeFile(tmp, vhost, { encoding: 'utf8', mode: 0o644 })
        await rename(tmp, dest)
    } catch (err) {
        await rm(tmp, { force: true }).catch(() => {})
        throw err
    }
    slog('info', 'nginx', 'installed custom-domain vhost', { domain, path: dest })
    return dest
}

/** Delete a custom domain's vhost (idempotent — a missing file is not an error). Does NOT reload. */
export async function removeVhost(domain: string): Promise<void> {
    const dest = vhostPath(domain)
    await rm(dest, { force: true })
    slog('info', 'nginx', 'removed custom-domain vhost', { domain, path: dest })
}

// ── nginx reload ───────────────────────────────────────────────────────────────

/** Split a configured command string into an argv (drops empty tokens). */
function argv(cmd: string): string[] {
    return cmd.split(/\s+/).filter(Boolean)
}

/**
 * Reload nginx so an installed/dropped custom-domain vhost takes effect. Runs the
 * configured reload command (`PERCH_NGINX_RELOAD_CMD`, default `nginx -s reload`).
 * Throws `NginxError` on a non-zero exit so the caller can surface the failure.
 */
export async function reload(): Promise<void> {
    const [bin, ...args] = argv(config.nginxReloadCmd)
    if (!bin) throw new NginxError('PERCH_NGINX_RELOAD_CMD is empty')
    try {
        await run(bin, args, { timeout: RELOAD_TIMEOUT_MS })
        slog('info', 'nginx', 'reloaded nginx', { cmd: config.nginxReloadCmd })
    } catch (err) {
        // execFile rejects with `killed: true` + a `signal` when the timeout fires (I2).
        const e = err as NodeJS.ErrnoException & { killed?: boolean; signal?: string }
        const reason = e?.killed && e?.signal ? `timed out after ${RELOAD_TIMEOUT_MS}ms` : e?.message
        throw new NginxError(`nginx reload failed: ${reason}`, err)
    }
}

// ── certbot (HTTP-01) ──────────────────────────────────────────────────────────

/**
 * Obtain (or renew) a cert for a custom domain over the certbot HTTP-01 webroot
 * challenge (§10). Idempotent via `--keep-until-expiring`, non-interactive, and
 * server-derived argv (the domain is validated before it becomes a `-d` arg). Throws
 * `NginxError` on failure so provisioning aborts rather than marking a site live
 * without TLS.
 */
export async function obtainCert(domain: string): Promise<void> {
    const d = safeDomain(domain)
    const args = [
        'certonly',
        '--non-interactive',
        '--agree-tos',
        '--keep-until-expiring',
        '--webroot',
        '-w',
        config.certbotWebroot,
        '-d',
        d,
    ]
    // Register with an email when one is configured; otherwise certbot needs an
    // explicit opt-out flag (acceptable only for lab/dev, hence the warn).
    if (config.certbotEmail) {
        args.push('-m', config.certbotEmail)
    } else {
        args.push('--register-unsafely-without-email')
        slog('warn', 'nginx', 'certbot running without a registration email (set PERCH_CERTBOT_EMAIL)', { domain: d })
    }
    try {
        await run(config.certbotBin, args, { timeout: CERTBOT_TIMEOUT_MS })
        slog('info', 'nginx', 'obtained custom-domain cert', { domain: d })
    } catch (err) {
        // execFile rejects with `killed: true` + a `signal` when the timeout fires (I2).
        const e = err as NodeJS.ErrnoException & { killed?: boolean; signal?: string }
        const reason = e?.killed && e?.signal ? `timed out after ${CERTBOT_TIMEOUT_MS}ms` : e?.message
        throw new NginxError(`certbot failed for ${d}: ${reason}`, err)
    }
}

/** Delete a custom domain's cert (idempotent — a missing cert is not an error). */
export async function dropCert(domain: string): Promise<void> {
    const d = safeDomain(domain)
    try {
        await run(config.certbotBin, ['delete', '--non-interactive', '--cert-name', d], {
            timeout: CERTBOT_TIMEOUT_MS,
        })
        slog('info', 'nginx', 'deleted custom-domain cert', { domain: d })
    } catch (err) {
        // Teardown must not wedge on an already-absent cert; log and move on.
        slog('info', 'nginx', 'certbot delete reported no cert to remove', { domain: d, error: (err as Error).message })
    }
}
