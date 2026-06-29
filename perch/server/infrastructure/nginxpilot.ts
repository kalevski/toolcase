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
// Multiple-realms (multiple_realms.md, Phase A): every call now goes through an
// explicit {@link RealmConnection} via {@link nginxpilotClient}. The module-level
// named exports below are a **back-compat shim** bound to the single env-config
// realm (`config.nginxpilotAdminUrl`/`Token`), so existing callers keep working
// untouched while later phases migrate them to a per-realm client. The shim is
// deleted once every caller passes a client (Phase D/E).
//
// Server-only. Never import from a client component.

import 'server-only'
import { slog } from '@/server/infrastructure/server-log'
import type { Site } from '@/server/domain/types'
import { renderFragment, type FragmentOptions } from '@/server/domain/nginxpilot-fragment'
import {
    renderUpstreamFragment,
    renderProxyFragment,
    type Upstream,
    type Proxy,
} from '@/server/domain/routing'
import {
    renderStreamFragment,
    renderStreamUpstreamFragment,
    type Stream,
    type StreamUpstream,
} from '@/server/domain/streams'

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

/**
 * A resolved connection to ONE nginxpilot instance (a "realm"). The decrypted admin
 * token is a server-only secret — this shape never appears in a DTO sent to the
 * browser (multiple_realms.md §2.4). `adminUrl` is normalized (no trailing `/`);
 * `adminToken` is `''` for an unauthenticated instance.
 */
export interface RealmConnection {
    adminUrl: string
    adminToken: string
}

// ── Channel B types (read / operate) ────────────────────────────────────────────

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

/**
 * One managed-mode resource as nginxpilot reports it under `status.nginx.resources`
 * (and in the `POST /nginx/test` dry-run): a fragment plus the verdict of the last
 * `nginx -t` gate. A `disabled` resource was quarantined (its candidate config failed
 * validation) and is NOT serving; `reason` carries the daemon's `nginx -t` output.
 * `kind` is the resource family, `key` the domain (sites/proxies) or name (everything
 * else) — the same keying Perch uses to match a resource back to one of its entities.
 */
export interface NginxResource {
    kind: 'site' | 'proxy' | 'upstream' | 'stream' | 'stream-upstream'
    key: string
    file?: string
    state: 'active' | 'disabled'
    reason?: string
}

/** The `status.nginx` object — present only when the daemon runs in managed mode (§0). */
export interface NginxManaged {
    managed: boolean
    resources: NginxResource[]
    disabled_count: number
}

/** The `GET /status` envelope. `nginx` is present only in managed mode. */
export interface NginxpilotStatus {
    sites: NginxpilotSiteStatus[]
    nginx?: NginxManaged
}

/** The `POST /nginx/test` dry-run envelope — per-resource pass/fail plus an optional top-level error. */
export interface NginxTestResult {
    resources: NginxResource[]
    error?: string
}

/**
 * One TLS certificate from `GET /certs` — mirrors nginxpilot's `admin.certInfo`.
 * Read-only discovery: file paths plus parsed leaf metadata, NEVER key material
 * (the privkey *path* is exposed, never its bytes). The parsed fields are
 * best-effort — `not_before`/`not_after`/`issuer` are absent when nginxpilot
 * couldn't parse the leaf cert (`names` is then empty too).
 */
export interface NginxpilotCert {
    /** The index key — the cert directory / file-name stem nginxpilot discovered it under. */
    domain: string
    /** Leaf-cert SAN DNS names (lowercased); empty when the cert couldn't be parsed. */
    names: string[]
    cert_path: string
    key_path: string
    /** ISO timestamp of the key file's mtime (changes on renewal). */
    mod_time: string
    /** ISO validity window; absent when the cert couldn't be parsed. */
    not_before?: string
    not_after?: string
    /** Issuer CN (or full DN when no CN); absent when the cert couldn't be parsed. */
    issuer?: string
}

/** Outcome of `reload()` — always the REST path now that the file-drop fallback is gone. */
export type ReloadResult = { method: 'rest' }

// ── the client factory ───────────────────────────────────────────────────────────

/** Optional request shaping for the admin fetch helpers. */
interface AdminInit {
    body?: string
    headers?: Record<string, string>
}

/**
 * Per-request timeout for nginxpilot admin calls (I2). A hung daemon would otherwise
 * block the Node handler indefinitely (the client `apiFetch` aborts at 10s, but the
 * server-side work continues), exhausting request workers under load. Overridable via
 * `PERCH_NGINXPILOT_TIMEOUT_MS`. An abort surfaces as a `NginxpilotError` (→ 502).
 */
const ADMIN_FETCH_TIMEOUT_MS = (() => {
    const raw = Number(process.env.PERCH_NGINXPILOT_TIMEOUT_MS)
    return Number.isFinite(raw) && raw > 0 ? raw : 15_000
})()

/**
 * Build a client bound to ONE nginxpilot instance (multiple_realms.md Phase A). Every
 * method closes over `conn`, so the same surface targets whichever realm the caller
 * resolved. The returned object exposes the full admin API — config writes (Channel A)
 * and read/operate calls (Channel B) — exactly as the former module-level functions did.
 */
export function nginxpilotClient(conn: RealmConnection) {
    /** Auth headers for the admin API — Bearer only when a token is configured. */
    function authHeaders(): Record<string, string> {
        return conn.adminToken ? { Authorization: `Bearer ${conn.adminToken}` } : {}
    }

    /**
     * Low-level admin fetch. Returns the raw `Response` so callers can branch on status.
     * Bounded by `ADMIN_FETCH_TIMEOUT_MS` via `AbortSignal.timeout` (I2): a stalled daemon
     * aborts the request rather than wedging the handler. The abort is mapped to a
     * `NginxpilotError` (→ 502) so it slots into the existing error handling.
     */
    async function adminFetch(
        method: string,
        apiPath: string,
        init: AdminInit = {},
    ): Promise<Response> {
        try {
            return await fetch(`${conn.adminUrl}${apiPath}`, {
                method,
                cache: 'no-store',
                headers: { ...authHeaders(), ...(init.headers ?? {}) },
                body: init.body,
                signal: AbortSignal.timeout(ADMIN_FETCH_TIMEOUT_MS),
            })
        } catch (err) {
            const e = err as Error
            if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
                throw new NginxpilotError(
                    `nginxpilot ${method} ${apiPath} timed out after ${ADMIN_FETCH_TIMEOUT_MS}ms`,
                    504,
                )
            }
            // A connection-refused / DNS failure is a transport error → 502 via NginxpilotError.
            throw new NginxpilotError(`nginxpilot ${method} ${apiPath} failed: ${e?.message ?? 'network error'}`)
        }
    }

    /** Admin fetch that throws `NginxpilotError` on any non-2xx response. */
    async function adminOk(
        method: string,
        apiPath: string,
        init: AdminInit = {},
    ): Promise<Response> {
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

    // ── Channel A: config over REST (no filesystem) ─────────────────────────────

    /**
     * Render a site's fragment and write it through nginxpilot's `POST /sites` admin
     * endpoint. nginxpilot validates the candidate merged config, writes the fragment
     * under its own deterministic `<domain>.yml`, and reloads — all atomically, so a
     * rejected fragment comes back as a `400` (no disk write, running config untouched).
     * Returns the site's domain (the key `removeFragment` deletes by). The write reloads
     * on nginxpilot's side, so a following `reload()` is an idempotent no-op.
     */
    async function writeFragment(site: Site, options: FragmentOptions): Promise<string> {
        const yaml = renderFragment(site, options)
        await adminOk('POST', '/sites', {
            body: yaml,
            headers: { 'Content-Type': 'application/yaml' },
        })
        slog('info', 'nginxpilot', 'wrote site fragment via API', {
            site: site.id,
            domain: site.hostname,
        })
        return site.hostname
    }

    /**
     * Remove a site's fragment via `DELETE /sites/{domain}` (idempotent — a `404` means
     * the fragment is already gone, which is success). nginxpilot reloads on its side.
     * Keyed on the domain because that is the filename nginxpilot derives the fragment
     * from (`<domain>.yml`), not Perch's internal site id.
     */
    async function removeFragment(domain: string): Promise<void> {
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

    // ── Channel A: routing config over REST (upstreams + proxies) ───────────────

    /** Every configured upstream from `GET /upstreams`. */
    async function listUpstreams(): Promise<Upstream[]> {
        const res = await adminOk('GET', '/upstreams')
        return ((await res.json()) as { upstreams?: Upstream[] }).upstreams ?? []
    }

    /** Write an upstream's fragment via `POST /upstreams` (validated + reloaded daemon-side). */
    async function writeUpstream(upstream: Upstream): Promise<void> {
        const yaml = renderUpstreamFragment(upstream)
        await adminOk('POST', '/upstreams', {
            body: yaml,
            headers: { 'Content-Type': 'application/yaml' },
        })
        slog('info', 'nginxpilot', 'wrote upstream fragment via API', { name: upstream.name })
    }

    /** Remove an upstream via `DELETE /upstreams/{name}` (404 = already gone → success; 409 = in use). */
    async function removeUpstream(name: string): Promise<void> {
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
    async function listProxies(): Promise<Proxy[]> {
        const res = await adminOk('GET', '/proxies')
        return ((await res.json()) as { proxies?: Proxy[] }).proxies ?? []
    }

    /** Write a proxy's fragment via `POST /proxies` (validated + reloaded daemon-side). */
    async function writeProxy(proxy: Proxy): Promise<void> {
        const yaml = renderProxyFragment(proxy)
        await adminOk('POST', '/proxies', {
            body: yaml,
            headers: { 'Content-Type': 'application/yaml' },
        })
        slog('info', 'nginxpilot', 'wrote proxy fragment via API', { domain: proxy.domain })
    }

    /** Remove a proxy via `DELETE /proxies/{domain}` (404 = already gone → success). */
    async function removeProxy(domain: string): Promise<void> {
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

    // ── Channel A: L4 stream config over REST (streams + stream-upstreams) ──────

    /** Every configured stream from `GET /streams`. */
    async function listStreams(): Promise<Stream[]> {
        const res = await adminOk('GET', '/streams')
        return ((await res.json()) as { streams?: Stream[] }).streams ?? []
    }

    /** Write a stream's fragment via `POST /streams` (validated + reloaded daemon-side). */
    async function writeStream(stream: Stream): Promise<void> {
        const yaml = renderStreamFragment(stream)
        await adminOk('POST', '/streams', {
            body: yaml,
            headers: { 'Content-Type': 'application/yaml' },
        })
        slog('info', 'nginxpilot', 'wrote stream fragment via API', { name: stream.name })
    }

    /** Remove a stream via `DELETE /streams/{name}` (404 = already gone → success). */
    async function removeStream(name: string): Promise<void> {
        const res = await adminFetch('DELETE', `/streams/${encodeURIComponent(name)}`)
        if (!res.ok && res.status !== 404) {
            const detail = await res.text().catch(() => '')
            throw new NginxpilotError(
                `nginxpilot DELETE /streams/${name} failed (${res.status})${detail ? `: ${detail.trim()}` : ''}`,
                res.status,
            )
        }
        slog('info', 'nginxpilot', 'removed stream fragment via API', { name })
    }

    /** Every configured stream upstream from `GET /stream-upstreams`. */
    async function listStreamUpstreams(): Promise<StreamUpstream[]> {
        const res = await adminOk('GET', '/stream-upstreams')
        return (
            ((await res.json()) as { stream_upstreams?: StreamUpstream[] }).stream_upstreams ?? []
        )
    }

    /** Write a stream upstream's fragment via `POST /stream-upstreams` (validated + reloaded daemon-side). */
    async function writeStreamUpstream(upstream: StreamUpstream): Promise<void> {
        const yaml = renderStreamUpstreamFragment(upstream)
        await adminOk('POST', '/stream-upstreams', {
            body: yaml,
            headers: { 'Content-Type': 'application/yaml' },
        })
        slog('info', 'nginxpilot', 'wrote stream upstream fragment via API', {
            name: upstream.name,
        })
    }

    /** Remove a stream upstream via `DELETE /stream-upstreams/{name}` (404 = gone → success; 409 = in use). */
    async function removeStreamUpstream(name: string): Promise<void> {
        const res = await adminFetch('DELETE', `/stream-upstreams/${encodeURIComponent(name)}`)
        if (!res.ok && res.status !== 404) {
            const detail = await res.text().catch(() => '')
            throw new NginxpilotError(
                `nginxpilot DELETE /stream-upstreams/${name} failed (${res.status})${detail ? `: ${detail.trim()}` : ''}`,
                res.status,
            )
        }
        slog('info', 'nginxpilot', 'removed stream upstream fragment via API', { name })
    }

    // ── Channel B: REST admin API (read / operate) ──────────────────────────────

    /** Daemon liveness — `GET /healthz` (unauthenticated). True iff it answers 2xx. */
    async function healthz(): Promise<boolean> {
        try {
            const res = await adminFetch('GET', '/healthz')
            return res.ok
        } catch {
            return false
        }
    }

    /** Per-site status JSON — `GET /status` (§4 Channel B; drives the live UI). */
    async function status(): Promise<NginxpilotStatus> {
        const res = await adminOk('GET', '/status')
        return (await res.json()) as NginxpilotStatus
    }

    /**
     * Managed-mode dry run — `POST /nginx/test`. Returns the per-resource pass/fail set
     * the daemon would apply, WITHOUT committing it, so a maintainer can preview a batch
     * before trusting the live apply (Phase E). Returns `null` when managed mode is off
     * (the daemon answers `501`); any other non-2xx is a real failure that propagates.
     */
    async function nginxTest(): Promise<NginxTestResult | null> {
        const res = await adminFetch('POST', '/nginx/test')
        if (res.status === 501) return null
        if (!res.ok) {
            const detail = await res.text().catch(() => '')
            throw new NginxpilotError(
                `nginxpilot POST /nginx/test failed (${res.status})${detail ? `: ${detail.trim()}` : ''}`,
                res.status,
            )
        }
        return (await res.json()) as NginxTestResult
    }

    /**
     * Force an immediate sync of one domain — `POST /sync/{domain}` (§9: the first
     * deploy and the "Redeploy" button). The domain is server-held (`site.hostname`),
     * but encode it for the path regardless.
     */
    async function sync(domain: string): Promise<void> {
        await adminOk('POST', `/sync/${encodeURIComponent(domain)}`)
        slog('info', 'nginxpilot', 'forced sync', { domain })
    }

    /** Render the nginx vhost text for a domain — `GET /vhost/{domain}` (custom-domain path, §10). */
    async function vhost(domain: string): Promise<string> {
        const res = await adminOk('GET', `/vhost/${encodeURIComponent(domain)}`)
        return res.text()
    }

    /**
     * Every TLS certificate nginxpilot discovered in its cert dir — `GET /certs`
     * (read-only; drives the admin Certificates page). Metadata only — no key
     * material crosses the wire. An unconfigured/missing cert dir answers `200`
     * with an empty list, so this never throws for "no certs", only for transport
     * or auth failures.
     */
    async function listCertificates(): Promise<NginxpilotCert[]> {
        const res = await adminOk('GET', '/certs')
        return ((await res.json()) as { certs?: NginxpilotCert[] }).certs ?? []
    }

    /**
     * Reload nginxpilot via `POST /reload` (diff-based, the REST equivalent of SIGHUP).
     * Channel A writes already reload on nginxpilot's side, so after a write/remove this
     * is an idempotent no-op (an empty diff returns `200`); it stays an explicit step so
     * the deploy machine need not assume that atomicity. A non-2xx (rejected on-disk
     * config, connection refused) is a real failure and propagates.
     */
    async function reload(): Promise<ReloadResult> {
        await adminOk('POST', '/reload')
        slog('info', 'nginxpilot', 'reloaded via REST')
        return { method: 'rest' }
    }

    return {
        writeFragment,
        removeFragment,
        listUpstreams,
        writeUpstream,
        removeUpstream,
        listProxies,
        writeProxy,
        removeProxy,
        listStreams,
        writeStream,
        removeStream,
        listStreamUpstreams,
        writeStreamUpstream,
        removeStreamUpstream,
        healthz,
        status,
        nginxTest,
        sync,
        vhost,
        listCertificates,
        reload,
    }
}

/** The full per-realm admin surface (every method closes over a {@link RealmConnection}). */
export type NginxpilotClient = ReturnType<typeof nginxpilotClient>

// The Phase-A back-compat shim (env-config-bound module-level functions) is gone: every
// caller now resolves a per-site / per-realm / active-realm client through
// `services/realms.ts` (multiple_realms.md Phase D/E). The env config is consumed only by
// `realms.ensureSeed`, which registers it as the default realm.
