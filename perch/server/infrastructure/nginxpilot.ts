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
    renderRedirectFragment,
    renderDeadHostFragment,
    type Upstream,
    type Proxy,
    type Redirect,
    type DeadHost,
} from '@/server/domain/routing'
import { renderAccessListFragment, type AccessList } from '@/server/domain/access-list'
import {
    renderStreamFragment,
    renderStreamUpstreamFragment,
    type Stream,
    type StreamUpstream,
} from '@/server/domain/streams'
import type { AcmeCredentialRequest } from '@/server/domain/cert-input'

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
        /**
         * The trimmed response body for a non-2xx admin reply, when there is one. For the
         * cert/ACME write endpoints this carries the daemon's operator-facing reason (a
         * certbot error, "acme is not enabled", a bad-PEM message) which `services/certs.ts`
         * forwards to the owner — far more useful than a bare status. Never set for transport
         * failures (timeout / connection refused).
         */
        public detail?: string,
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
    /** nginxctl resource kinds — note `dead-host` is hyphenated in /status (unlike the fragment kind). */
    kind: 'site' | 'proxy' | 'upstream' | 'stream' | 'stream-upstream' | 'redirect' | 'dead-host'
    key: string
    file?: string
    state: 'active' | 'disabled' | 'at_risk'
    reason?: string
    /** ISO timestamp the reconcile loop first saw this resource failing (at_risk/disabled). */
    since?: string
    /** ISO timestamp of the reconcile tick that last evaluated this resource. */
    last_reconcile?: string
}

/**
 * The reconcile-loop summary under `status.nginx.reconcile` — the daemon's periodic
 * dry-run that detects live-but-would-fail resources (`at_risk`, policy `warn`) or
 * disables them (policy `disable`). `interval` / `last_run` are the loop's cadence.
 */
export interface NginxReconcileSummary {
    enabled: boolean
    interval: string
    on_failure: string
    last_run?: string
    at_risk_count: number
}

/**
 * The real-IP refresh summary under `status.nginx.real_ip` (C2): whether the
 * daemon restores client IPs behind a CDN, which provider ranges are in effect,
 * and when they were last refreshed. Config-file-owned on the daemon (`nginx.
 * real_ip`) — Perch surfaces it read-only.
 */
export interface NginxRealIPStatus {
    enabled: boolean
    header: string
    recursive: boolean
    providers: string[]
    static_count: number
    range_count: number
    last_refresh?: string
    last_error?: string
}

/** The `status.nginx` object — present only when the daemon runs in managed mode (§0). */
export interface NginxManaged {
    managed: boolean
    resources: NginxResource[]
    disabled_count: number
    at_risk_count: number
    reconcile?: NginxReconcileSummary
    real_ip?: NginxRealIPStatus
}

/**
 * The renewal-scheduler summary under `status.certs_renewal` — present whether or not
 * acme is enabled, so a control plane can tell "disabled" from "daemon predates it".
 * `check_interval` / `renew_before` are Go duration strings ("12h0m0s").
 */
export interface CertsRenewalStatus {
    enabled: boolean
    check_interval: string
    renew_before: string
    next_check?: string
}

/** The `GET /status` envelope. `nginx` is present only in managed mode. */
export interface NginxpilotStatus {
    sites: NginxpilotSiteStatus[]
    nginx?: NginxManaged
    certs_renewal?: CertsRenewalStatus
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
    /** Seconds until `not_after`, computed daemon-side at read time (negative = expired). */
    expires_in_seconds?: number
    /**
     * Whether the renewal scheduler can renew this cert itself (a certbot `live/` dir
     * exists). `false` = a manually-uploaded flat pair the operator must re-upload.
     */
    renew_managed: boolean
    /** ISO timestamp of the scheduler's last successful renewal of this cert. */
    last_renew_time?: string
    /** The scheduler's last renewal failure for this cert (sticky until a success). */
    last_renew_error?: string
}

/**
 * One stored ACME DNS-provider credential as `GET /acme/credentials` reports it — mirrors
 * nginxpilot's `credstore.Info`. Metadata ONLY: the secret material (token / key / JSON) is
 * never returned by the daemon and never crosses this wire. `mechanism` is how certbot consumes
 * it (`flag` = `--dns-<provider>-credentials`, `aws-file` = `AWS_SHARED_CREDENTIALS_FILE`,
 * `google` = `GOOGLE_APPLICATION_CREDENTIALS`).
 */
export interface AcmeCredentialInfo {
    provider: string
    mechanism: string
    /** ISO timestamp of the artifact's mtime (changes when the credential is replaced). */
    mod_time: string
}

/** Lifecycle of an async certbot issuance (`POST /certs` → `GET /certs/jobs/{id}`). */
export type CertJobState = 'pending' | 'running' | 'succeeded' | 'failed'

/**
 * `POST /certs` is ASYNC (202): certbot runs off the request path on the daemon, so the call
 * returns a tracking job id immediately instead of blocking for minutes. Poll
 * {@link nginxpilotClient.getCertJob} (`GET /certs/jobs/{id}`) until the job is terminal.
 */
export interface CertIssueAccepted {
    status: string // "accepted"
    job_id: string
    state: CertJobState
    cert_name: string
    domains: string[]
}

/** One async issuance job as `GET /certs/jobs/{id}` reports it. Jobs are ephemeral on the daemon. */
export interface CertJob {
    id: string
    state: CertJobState
    cert_name: string
    domains: string[]
    staging: boolean
    /** The certbot failure reason — set when `state === 'failed'`. */
    error?: string
    /** The freshly-loaded issued cert — set when `state === 'succeeded'` (best-effort, may be null). */
    cert?: NginxpilotCert | null
    created_at: string
    updated_at: string
}

/** `PUT /certs/{domain}` result — whether the manual pair replaced an existing one, plus its `certInfo`. */
export interface CertUploadResult {
    status: 'created' | 'replaced'
    domain: string
    cert: NginxpilotCert | null
}

/** `PUT /acme/credentials/{provider}` result — created vs replaced, plus the resolved mechanism. */
export interface AcmeCredentialResult {
    status: 'created' | 'replaced'
    provider: string
    mechanism: string
}

/** Outcome of `reload()` — always the REST path now that the file-drop fallback is gone. */
export type ReloadResult = { method: 'rest' }

/**
 * Outcome of a routing-resource write (`POST /proxies|/upstreams|/streams|…`). The
 * daemon answers plain text (`created`/`updated`) on a clean write, but switches to
 * JSON `{status, warnings}` when its three-tier target checks produced advisory
 * warnings (an unreachable backend, a DNS hiccup under `dns: warn`). Warnings never
 * block the write — the fragment IS live; they exist to be surfaced to the operator.
 */
export interface WriteResult {
    status: string
    warnings: string[]
}

/**
 * Per-write options. `skipTargetChecks` appends `?skip_target_checks=true` — the
 * daemon's own bootstrap escape hatch for a target host whose DNS record lands later
 * (an unresolvable host under `dns: error` is otherwise a 400).
 */
export interface WriteOptions {
    skipTargetChecks?: boolean
}

// ── the client factory ───────────────────────────────────────────────────────────

/** Optional request shaping for the admin fetch helpers. */
interface AdminInit {
    body?: string
    headers?: Record<string, string>
    /**
     * Per-call abort budget, overriding `ADMIN_FETCH_TIMEOUT_MS`. Set for the certbot-backed
     * cert ops (issue/renew), which the daemon runs synchronously and can take minutes
     * (DNS-01 propagation wait + buffer); the default 15s budget aborts those mid-run, which
     * surfaces as a detail-less `504`→`nginxpilot_error` long before certbot finishes.
     */
    timeoutMs?: number
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
 * Longer abort budget for the certbot-backed cert ops (issue / renew). The daemon runs
 * certbot synchronously and blocks until it returns; a DNS-01 issue waits for record
 * propagation (`acme.dns.propagation_seconds`, default 60s) plus a buffer — the daemon's
 * own ceiling is ~180s. Perch must wait LONGER than the daemon, or it aborts the request
 * mid-run and reports a detail-less `nginxpilot_error` while certbot is still working.
 * Default 300s; override via `PERCH_NGINXPILOT_CERT_TIMEOUT_MS`.
 */
const CERT_OP_TIMEOUT_MS = (() => {
    const raw = Number(process.env.PERCH_NGINXPILOT_CERT_TIMEOUT_MS)
    return Number.isFinite(raw) && raw > 0 ? raw : 300_000
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
        const timeoutMs = init.timeoutMs ?? ADMIN_FETCH_TIMEOUT_MS
        try {
            return await fetch(`${conn.adminUrl}${apiPath}`, {
                method,
                cache: 'no-store',
                headers: { ...authHeaders(), ...(init.headers ?? {}) },
                body: init.body,
                signal: AbortSignal.timeout(timeoutMs),
            })
        } catch (err) {
            const e = err as Error
            if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
                throw new NginxpilotError(
                    `nginxpilot ${method} ${apiPath} timed out after ${timeoutMs}ms`,
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
            const detail = (await res.text().catch(() => '')).trim()
            throw new NginxpilotError(
                `nginxpilot ${method} ${apiPath} failed (${res.status})${detail ? `: ${detail}` : ''}`,
                res.status,
                detail || undefined,
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

    /**
     * POST one routing fragment and normalize the daemon's two success shapes into a
     * {@link WriteResult}: plain text (`created`/`updated`, no warnings) or JSON
     * `{status, warnings}` when target checks flagged something advisory. A rejected
     * fragment is still a thrown `NginxpilotError` (400, `.detail` = the daemon's
     * reason — including the `?skip_target_checks=true` hint for a DNS failure).
     */
    async function writeRoutingFragment(
        apiPath: string,
        yaml: string,
        opts?: WriteOptions,
    ): Promise<WriteResult> {
        const query = opts?.skipTargetChecks ? '?skip_target_checks=true' : ''
        const res = await adminOk('POST', `${apiPath}${query}`, {
            body: yaml,
            headers: { 'Content-Type': 'application/yaml' },
        })
        if ((res.headers.get('content-type') ?? '').includes('application/json')) {
            const body = (await res.json()) as { status?: string; warnings?: string[] }
            return { status: body.status ?? 'created', warnings: body.warnings ?? [] }
        }
        return { status: (await res.text()).trim() || 'created', warnings: [] }
    }

    /** Every configured upstream from `GET /upstreams`. */
    async function listUpstreams(): Promise<Upstream[]> {
        const res = await adminOk('GET', '/upstreams')
        return ((await res.json()) as { upstreams?: Upstream[] }).upstreams ?? []
    }

    /** Write an upstream's fragment via `POST /upstreams` (validated + reloaded daemon-side). */
    async function writeUpstream(upstream: Upstream, opts?: WriteOptions): Promise<WriteResult> {
        const result = await writeRoutingFragment('/upstreams', renderUpstreamFragment(upstream), opts)
        slog('info', 'nginxpilot', 'wrote upstream fragment via API', { name: upstream.name })
        return result
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
    async function writeProxy(proxy: Proxy, opts?: WriteOptions): Promise<WriteResult> {
        const result = await writeRoutingFragment('/proxies', renderProxyFragment(proxy), opts)
        slog('info', 'nginxpilot', 'wrote proxy fragment via API', { domain: proxy.domain })
        return result
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

    // ── Channel A: redirect + dead-host config over REST (better.md §3) ─────────

    /** Every configured redirection host from `GET /redirects`. */
    async function listRedirects(): Promise<Redirect[]> {
        const res = await adminOk('GET', '/redirects')
        return ((await res.json()) as { redirects?: Redirect[] }).redirects ?? []
    }

    /** Write a redirect's fragment via `POST /redirects` (validated + reloaded daemon-side). */
    async function writeRedirect(redirect: Redirect, opts?: WriteOptions): Promise<WriteResult> {
        const result = await writeRoutingFragment('/redirects', renderRedirectFragment(redirect), opts)
        slog('info', 'nginxpilot', 'wrote redirect fragment via API', { domain: redirect.domain })
        return result
    }

    /** Remove a redirect via `DELETE /redirects/{domain}` (404 = already gone → success). */
    async function removeRedirect(domain: string): Promise<void> {
        const res = await adminFetch('DELETE', `/redirects/${encodeURIComponent(domain)}`)
        if (!res.ok && res.status !== 404) {
            const detail = await res.text().catch(() => '')
            throw new NginxpilotError(
                `nginxpilot DELETE /redirects/${domain} failed (${res.status})${detail ? `: ${detail.trim()}` : ''}`,
                res.status,
            )
        }
        slog('info', 'nginxpilot', 'removed redirect fragment via API', { domain })
    }

    /** Every configured dead (parked) host from `GET /dead-hosts`. */
    async function listDeadHosts(): Promise<DeadHost[]> {
        const res = await adminOk('GET', '/dead-hosts')
        return ((await res.json()) as { dead_hosts?: DeadHost[] }).dead_hosts ?? []
    }

    /** Write a dead host's fragment via `POST /dead-hosts` (validated + reloaded daemon-side). */
    async function writeDeadHost(deadHost: DeadHost, opts?: WriteOptions): Promise<WriteResult> {
        const result = await writeRoutingFragment('/dead-hosts', renderDeadHostFragment(deadHost), opts)
        slog('info', 'nginxpilot', 'wrote dead-host fragment via API', { domain: deadHost.domain })
        return result
    }

    /** Remove a dead host via `DELETE /dead-hosts/{domain}` (404 = already gone → success). */
    async function removeDeadHost(domain: string): Promise<void> {
        const res = await adminFetch('DELETE', `/dead-hosts/${encodeURIComponent(domain)}`)
        if (!res.ok && res.status !== 404) {
            const detail = await res.text().catch(() => '')
            throw new NginxpilotError(
                `nginxpilot DELETE /dead-hosts/${domain} failed (${res.status})${detail ? `: ${detail.trim()}` : ''}`,
                res.status,
            )
        }
        slog('info', 'nginxpilot', 'removed dead-host fragment via API', { domain })
    }

    // ── Channel A: access lists over REST (better.md §1 / C1) ───────────────────

    /** Every configured access list from `GET /access-lists` (hashes masked daemon-side). */
    async function listAccessLists(): Promise<AccessList[]> {
        const res = await adminOk('GET', '/access-lists')
        return ((await res.json()) as { access_lists?: AccessList[] }).access_lists ?? []
    }

    /**
     * Write an access list's fragment via `POST /access-lists`. The fragment carries
     * usernames only — the daemon merges existing password hashes forward on a
     * replace-by-name write, so an edit never wipes passwords.
     */
    async function writeAccessList(list: AccessList, opts?: WriteOptions): Promise<WriteResult> {
        const result = await writeRoutingFragment('/access-lists', renderAccessListFragment(list), opts)
        slog('info', 'nginxpilot', 'wrote access-list fragment via API', { name: list.name })
        return result
    }

    /** Remove an access list via `DELETE /access-lists/{name}` (404 = gone → success; 409 = referenced). */
    async function removeAccessList(name: string): Promise<void> {
        const res = await adminFetch('DELETE', `/access-lists/${encodeURIComponent(name)}`)
        if (!res.ok && res.status !== 404) {
            const detail = await res.text().catch(() => '')
            throw new NginxpilotError(
                `nginxpilot DELETE /access-lists/${name} failed (${res.status})${detail ? `: ${detail.trim()}` : ''}`,
                res.status,
                detail || undefined,
            )
        }
        slog('info', 'nginxpilot', 'removed access-list fragment via API', { name })
    }

    /**
     * (Re)set one user's password — `PUT /access-lists/{name}/users/{username}`.
     * Plaintext goes ONLY here; the daemon hashes it (apr1) server-side. The
     * password is never logged.
     */
    async function setAccessListPassword(name: string, username: string, password: string): Promise<void> {
        await adminOk(
            'PUT',
            `/access-lists/${encodeURIComponent(name)}/users/${encodeURIComponent(username)}`,
            {
                body: JSON.stringify({ password }),
                headers: { 'Content-Type': 'application/json' },
            },
        )
        slog('info', 'nginxpilot', 'set access-list user password via API', { name, username })
    }

    // ── Channel A: L4 stream config over REST (streams + stream-upstreams) ──────

    /** Every configured stream from `GET /streams`. */
    async function listStreams(): Promise<Stream[]> {
        const res = await adminOk('GET', '/streams')
        return ((await res.json()) as { streams?: Stream[] }).streams ?? []
    }

    /** Write a stream's fragment via `POST /streams` (validated + reloaded daemon-side). */
    async function writeStream(stream: Stream, opts?: WriteOptions): Promise<WriteResult> {
        const result = await writeRoutingFragment('/streams', renderStreamFragment(stream), opts)
        slog('info', 'nginxpilot', 'wrote stream fragment via API', { name: stream.name })
        return result
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
    async function writeStreamUpstream(
        upstream: StreamUpstream,
        opts?: WriteOptions,
    ): Promise<WriteResult> {
        const result = await writeRoutingFragment(
            '/stream-upstreams',
            renderStreamUpstreamFragment(upstream),
            opts,
        )
        slog('info', 'nginxpilot', 'wrote stream upstream fragment via API', {
            name: upstream.name,
        })
        return result
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
     * The daemon's self-describing OpenAPI document, reduced to what capability
     * detection needs — `GET /schema` (impl §6). A daemon-side test guarantees the
     * document never drifts from the real route table, so "path present" == "endpoint
     * exists". Throws (via adminOk) on an older daemon without the endpoint — callers
     * treat that as "capabilities unknown", never as "no capabilities".
     */
    async function schema(): Promise<{ version: string | null; paths: string[] }> {
        const res = await adminOk('GET', '/schema')
        const doc = (await res.json()) as { info?: { version?: string }; paths?: Record<string, unknown> }
        return { version: doc.info?.version ?? null, paths: Object.keys(doc.paths ?? {}) }
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

    // ── Channel A: certificate lifecycle over REST (issue / upload / renew / delete) ──────
    // certbot-driven issuance + manual bring-your-own upload (cert_feature.md). All write
    // endpoints; a non-2xx propagates as `NginxpilotError` carrying the daemon's reason in
    // `.detail` (501 = acme/cert-dir not enabled, 400 = bad input, 502 = certbot failure) so
    // `services/certs.ts` can forward an operator-useful message.

    /**
     * Start a certbot issuance — `POST /certs`. `domains` may include ONE leading-wildcard entry
     * (only valid when the daemon's `acme.challenge` is `dns`; the daemon rejects otherwise).
     * ASYNC: the daemon runs certbot off the request path and replies `202` immediately with a
     * tracking job id — no long-held connection. Poll {@link getCertJob} until the job is terminal.
     * Synchronous validation errors still come back here (`501` = `acme.enabled: false`, `400` =
     * bad input). The default fetch budget is fine since the reply is instant.
     */
    async function issueCertificate(req: {
        domains: string[]
        certName?: string
        staging?: boolean
        /** Per-issue ACME-account email override (omit → daemon's acme.email). */
        email?: string
        /** Per-issue DNS provider override (omit → daemon's acme.dns.provider). */
        provider?: string
    }): Promise<CertIssueAccepted> {
        const res = await adminOk('POST', '/certs', {
            body: JSON.stringify({
                domains: req.domains,
                cert_name: req.certName,
                email: req.email,
                provider: req.provider,
                staging: req.staging ?? false,
            }),
            headers: { 'Content-Type': 'application/json' },
        })
        const accepted = (await res.json()) as CertIssueAccepted
        slog('info', 'nginxpilot', 'started certificate issuance via API', {
            domains: req.domains,
            job: accepted.job_id,
        })
        return accepted
    }

    /** Poll one async issuance job — `GET /certs/jobs/{id}`. `404` (unknown/pruned job) → `NginxpilotError`. */
    async function getCertJob(id: string): Promise<CertJob> {
        const res = await adminOk('GET', `/certs/jobs/${encodeURIComponent(id)}`)
        return (await res.json()) as CertJob
    }

    /**
     * Every tracked async issuance job, newest first — `GET /certs/jobs`. Ephemeral on the
     * daemon (finished jobs are pruned after a TTL; a restart drops them all), so this is a
     * recent-history surface, not an archive.
     */
    async function listCertJobs(): Promise<CertJob[]> {
        const res = await adminOk('GET', '/certs/jobs')
        const body = (await res.json()) as { jobs?: CertJob[] | null }
        return body.jobs ?? []
    }

    /**
     * Upload a manually-supplied cert/key pair — `PUT /certs/{domain}` (no certbot, no ACME).
     * Works whenever `tls.cert_dir` is set, independent of `acme.enabled` (`501` = no cert dir).
     * The daemon validates the pair (`tls.X509KeyPair` + expiry) before writing. The private key
     * is NEVER logged here.
     */
    async function uploadCertificate(
        domain: string,
        req: { cert: string; key: string },
    ): Promise<CertUploadResult> {
        const res = await adminOk('PUT', `/certs/${encodeURIComponent(domain)}`, {
            body: JSON.stringify({ cert: req.cert, key: req.key }),
            headers: { 'Content-Type': 'application/json' },
        })
        slog('info', 'nginxpilot', 'uploaded manual certificate via API', { domain })
        return (await res.json()) as CertUploadResult
    }

    /** Renew every cert near expiry — `POST /certs/renew`. Returns certbot's plain-text summary. */
    async function renewDueCertificates(): Promise<string> {
        const res = await adminOk('POST', '/certs/renew', { timeoutMs: CERT_OP_TIMEOUT_MS })
        slog('info', 'nginxpilot', 'renewed due certificates via API')
        return res.text()
    }

    /** Force-renew one cert by name — `POST /certs/{domain}/renew`. */
    async function renewCertificate(domain: string): Promise<void> {
        await adminOk('POST', `/certs/${encodeURIComponent(domain)}/renew`, {
            timeoutMs: CERT_OP_TIMEOUT_MS,
        })
        slog('info', 'nginxpilot', 'force-renewed certificate via API', { domain })
    }

    /**
     * Delete a cert — `DELETE /certs/{domain}`. The daemon removes whichever source owns the name
     * (a certbot-managed live dir → `certbot delete`, else a flat manual pair → unlink). `404` when
     * neither exists.
     */
    async function deleteCertificate(domain: string): Promise<void> {
        await adminOk('DELETE', `/certs/${encodeURIComponent(domain)}`)
        slog('info', 'nginxpilot', 'deleted certificate via API', { domain })
    }

    // ── Channel A: ACME DNS-provider credentials store over REST (cert_feature.md §2.8) ──────

    /**
     * List the stored DNS-provider credentials — `GET /acme/credentials`. Metadata only (provider
     * names + mechanism + mtime); the daemon never returns the secret bytes. An empty/disabled
     * store answers `200` with an empty list, so this only throws on transport / auth failure.
     */
    async function listAcmeCredentials(): Promise<AcmeCredentialInfo[]> {
        const res = await adminOk('GET', '/acme/credentials')
        return ((await res.json()) as { credentials?: AcmeCredentialInfo[] }).credentials ?? []
    }

    /**
     * Store (or replace) a provider's credential — `PUT /acme/credentials/{provider}`. Accepts the
     * raw passthrough body or the convenience fields (`credstore.Request`); the daemon writes a
     * `0600` artifact and applies it on the NEXT issue/renew. The secret is NEVER logged here.
     * `400` (mapped from the daemon) when `acme` is off or the body doesn't match the provider.
     */
    async function setAcmeCredentials(
        provider: string,
        req: AcmeCredentialRequest,
    ): Promise<AcmeCredentialResult> {
        const res = await adminOk('PUT', `/acme/credentials/${encodeURIComponent(provider)}`, {
            body: JSON.stringify(req),
            headers: { 'Content-Type': 'application/json' },
        })
        slog('info', 'nginxpilot', 'stored acme provider credentials via API', { provider })
        return (await res.json()) as AcmeCredentialResult
    }

    /** Remove a provider's stored credential — `DELETE /acme/credentials/{provider}` (`404` when absent). */
    async function deleteAcmeCredentials(provider: string): Promise<void> {
        await adminOk('DELETE', `/acme/credentials/${encodeURIComponent(provider)}`)
        slog('info', 'nginxpilot', 'deleted acme provider credentials via API', { provider })
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
        listRedirects,
        writeRedirect,
        removeRedirect,
        listDeadHosts,
        writeDeadHost,
        removeDeadHost,
        listAccessLists,
        writeAccessList,
        removeAccessList,
        setAccessListPassword,
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
        schema,
        listCertificates,
        issueCertificate,
        getCertJob,
        listCertJobs,
        uploadCertificate,
        renewDueCertificates,
        renewCertificate,
        deleteCertificate,
        listAcmeCredentials,
        setAcmeCredentials,
        deleteAcmeCredentials,
        reload,
    }
}

/** The full per-realm admin surface (every method closes over a {@link RealmConnection}). */
export type NginxpilotClient = ReturnType<typeof nginxpilotClient>

// The Phase-A back-compat shim (env-config-bound module-level functions) is gone: every
// caller now resolves a per-site / per-realm / active-realm client through
// `services/realms.ts` (multiple_realms.md Phase D/E). The env config is consumed only by
// `realms.ensureSeed`, which registers it as the default realm.
