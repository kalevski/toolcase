// nginxpilot integration client — the load-bearing seam Perch drives the deploy
// engine through (§4). Two channels:
//
//   • Channel A (config): write/remove YAML site fragments in the shared `sites.d/`
//     dir and reload the daemon. Fragment *rendering* is the pure, unit-tested
//     `domain/nginxpilot-fragment.ts`; this module owns only the atomic filesystem
//     write and the deterministic, server-generated path (§16).
//   • Channel B (operations): the read/operate REST admin API — `GET /status`,
//     `POST /sync/{domain}`, `GET /vhost/{domain}`, `GET /healthz` — with the
//     optional `Authorization: Bearer` from nginxpilot's `admin.token_env`.
//
// `reload()` is isolated behind one function so M4 can drop the file-drop + sidecar
// fallback the moment nginxpilot ships `POST /reload` (§4, §17).
//
// Server-only. Never import from a client component.

import 'server-only'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { config } from '@/server/config'
import { slog } from '@/server/infrastructure/server-log'
import type { Site } from '@/server/domain/types'
import {
    fragmentFilename,
    renderFragment,
    type FragmentOptions,
} from '@/server/domain/nginxpilot-fragment'

// Re-export the pure fragment surface so callers (the deploy service) reach the
// whole seam through one module.
export {
    renderFragment,
    fragmentFilename,
    tokenEnvVarName,
    formatInterval,
    type FragmentOptions,
    type FragmentAuth,
} from '@/server/domain/nginxpilot-fragment'

export class NginxpilotError extends Error {
    constructor(
        message: string,
        public status?: number,
    ) {
        super(message)
    }
}

// ── Channel A: fragment write / remove (atomic, server-generated path) ─────────

/** Absolute on-disk path of a site's fragment, inside the shared `sites.d/` dir. */
export function fragmentPath(siteId: string): string {
    // `fragmentFilename` validates the id (§16: rejects anything path-unsafe), so
    // the join can never escape `sitesDir`.
    return path.join(config.nginxpilotSitesDir, fragmentFilename(siteId))
}

/**
 * Render a site's fragment and write it into `sites.d/` atomically: write to a
 * sibling temp file, then `rename` over the target (a rename is atomic on the same
 * filesystem, so nginxpilot never reads a half-written fragment). Returns the path.
 * Does NOT reload — the caller pairs this with `reload()`.
 */
export async function writeFragment(site: Site, options: FragmentOptions): Promise<string> {
    const yaml = renderFragment(site, options)
    const dest = fragmentPath(site.id)
    await mkdir(config.nginxpilotSitesDir, { recursive: true })
    const tmp = `${dest}.tmp-${randomBytes(6).toString('hex')}`
    try {
        await writeFile(tmp, yaml, { encoding: 'utf8', mode: 0o644 })
        await rename(tmp, dest)
    } catch (err) {
        await rm(tmp, { force: true }).catch(() => {})
        throw err
    }
    slog('info', 'nginxpilot', 'wrote site fragment', { site: site.id, path: dest })
    return dest
}

/** Delete a site's fragment (idempotent — a missing file is not an error). Does NOT reload. */
export async function removeFragment(siteId: string): Promise<void> {
    const dest = fragmentPath(siteId)
    await rm(dest, { force: true })
    slog('info', 'nginxpilot', 'removed site fragment', { site: siteId, path: dest })
}

// ── Channel B: REST admin API ─────────────────────────────────────────────────

/** One site's status from `GET /status` — mirrors nginxpilot's `manager.SiteStatus`. */
export interface NginxpilotSiteStatus {
    domain: string
    source_type: string
    source_url: string
    /** Currently-deployed git ref; absent before the first successful sync. */
    deployed_ref?: string
    /** ISO timestamp of the last successful sync, if any. */
    last_success?: string
    last_error?: string
    last_error_time?: string
    failure_streak: number
    /** True until the site's first successful sync (then `current` exists and nginx serves). */
    never_synced: boolean
    syncing: boolean
    /** ISO timestamp of the next scheduled poll, if scheduled. */
    next_sync?: string
}

/** The `GET /status` envelope. */
export interface NginxpilotStatus {
    sites: NginxpilotSiteStatus[]
}

/** Auth headers for the admin API — Bearer only when a token is configured. */
function authHeaders(): Record<string, string> {
    return config.nginxpilotAdminToken ? { Authorization: `Bearer ${config.nginxpilotAdminToken}` } : {}
}

/** Low-level admin fetch. Returns the raw `Response` so callers can branch on status. */
async function adminFetch(method: string, apiPath: string, headers: Record<string, string> = {}): Promise<Response> {
    return fetch(`${config.nginxpilotAdminUrl}${apiPath}`, {
        method,
        cache: 'no-store',
        headers: { ...authHeaders(), ...headers },
    })
}

/** Admin fetch that throws `NginxpilotError` on any non-2xx response. */
async function adminOk(method: string, apiPath: string): Promise<Response> {
    const res = await adminFetch(method, apiPath)
    if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new NginxpilotError(
            `nginxpilot ${method} ${apiPath} failed (${res.status})${detail ? `: ${detail.trim()}` : ''}`,
            res.status,
        )
    }
    return res
}

/** Daemon liveness — `GET /healthz` (unauthenticated). True iff it answers 2xx. */
export async function healthz(): Promise<boolean> {
    try {
        const res = await adminFetch('GET', '/healthz')
        return res.ok
    } catch {
        return false
    }
}

/** Per-site status JSON — `GET /status` (§4 Channel B; drives the live UI). */
export async function status(): Promise<NginxpilotStatus> {
    const res = await adminOk('GET', '/status')
    return (await res.json()) as NginxpilotStatus
}

/**
 * Force an immediate sync of one domain — `POST /sync/{domain}` (§9: the first
 * deploy and the "Redeploy" button). The domain is server-held (`site.hostname`),
 * but encode it for the path regardless.
 */
export async function sync(domain: string): Promise<void> {
    await adminOk('POST', `/sync/${encodeURIComponent(domain)}`)
    slog('info', 'nginxpilot', 'forced sync', { domain })
}

/** Render the nginx vhost text for a domain — `GET /vhost/{domain}` (custom-domain path, §10). */
export async function vhost(domain: string): Promise<string> {
    const res = await adminOk('GET', `/vhost/${encodeURIComponent(domain)}`)
    return res.text()
}

// ── reload (isolated fallback — §4, §17) ──────────────────────────────────────

/**
 * Outcome of `reload()`:
 *   • `rest`    — nginxpilot's `POST /reload` handled it (the M4 clean path).
 *   • `sidecar` — `POST /reload` is absent (404/405), so we fell back to the
 *                 file-drop + reload-sidecar. `triggered` is true when the reload
 *                 trigger file was touched; false when no trigger is configured and
 *                 we rely on a path/timer watcher of `sites.d/` alone.
 */
export type ReloadResult = { method: 'rest' } | { method: 'sidecar'; triggered: boolean }

/**
 * Reload nginxpilot so it picks up fragment changes. Tries the REST `POST /reload`
 * first; if that endpoint isn't implemented yet (404/405) it falls back to the
 * file-drop + reload-sidecar path (§4). A real failure (5xx, connection refused)
 * propagates — only "endpoint absent" triggers the fallback. This is the ONE place
 * the fallback lives, so M4 can delete the `else` branch when `POST /reload` lands.
 */
export async function reload(): Promise<ReloadResult> {
    let res: Response
    try {
        res = await adminFetch('POST', '/reload')
    } catch (err) {
        throw new NginxpilotError(`nginxpilot POST /reload unreachable: ${(err as Error).message}`)
    }
    if (res.ok) {
        slog('info', 'nginxpilot', 'reloaded via REST')
        return { method: 'rest' }
    }
    // Endpoint not present yet → fall back. Any other non-2xx is a genuine failure.
    if (res.status !== 404 && res.status !== 405) {
        const detail = await res.text().catch(() => '')
        throw new NginxpilotError(
            `nginxpilot POST /reload failed (${res.status})${detail ? `: ${detail.trim()}` : ''}`,
            res.status,
        )
    }
    return reloadViaSidecar()
}

/**
 * Fallback reload: touch the configured trigger file so a co-located reload-sidecar
 * sends nginxpilot SIGHUP. When no trigger is configured, the fragment file-drop
 * itself is the only signal (a systemd path/timer watcher of `sites.d/` picks it
 * up); we log so the deploy isn't silently slow.
 */
async function reloadViaSidecar(): Promise<ReloadResult> {
    const trigger = config.nginxpilotReloadTrigger
    if (!trigger) {
        slog('warn', 'nginxpilot', 'POST /reload absent and no reload trigger configured — relying on a sites.d watcher')
        return { method: 'sidecar', triggered: false }
    }
    await mkdir(path.dirname(trigger), { recursive: true })
    // Writing a fresh timestamp updates mtime, which is what an inotify/path-unit
    // sidecar watches for.
    await writeFile(trigger, `${new Date().toISOString()}\n`, 'utf8')
    slog('info', 'nginxpilot', 'requested reload via sidecar trigger', { trigger })
    return { method: 'sidecar', triggered: true }
}
