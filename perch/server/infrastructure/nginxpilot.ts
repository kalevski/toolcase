// nginxpilot integration client — the load-bearing seam Perch drives the deploy
// engine through (§4). Perch never touches nginxpilot's filesystem: the entire
// config and every operation go over the loopback/networked REST admin API, so the
// two processes only need to share a network (no shared `sites.d/` volume). Two
// channels, both pure HTTP:
//
//   • Channel A (config): `POST /sites` writes a site's fragment and
//     `DELETE /sites/{domain}` removes it. nginxpilot validates the candidate merged
//     config, writes the fragment under its own deterministic `<domain>.yml`, and
//     reloads — all atomically on its side, so a bad fragment comes back as a `400`
//     and never reaches disk or the running config. Fragment *rendering* is the pure,
//     unit-tested `domain/nginxpilot-fragment.ts`; this module just ships the YAML.
//   • Channel B (operations): the read/operate REST admin API — `GET /status`,
//     `POST /sync/{domain}`, `GET /vhost/{domain}`, `GET /healthz`, `POST /reload` —
//     with the optional `Authorization: Bearer` from nginxpilot's `admin.token_env`.
//
// Server-only. Never import from a client component.

import 'server-only'
import { config } from '@/server/config'
import { slog } from '@/server/infrastructure/server-log'
import type { Site } from '@/server/domain/types'
import { renderFragment, type FragmentOptions } from '@/server/domain/nginxpilot-fragment'
import {
    renderUpstreamFragment,
    renderProxyFragment,
    type Upstream,
    type Proxy,
} from '@/server/domain/routing'

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

// ── low-level admin HTTP ────────────────────────────────────────────────────────

/** Optional request shaping for the admin fetch helpers. */
interface AdminInit {
    body?: string
    headers?: Record<string, string>
}

/** Auth headers for the admin API — Bearer only when a token is configured. */
function authHeaders(): Record<string, string> {
    return config.nginxpilotAdminToken ? { Authorization: `Bearer ${config.nginxpilotAdminToken}` } : {}
}

/** Low-level admin fetch. Returns the raw `Response` so callers can branch on status. */
async function adminFetch(method: string, apiPath: string, init: AdminInit = {}): Promise<Response> {
    return fetch(`${config.nginxpilotAdminUrl}${apiPath}`, {
        method,
        cache: 'no-store',
        headers: { ...authHeaders(), ...(init.headers ?? {}) },
        body: init.body,
    })
}

/** Admin fetch that throws `NginxpilotError` on any non-2xx response. */
async function adminOk(method: string, apiPath: string, init: AdminInit = {}): Promise<Response> {
    const res = await adminFetch(method, apiPath, init)
    if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new NginxpilotError(
            `nginxpilot ${method} ${apiPath} failed (${res.status})${detail ? `: ${detail.trim()}` : ''}`,
            res.status,
        )
    }
    return res
}

// ── Channel A: config over REST (no filesystem) ─────────────────────────────────

/**
 * Render a site's fragment and write it through nginxpilot's `POST /sites` admin
 * endpoint. nginxpilot validates the candidate merged config, writes the fragment
 * under its own deterministic `<domain>.yml`, and reloads — all atomically, so a
 * rejected fragment comes back as a `400` (no disk write, running config untouched).
 * Returns the site's domain (the key `removeFragment` deletes by). The write reloads
 * on nginxpilot's side, so a following `reload()` is an idempotent no-op.
 */
export async function writeFragment(site: Site, options: FragmentOptions): Promise<string> {
    const yaml = renderFragment(site, options)
    await adminOk('POST', '/sites', { body: yaml, headers: { 'Content-Type': 'application/yaml' } })
    slog('info', 'nginxpilot', 'wrote site fragment via API', { site: site.id, domain: site.hostname })
    return site.hostname
}

/**
 * Remove a site's fragment via `DELETE /sites/{domain}` (idempotent — a `404` means
 * the fragment is already gone, which is success). nginxpilot reloads on its side.
 * Keyed on the domain because that is the filename nginxpilot derives the fragment
 * from (`<domain>.yml`), not Perch's internal site id.
 */
export async function removeFragment(domain: string): Promise<void> {
    const res = await adminFetch('DELETE', `/sites/${encodeURIComponent(domain)}`)
    if (!res.ok && res.status !== 404) {
        const detail = await res.text().catch(() => '')
        throw new NginxpilotError(
            `nginxpilot DELETE /sites/${domain} failed (${res.status})${detail ? `: ${detail.trim()}` : ''}`,
            res.status,
        )
    }
    slog('info', 'nginxpilot', 'removed site fragment via API', { domain })
}

// ── Channel A: routing config over REST (upstreams + proxies) ───────────────────
//
// Same two-call shape as sites — `GET` reads the running merged config, `POST`
// writes one entity's fragment (validated + reloaded atomically on nginxpilot's
// side, so a bad fragment is a 400 that never lands), `DELETE` removes it. An
// upstream that is still referenced by a proxy is a 409 on delete — that status is
// preserved so the routing service can surface a precise "still in use" error.

/** Every configured upstream from `GET /upstreams`. */
export async function listUpstreams(): Promise<Upstream[]> {
    const res = await adminOk('GET', '/upstreams')
    return ((await res.json()) as { upstreams?: Upstream[] }).upstreams ?? []
}

/** Write an upstream's fragment via `POST /upstreams` (validated + reloaded daemon-side). */
export async function writeUpstream(upstream: Upstream): Promise<void> {
    const yaml = renderUpstreamFragment(upstream)
    await adminOk('POST', '/upstreams', { body: yaml, headers: { 'Content-Type': 'application/yaml' } })
    slog('info', 'nginxpilot', 'wrote upstream fragment via API', { name: upstream.name })
}

/** Remove an upstream via `DELETE /upstreams/{name}` (404 = already gone → success; 409 = in use). */
export async function removeUpstream(name: string): Promise<void> {
    const res = await adminFetch('DELETE', `/upstreams/${encodeURIComponent(name)}`)
    if (!res.ok && res.status !== 404) {
        const detail = await res.text().catch(() => '')
        throw new NginxpilotError(
            `nginxpilot DELETE /upstreams/${name} failed (${res.status})${detail ? `: ${detail.trim()}` : ''}`,
            res.status,
        )
    }
    slog('info', 'nginxpilot', 'removed upstream fragment via API', { name })
}

/** Every configured reverse proxy from `GET /proxies`. */
export async function listProxies(): Promise<Proxy[]> {
    const res = await adminOk('GET', '/proxies')
    return ((await res.json()) as { proxies?: Proxy[] }).proxies ?? []
}

/** Write a proxy's fragment via `POST /proxies` (validated + reloaded daemon-side). */
export async function writeProxy(proxy: Proxy): Promise<void> {
    const yaml = renderProxyFragment(proxy)
    await adminOk('POST', '/proxies', { body: yaml, headers: { 'Content-Type': 'application/yaml' } })
    slog('info', 'nginxpilot', 'wrote proxy fragment via API', { domain: proxy.domain })
}

/** Remove a proxy via `DELETE /proxies/{domain}` (404 = already gone → success). */
export async function removeProxy(domain: string): Promise<void> {
    const res = await adminFetch('DELETE', `/proxies/${encodeURIComponent(domain)}`)
    if (!res.ok && res.status !== 404) {
        const detail = await res.text().catch(() => '')
        throw new NginxpilotError(
            `nginxpilot DELETE /proxies/${domain} failed (${res.status})${detail ? `: ${detail.trim()}` : ''}`,
            res.status,
        )
    }
    slog('info', 'nginxpilot', 'removed proxy fragment via API', { domain })
}

// ── Channel B: REST admin API (read / operate) ──────────────────────────────────

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
    /**
     * Deployed size of the live release in bytes, when nginxpilot reports it (the
     * §11/§17 cross-repo field that lets Perch enforce byte quotas without shared-FS
     * access). Absent on daemons that predate it — quota enforcement falls back to a
     * `du` sidecar until it lands.
     */
    bytes?: number
}

/** The `GET /status` envelope. */
export interface NginxpilotStatus {
    sites: NginxpilotSiteStatus[]
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

// ── reload ───────────────────────────────────────────────────────────────────────

/** Outcome of `reload()` — always the REST path now that the file-drop fallback is gone. */
export type ReloadResult = { method: 'rest' }

/**
 * Reload nginxpilot via `POST /reload` (diff-based, the REST equivalent of SIGHUP).
 * Channel A writes already reload on nginxpilot's side, so after a write/remove this
 * is an idempotent no-op (an empty diff returns `200`); it stays an explicit step so
 * the deploy machine need not assume that atomicity. A non-2xx (rejected on-disk
 * config, connection refused) is a real failure and propagates.
 */
export async function reload(): Promise<ReloadResult> {
    await adminOk('POST', '/reload')
    slog('info', 'nginxpilot', 'reloaded via REST')
    return { method: 'rest' }
}
