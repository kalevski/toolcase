'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import { hstsEnabled, type HstsOptions, type TlsMode } from '@/server/domain/routing'
import { useMe } from '@/lib/me-context'
import { LoadingState, ErrorState } from '@/components/states'
import { RealmSelect } from '@/components/RealmSelect'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { SwitchField, TextField } from '@/components/fields'
import { escapeHtml, useTc } from '@/lib/tc'
import { iconBtnHtml, type ActionIconName } from '@/lib/action-icons'

// Each routing area is its own sidebar page (AppShell's Routing section) — no
// intra-section tab bar. Pools live WITH their consumers: the Proxies page
// carries the http upstream pools, the Streams page the L4 ones.

// Shared plumbing for the maintainer routing pages (Proxies, Upstreams) — the
// maintainer counterpart to `components/admin/shared.tsx`. Same gate shape, one
// rank up from owner-only: confirm the caller is a `maintainer` *or above* (so
// owners pass too), redirect anyone below away before requesting data, and render
// a consistent loading/error frame. Every backing `/api/routing/**` route is
// independently `authorize('maintainer')`-gated server-side, so this is a UX
// nicety, not the security boundary. The role comes from `useMe()` (plan WS-3).

/** Reject a non-OK response so a failed fetch surfaces as the error phase. */
export const json = <T,>(r: Response): Promise<T> => (r.ok ? (r.json() as Promise<T>) : Promise.reject(r))

// ── save helper: warnings + skip-DNS override (A5) ─────────────────────────────

/**
 * Outcome of a routing save. A successful write can still carry the daemon's
 * advisory target-check `warnings` (the resource IS live — "backend not reachable"
 * is normal mid-deploy). A failed write carries the machine `code` plus the daemon's
 * operator-facing `detail`; `dnsBlocked` flags the specific "target host does not
 * resolve" 400 that the daemon's own `?skip_target_checks=true` escape hatch
 * overrides — the UI offers "Save anyway" for it.
 */
export type SaveOutcome =
    | { ok: true; warnings: string[] }
    | { ok: false; status: number; code?: string; detail?: string; dnsBlocked: boolean }

/**
 * POST one routing entity to its `/api/routing/*` endpoint, surfacing warnings and
 * the daemon's rejection detail (A5). `skipTargetChecks` forwards the daemon's DNS
 * override for the retry path.
 */
export async function saveRouting(url: string, payload: unknown, skipTargetChecks = false): Promise<SaveOutcome> {
    try {
        const target = skipTargetChecks ? `${url}?skip_target_checks=true` : url
        const res = await fetch(target, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
        })
        const body = (await res.json().catch(() => null)) as {
            warnings?: string[]
            error?: string
            detail?: string
        } | null
        if (res.ok) return { ok: true, warnings: body?.warnings ?? [] }
        return {
            ok: false,
            status: res.status,
            code: body?.error,
            detail: body?.detail,
            dnsBlocked: res.status === 400 && /does not resolve/i.test(body?.detail ?? ''),
        }
    } catch {
        return { ok: false, status: 0, dnsBlocked: false }
    }
}

/** Compose the standard save-failure message from a {@link SaveOutcome}. */
export function saveErrorMessage(what: string, outcome: Extract<SaveOutcome, { ok: false }>): string {
    if (outcome.status === 0) return `Couldn’t save ${what} — network error.`
    if (outcome.detail) return `Couldn’t save ${what}: ${outcome.detail}`
    if (outcome.code) return `Couldn’t save ${what}: ${outcome.code}.`
    return `Couldn’t save ${what} (error ${outcome.status}).`
}

/**
 * Dismissible banner for the daemon's advisory target-check warnings after a
 * successful save. Advisory only — the resource is live; a reachability warning is
 * normal while a backend is still being deployed.
 */
export function SaveWarningsBanner({ warnings, onDismiss }: { warnings: string[]; onDismiss: () => void }) {
    if (!warnings.length) return null
    return (
        <tc-banner variant="warning">
            Saved, with {warnings.length} target-check warning{warnings.length === 1 ? '' : 's'} (advisory — the
            resource is live):
            <ul className="quaykeeper-admin-list">
                {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                ))}
            </ul>
            <tc-button variant="secondary" size="sm" outline onClick={onDismiss}>
                Dismiss
            </tc-button>
        </tc-banner>
    )
}

// ── HSTS custom options (§4) ────────────────────────────────────────────────────

/**
 * Form draft for the HSTS disclosure, shared by the proxy/redirect/dead-host forms.
 * Daemon defaults: max-age 2 years, include_subdomains on, preload off — the draft
 * holds only the deviations, so an untouched disclosure writes the minimal `hsts: true`.
 */
export interface HstsDraft {
    /** Seconds; empty = the daemon's 2-year default. */
    maxAge: string
    /** `include_subdomains` (daemon default true). */
    subdomains: boolean
    preload: boolean
}

export const defaultHstsDraft = (): HstsDraft => ({ maxAge: '', subdomains: true, preload: false })

/** Load a stored hsts value (bool write form or the daemon's struct read form) into the draft. */
export function hstsDraftFrom(h: boolean | HstsOptions | undefined): HstsDraft {
    if (typeof h !== 'object' || h === null) return defaultHstsDraft()
    return {
        maxAge: h.max_age && h.max_age > 0 ? String(h.max_age) : '',
        subdomains: h.include_subdomains !== false,
        preload: h.preload === true,
    }
}

/**
 * Build the hsts write value from an enabled disclosure: `true` when everything is
 * at daemon defaults, else the struct carrying only the deviations.
 */
export function hstsPayload(d: HstsDraft): { value: true | HstsOptions } | { error: string } {
    let maxAge: number | undefined
    if (d.maxAge.trim()) {
        const n = Number(d.maxAge)
        if (!Number.isInteger(n) || n <= 0) {
            return { error: 'HSTS max-age must be a positive whole number of seconds.' }
        }
        maxAge = n
    }
    if (maxAge === undefined && d.subdomains && !d.preload) return { value: true }
    const h: HstsOptions = { enabled: true }
    if (maxAge !== undefined) h.max_age = maxAge
    if (!d.subdomains) h.include_subdomains = false
    if (d.preload) h.preload = true
    return { value: h }
}

/** The HSTS custom-options row, revealed while the HSTS toggle is on. */
export function HstsOptionsRow({
    draft,
    onDraft,
    disabled,
}: {
    draft: HstsDraft
    onDraft: (next: HstsDraft) => void
    disabled?: boolean
}) {
    return (
        <div className="quaykeeper-form-grid quaykeeper-form-span">
            <TextField
                size="sm"
                label="HSTS max-age (seconds)"
                placeholder="63072000 (2 years)"
                help="Sent as Strict-Transport-Security max-age. Blank keeps the daemon's 2-year default."
                disabled={disabled}
                value={draft.maxAge}
                onValue={(v) => onDraft({ ...draft, maxAge: v })}
            />
            <div className="quaykeeper-form-switches">
                <SwitchField
                    label="Include subdomains"
                    disabled={disabled}
                    checked={draft.subdomains}
                    onChecked={(c) => onDraft({ ...draft, subdomains: c })}
                />
                <SwitchField
                    label="Preload"
                    disabled={disabled}
                    checked={draft.preload}
                    onChecked={(c) => onDraft({ ...draft, preload: c })}
                />
            </div>
        </div>
    )
}

export type RoutingDataState<T> =
    | { phase: 'loading' }
    | { phase: 'forbidden' }
    | { phase: 'error' }
    | { phase: 'ready'; data: T }

/**
 * Confirm the caller has the `routing` feature enabled (features.ts), then load a
 * routing dataset via `fetcher`. Anyone without the feature is redirected to the
 * dashboard and never sees routing data. `reload` re-runs the fetcher and swaps in
 * fresh data (after a mutation, or via the error Retry). `fetcher` MUST be stable
 * (wrap in `useCallback`) — it is intentionally omitted from the effect deps. Every
 * backing `/api/routing/**` route re-enforces the feature server-side, so this is a
 * UX nicety, not the security boundary.
 */
export function useMaintainerData<T>(fetcher: () => Promise<T | null>): {
    state: RoutingDataState<T>
    reload: () => Promise<void>
} {
    const router = useRouter()
    const me = useMe()
    const [state, setState] = useState<RoutingDataState<T>>({ phase: 'loading' })

    useEffect(() => {
        if (!me.features.routing) {
            setState({ phase: 'forbidden' })
            router.replace('/')
            return
        }
        let cancelled = false
        void fetcher().then((data) => {
            if (cancelled) return
            setState(data ? { phase: 'ready', data } : { phase: 'error' })
        })
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [me.features.routing, router])

    const reload = useCallback(async () => {
        setState({ phase: 'loading' })
        const data = await fetcher()
        setState(data ? { phase: 'ready', data } : { phase: 'error' })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return { state, reload }
}

// ── daemon capability probe (impl §6) ───────────────────────────────────────────

/**
 * The active realm's daemon capability set (`GET /api/routing/capabilities`), or
 * null while loading / when `GET /schema` is unavailable. Null = "unknown,
 * assume everything" — gating only ever fires on a POSITIVE "this path is absent".
 */
function useRealmCapabilities(): { version: string | null; paths: string[] } | null {
    const [caps, setCaps] = useState<{ version: string | null; paths: string[] } | null>(null)
    useEffect(() => {
        let cancelled = false
        void fetch('/api/routing/capabilities', { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((body: { capabilities?: { version: string | null; paths: string[] } | null } | null) => {
                if (!cancelled && body?.capabilities) setCaps(body.capabilities)
            })
            .catch(() => undefined)
        return () => {
            cancelled = true
        }
    }, [])
    return caps
}

/**
 * Frame one routing page: a titled header plus the body for the current load
 * phase. `children` renders the ready data; loading/forbidden show shimmer
 * skeletons and error shows a banner with an in-place Retry (plan WS-4). Mirrors
 * `admin/shared.tsx`'s `AdminPage` so the routing pages stay visually consistent
 * with the admin surface (reuses the same `.quaykeeper-admin-*` layout classes).
 *
 * `requiresPath` names the daemon endpoint this page drives (e.g. "/redirects");
 * when the realm's schema-declared capability set positively lacks it, a warning
 * banner explains the daemon is too old instead of every call 404ing raw (impl §6).
 */
export function RoutingPage<T>({
    title,
    subtitle,
    icon,
    iconColor = 'cyan',
    state,
    onRetry,
    requiresPath,
    children,
}: {
    title: string
    subtitle?: string
    /** Lucide glyph (kebab-case) for the header icon chip — mirrors the side-nav icon. */
    icon?: string
    /** Header icon chip tint (tc-rich-page-header palette). */
    iconColor?: string
    state: RoutingDataState<T>
    onRetry?: () => void
    /** The daemon path this page needs (capability gate, impl §6). */
    requiresPath?: string
    children: (data: T) => ReactNode
}) {
    const caps = useRealmCapabilities()
    const unsupported = !!requiresPath && !!caps && !caps.paths.includes(requiresPath)
    let body: ReactNode
    if (state.phase === 'ready') {
        body = children(state.data)
    } else if (state.phase === 'error') {
        body = (
            <ErrorState
                title="Couldn’t load this page"
                message="The routing data didn’t come back. This is usually temporary."
                onRetry={onRetry}
            />
        )
    } else {
        body = <LoadingState shape="rows" count={4} />
    }

    // Same attribute-driven tc-rich-page-header as the admin frame — keeps the
    // routing pages visually consistent with the owner admin surface. The active
    // nginxpilot-instance (realm) selector sits in the page header: every routing
    // page's data is scoped to the active realm, so the picker lives in-context
    // (it replaces the old sidebar switcher) and persists the choice across features.
    return (
        <section className="quaykeeper-admin">
            <tc-rich-page-header
                title-text={title}
                description={subtitle}
                icon-name={icon}
                icon-color={iconColor}
            />
            <RealmSelect className="quaykeeper-admin-realm-select" />
            {unsupported && (
                <tc-banner variant="warning">
                    This realm’s nginxpilot doesn’t support {title.toLowerCase()} (its API declares no{' '}
                    <span className="quaykeeper-admin-mono">{requiresPath}</span> endpoint) — upgrade the daemon to
                    use this page.
                </tc-banner>
            )}
            <RoutingHealthStrip />
            <RoutingTestButton />
            {body}
        </section>
    )
}

/**
 * One resource verdict from the managed-mode dry run (`POST /nginx/test`) or the live
 * status (`GET /api/routing/status`). `at_risk` only ever appears in the live status —
 * the reconcile loop's "serving now, but would fail the next apply" overlay (A7).
 */
interface NginxTestResource {
    kind: string
    key: string
    state: 'active' | 'disabled' | 'at_risk'
    reason?: string
    /** ISO timestamp the reconcile loop first saw this resource failing. */
    since?: string
}

interface NginxTestResponse {
    managed: boolean
    resources?: NginxTestResource[]
    error?: string
}

/** The `GET /api/routing/status` payload (the daemon's `status.nginx` block, A7). */
interface RoutingStatusResponse {
    managed: boolean
    resources?: NginxTestResource[]
    disabled_count?: number
    at_risk_count?: number
    reconcile?: {
        enabled: boolean
        interval: string
        on_failure: string
        last_run?: string
        at_risk_count: number
    }
    /** Real-IP trust-list summary (C2) — config-file-owned on the daemon, read-only here. */
    real_ip?: {
        enabled: boolean
        header: string
        recursive: boolean
        providers: string[]
        static_count: number
        range_count: number
        last_refresh?: string
        last_error?: string
    }
}

/** Localised date+time for "failing since …" copy; empty for a missing/bad value. */
function fmtSince(iso?: string): string {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Parse a Go duration string ("1m", "1m30s", "1h5m") into seconds; null when unparseable. */
function parseGoDuration(s: string): number | null {
    const m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/)
    if (!m || (!m[1] && !m[2] && !m[3])) return null
    return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

/** Short relative "ago" phrasing for the reconcile card; empty for a bad value. */
function fmtAgo(iso: string): string {
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) return ''
    const sec = Math.max(0, Math.round((Date.now() - t) / 1000))
    if (sec < 60) return `${sec}s ago`
    if (sec < 3600) return `${Math.round(sec / 60)}m ago`
    if (sec < 86400) return `${Math.round(sec / 3600)}h ago`
    return `${Math.round(sec / 86400)}d ago`
}

// ── live per-resource state chips (B1) ──────────────────────────────────────────

/** A non-active live verdict for one resource, keyed for the list-page chips. */
export interface ResourceStateInfo {
    state: 'disabled' | 'at_risk'
    reason?: string
    since?: string
}

/**
 * The active realm's non-active resource states for ONE kind, as a key → info map
 * (B1's list chips). Fetched once per page load from `GET /api/routing/status`;
 * empty when the realm isn't managed, everything is healthy, or the call fails
 * (the chips are an enrichment, never the page's critical path).
 */
export function useResourceStates(kind: string): Map<string, ResourceStateInfo> {
    const [states, setStates] = useState<Map<string, ResourceStateInfo>>(() => new Map())

    useEffect(() => {
        let cancelled = false
        void fetch('/api/routing/status', { cache: 'no-store' })
            .then((r) => (r.ok ? (r.json() as Promise<RoutingStatusResponse>) : null))
            .then((body) => {
                if (cancelled || !body?.managed) return
                const next = new Map<string, ResourceStateInfo>()
                for (const r of body.resources ?? []) {
                    if (r.kind !== kind || r.state === 'active') continue
                    next.set(r.key, { state: r.state, reason: r.reason, since: r.since })
                }
                if (next.size) setStates(next)
            })
            .catch(() => undefined)
        return () => {
            cancelled = true
        }
    }, [kind])

    return states
}

// ── persisted episode history (B1) ──────────────────────────────────────────────

/** One persisted state episode as `GET /api/routing/state-history` returns it. */
interface ResourceEpisodeDto {
    id: number
    kind: string
    key: string
    state: string
    reason: string | null
    firstSeen: string
    lastSeen: string
    clearedAt: string | null
    actorLogin: string | null
    actorAt: string | null
}

/**
 * Inline episode-history drawer for one resource (B1): the persisted
 * disabled/at_risk/renew-failure episodes the status poller recorded — surviving
 * daemon and Quaykeeper restarts — with audit attribution ("last changed by @login").
 */
export function EpisodeHistory({ kind, resourceKey }: { kind: string; resourceKey: string }) {
    const [episodes, setEpisodes] = useState<ResourceEpisodeDto[] | 'loading' | 'error'>('loading')

    useEffect(() => {
        let cancelled = false
        setEpisodes('loading')
        void fetch(
            `/api/routing/state-history?kind=${encodeURIComponent(kind)}&key=${encodeURIComponent(resourceKey)}`,
            { cache: 'no-store' },
        )
            .then((r) => (r.ok ? (r.json() as Promise<{ episodes: ResourceEpisodeDto[] }>) : Promise.reject(r)))
            .then((body) => {
                if (!cancelled) setEpisodes(body.episodes)
            })
            .catch(() => {
                if (!cancelled) setEpisodes('error')
            })
        return () => {
            cancelled = true
        }
    }, [kind, resourceKey])

    if (episodes === 'loading') return <p className="quaykeeper-admin-hint">Loading history…</p>
    if (episodes === 'error') return <p className="quaykeeper-admin-hint">Couldn’t load the state history.</p>
    if (episodes.length === 0) {
        return (
            <tc-empty-state icon="history">
                No recorded episodes — this resource has never been seen failing.
            </tc-empty-state>
        )
    }
    return (
        <ul className="quaykeeper-admin-list">
            {episodes.map((e) => (
                <li key={e.id}>
                    <span className="quaykeeper-admin-mono">{e.state}</span> {fmtSince(e.firstSeen)} →{' '}
                    {e.clearedAt ? fmtSince(e.clearedAt) : 'ongoing'}
                    {e.reason ? ` — ${e.reason}` : ''}
                    {e.actorLogin ? (
                        <span className="quaykeeper-admin-hint">
                            {' '}
                            · last changed by @{e.actorLogin}
                            {e.actorAt ? ` (${fmtSince(e.actorAt)})` : ''}
                        </span>
                    ) : null}
                </li>
            ))}
        </ul>
    )
}

/**
 * Live managed-mode health strip (A7): fetches `GET /api/routing/status` once per
 * page load and surfaces the reconcile loop's verdicts — resources that are `at_risk`
 * (still serving; the daemon's default `on_failure: warn` policy never removes routes)
 * or `disabled` (quarantined, not serving). Quietly renders nothing when the realm
 * isn't managed or the status call fails — the dry-run button remains the explicit path.
 */
function RoutingHealthStrip() {
    const [status, setStatus] = useState<RoutingStatusResponse | null>(null)
    // The resource whose persisted episode history is expanded (B1), or null.
    const [historyFor, setHistoryFor] = useState<{ kind: string; key: string } | null>(null)

    useEffect(() => {
        let cancelled = false
        void fetch('/api/routing/status', { cache: 'no-store' })
            .then((r) => (r.ok ? (r.json() as Promise<RoutingStatusResponse>) : null))
            .then((body) => {
                if (!cancelled && body) setStatus(body)
            })
            .catch(() => undefined)
        return () => {
            cancelled = true
        }
    }, [])

    if (!status?.managed) return null
    const atRisk = status.resources?.filter((r) => r.state === 'at_risk') ?? []
    const disabled = status.resources?.filter((r) => r.state === 'disabled') ?? []
    const realIp = status.real_ip
    const reconcile = status.reconcile
    if (
        atRisk.length === 0 &&
        disabled.length === 0 &&
        !realIp?.enabled &&
        !realIp?.last_error &&
        !reconcile
    ) {
        return null
    }

    // Stale-loop detection: the loop should tick every `interval`; well past that
    // (3× + a settle margin) means it's wedged or the daemon restarted.
    let reconcileStale = false
    if (reconcile?.enabled && reconcile.last_run) {
        const intervalSec = parseGoDuration(reconcile.interval) ?? 60
        const ageSec = (Date.now() - new Date(reconcile.last_run).getTime()) / 1000
        reconcileStale = Number.isFinite(ageSec) && ageSec > Math.max(intervalSec * 3, intervalSec + 60)
    }

    const resourceLine = (r: NginxTestResource, sinceLabel: string) => (
        <li key={`${r.kind}:${r.key}`}>
            <span className="quaykeeper-admin-mono">
                {r.kind} {r.key}
            </span>
            {r.reason ? ` — ${r.reason}` : ''}
            {r.since ? ` (${sinceLabel} ${fmtSince(r.since)})` : ''}{' '}
            <tc-button
                variant="secondary"
                size="sm"
                outline
                onClick={() =>
                    setHistoryFor((prev) =>
                        prev && prev.kind === r.kind && prev.key === r.key ? null : { kind: r.kind, key: r.key },
                    )
                }
            >
                History
            </tc-button>
            {historyFor && historyFor.kind === r.kind && historyFor.key === r.key && (
                <EpisodeHistory kind={r.kind} resourceKey={r.key} />
            )}
        </li>
    )

    return (
        <div className="quaykeeper-routing-health">
            {reconcile && (
                <div className="quaykeeper-reconcile" role="status">
                    <span className="quaykeeper-reconcile-label">Reconcile</span>
                    {reconcile.enabled ? (
                        <>
                            <span
                                className={`badge text-bg-${reconcile.on_failure === 'disable' ? 'warning' : 'secondary'}`}
                                title={
                                    reconcile.on_failure === 'disable'
                                        ? 'A resource failing the periodic dry run is automatically disabled (its route is removed) after flap damping.'
                                        : 'A resource failing the periodic dry run is only marked at risk — traffic is never touched.'
                                }
                            >
                                on failure: {reconcile.on_failure}
                            </span>
                            <span className="quaykeeper-admin-hint">every {reconcile.interval}</span>
                            <span className="quaykeeper-admin-hint">
                                {reconcile.last_run ? `checked ${fmtAgo(reconcile.last_run)}` : 'not yet run'}
                            </span>
                            {reconcile.at_risk_count > 0 && (
                                <span className="badge text-bg-warning">
                                    {reconcile.at_risk_count} at risk
                                </span>
                            )}
                            {reconcileStale && (
                                <span
                                    className="badge text-bg-danger"
                                    title={`The reconcile loop hasn't run for well over its ${reconcile.interval} interval — it may be wedged, or the daemon restarted.`}
                                >
                                    stale — last ran {reconcile.last_run ? fmtAgo(reconcile.last_run) : 'never'}
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="quaykeeper-admin-hint">
                            off — config is re-checked only on writes and reloads
                        </span>
                    )}
                </div>
            )}
            {realIp?.enabled && (
                <tc-banner variant={realIp.last_error ? 'warning' : 'info'}>
                    Real-IP restoration is on (header {realIp.header}): {realIp.range_count} provider range
                    {realIp.range_count === 1 ? '' : 's'}
                    {realIp.providers.length ? ` from ${realIp.providers.join(', ')}` : ''}, {realIp.static_count}{' '}
                    static. IP rules in access lists see the real client address.
                    {realIp.last_refresh ? ` Ranges refreshed ${fmtSince(realIp.last_refresh)}.` : ''}
                    {realIp.last_error ? ` Last fetch problem: ${realIp.last_error}` : ''}
                </tc-banner>
            )}
            {atRisk.length > 0 && (
                <tc-banner variant="warning">
                    {atRisk.length} resource{atRisk.length === 1 ? '' : 's'} at risk — still serving, but would fail
                    the next apply:
                    <ul className="quaykeeper-admin-list">{atRisk.map((r) => resourceLine(r, 'failing since'))}</ul>
                </tc-banner>
            )}
            {disabled.length > 0 && (
                <tc-banner variant="danger">
                    {disabled.length} resource{disabled.length === 1 ? '' : 's'} quarantined by nginx&nbsp;-t (not
                    serving):
                    <ul className="quaykeeper-admin-list">{disabled.map((r) => resourceLine(r, 'since'))}</ul>
                </tc-banner>
            )}
        </div>
    )
}

/**
 * Managed-mode "Test config" dry run (Phase E). POSTs `/api/routing/nginx-test` and
 * renders the per-resource pass/fail set so a maintainer can preview the daemon's
 * `nginx -t` verdict before trusting a live apply. Shows a muted note when managed mode
 * is off (the toggles still save; they're just inert until managed). Shared across all
 * four routing pages via {@link RoutingPage}.
 */
function RoutingTestButton() {
    const me = useMe()
    const [busy, setBusy] = useState(false)
    const [result, setResult] = useState<NginxTestResponse | null>(null)
    const [failed, setFailed] = useState(false)
    // Owner-only manual reload (impl "minor"): outcome line + pending-confirm flag.
    const [reloadNote, setReloadNote] = useState<{ ok: boolean; text: string } | null>(null)
    const [confirmReload, setConfirmReload] = useState(false)

    const run = useCallback(async () => {
        setBusy(true)
        setFailed(false)
        try {
            const res = await fetch('/api/routing/nginx-test', { method: 'POST' })
            if (!res.ok) {
                setResult(null)
                setFailed(true)
                return
            }
            setResult((await res.json()) as NginxTestResponse)
        } catch {
            setResult(null)
            setFailed(true)
        } finally {
            setBusy(false)
        }
    }, [])

    const runReload = useCallback(async () => {
        setBusy(true)
        setReloadNote(null)
        try {
            const res = await fetch('/api/routing/reload', { method: 'POST' })
            const body = (await res.json().catch(() => null)) as { detail?: string } | null
            setReloadNote(
                res.ok
                    ? { ok: true, text: 'Config reloaded — the daemon re-applied the full config.' }
                    : { ok: false, text: `Reload failed${body?.detail ? `: ${body.detail}` : '.'}` },
            )
        } catch {
            setReloadNote({ ok: false, text: 'Reload failed — network error.' })
        } finally {
            setBusy(false)
        }
    }, [])

    const disabled = result?.resources?.filter((r) => r.state === 'disabled') ?? []

    return (
        <div className="quaykeeper-routing-test">
            <div className="quaykeeper-routing-test-buttons">
                <tc-button variant="secondary" outline size="sm" onClick={run} disabled={busy || undefined}>
                    {busy ? 'Testing…' : 'Test config'}
                </tc-button>
                {me.role === 'owner' && (
                    <tc-button
                        variant="secondary"
                        outline
                        size="sm"
                        onClick={() => setConfirmReload(true)}
                        disabled={busy || undefined}
                    >
                        Reload config
                    </tc-button>
                )}
            </div>
            {reloadNote && (
                <tc-banner variant={reloadNote.ok ? 'success' : 'danger'}>{reloadNote.text}</tc-banner>
            )}
            <ConfirmDialog
                open={confirmReload}
                title="Reload nginx config?"
                message="The daemon re-renders the full config, gates it behind nginx -t (rolling back on failure), and reloads nginx. Safe, but it is a live change — long-lived connections may be moved to draining workers."
                confirmLabel="Reload"
                onConfirm={() => {
                    setConfirmReload(false)
                    void runReload()
                }}
                onCancel={() => setConfirmReload(false)}
            />
            {failed && <tc-banner variant="danger">Couldn’t run the dry run — the deploy engine didn’t answer.</tc-banner>}
            {result && !result.managed && (
                <tc-banner variant="info">
                    Managed mode is off — TLS &amp; security toggles and streams are inert until nginxpilot runs in
                    managed mode. Settings still save.
                </tc-banner>
            )}
            {result?.managed && disabled.length === 0 && (
                <tc-banner variant="success">All resources pass nginx&nbsp;-t.</tc-banner>
            )}
            {result?.managed && disabled.length > 0 && (
                <tc-banner variant="danger">
                    {disabled.length} resource{disabled.length === 1 ? '' : 's'} would be disabled by nginx&nbsp;-t:
                    <ul className="quaykeeper-admin-list">
                        {disabled.map((r) => (
                            <li key={`${r.kind}:${r.key}`}>
                                <span className="quaykeeper-admin-mono">
                                    {r.kind} {r.key}
                                </span>
                                {r.reason ? ` — ${r.reason}` : ''}
                            </li>
                        ))}
                    </ul>
                </tc-banner>
            )}
        </div>
    )
}

// ── rendered-vhost preview (impl §5) ────────────────────────────────────────────

/**
 * Read-only viewer for the daemon's rendered `server{}` block (`GET /vhost/{domain}`
 * via `/api/routing/vhost/{domain}`). The daemon renders even disabled resources —
 * this is a preview, not the live config — so maintainers can see exactly where
 * their `advanced` lines land before an apply passes judgment.
 *
 * tc-modal relocates its children at connect, so the modal mounts fresh per domain
 * (conditional render + key) with ONE stable wrapper child; the loading/error/code
 * states all render inside that wrapper.
 */
export function VhostPreviewModal({ domain, onClose }: { domain: string | null; onClose: () => void }) {
    const [state, setState] = useState<{ phase: 'loading' } | { phase: 'error'; detail?: string } | { phase: 'ready'; text: string }>({ phase: 'loading' })

    useEffect(() => {
        if (!domain) return
        let cancelled = false
        setState({ phase: 'loading' })
        void fetch(`/api/routing/vhost/${encodeURIComponent(domain)}`, { cache: 'no-store' })
            .then(async (r) => {
                const body = (await r.json().catch(() => null)) as { vhost?: string; detail?: string } | null
                if (cancelled) return
                if (r.ok && typeof body?.vhost === 'string') setState({ phase: 'ready', text: body.vhost })
                else setState({ phase: 'error', detail: body?.detail })
            })
            .catch(() => {
                if (!cancelled) setState({ phase: 'error' })
            })
        return () => {
            cancelled = true
        }
    }, [domain])

    // tc-modal announces every close path (X, Escape, backdrop) via tc-hidden.
    const ref = useTc<HTMLElement>(undefined, { 'tc-hidden': () => onClose() })

    if (!domain) return null
    return (
        <tc-modal key={domain} ref={ref} open title={`nginx config — ${domain}`} size="lg" scrollable centered>
            <div className="quaykeeper-vhost-preview">
                {state.phase === 'loading' && <p className="quaykeeper-admin-hint">Rendering the vhost…</p>}
                {state.phase === 'error' && (
                    <tc-banner variant="danger">
                        Couldn’t render the vhost{state.detail ? `: ${state.detail}` : '.'}
                    </tc-banner>
                )}
                {state.phase === 'ready' && (
                    <tc-code-snippet code={state.text} language="nginx" show-copy-button="" />
                )}
            </div>
        </tc-modal>
    )
}

/**
 * Relocation-safe `tc-advanced-table` listing for the routing surfaces (proxies,
 * redirects, dead hosts, access lists, streams, upstream pools). The header row is
 * driven by the element's `columns` property and the body rows are injected as an
 * escaped-HTML string into the projected `<tbody>` (the canonical tc-advanced-table
 * pattern — see /admin/sites), NEVER as slotted React `<tr>` children: a `<tr>`
 * outside a `<table>` is invalid HTML, so the browser parser hoists it during SSR
 * and Next.js hydration fails.
 *
 * Each page owns its column set: `columns` describes the data columns between the
 * built-in leading name column and the trailing action column, and every item
 * carries pre-escaped cell HTML keyed by column key. Build cells with the `cell*`
 * helpers below — anything interpolated from user data MUST go through
 * {@link escapeHtml}. Action buttons are plain `<button>`s carrying
 * `data-action`/`data-name`; clicks are caught by one delegated listener on the
 * table host.
 */
export interface RoutingListItem {
    name: string
    /** Pre-escaped cell HTML per data-column key (see {@link RoutingListTable}'s `columns`). */
    cells: Record<string, string>
    /** Extra pre-escaped HTML appended after the name (e.g. a wildcard chip). */
    nameExtraHtml?: string
    /** Label for the row's toggle button (e.g. "Disable"/"Enable"); omit for no toggle. */
    toggleLabel?: string
    /** Live daemon verdict for the row (B1): `at_risk` = warning chip, `disabled` = danger chip. */
    stateChip?: 'disabled' | 'at_risk'
    /** Tooltip for the state chip (the daemon's nginx -t reason). */
    stateReason?: string
}

// ── pre-escaped cell fragments (compose per-page cells from these) ──────────────

/** Monospace cell fragment (names, targets, ports). */
export const cellMono = (v: unknown): string => `<span class="quaykeeper-admin-mono">${escapeHtml(v)}</span>`

/** Muted hint cell fragment (defaults, counts, placeholders). */
export const cellMuted = (v: unknown): string => `<span class="quaykeeper-admin-hint">${escapeHtml(v)}</span>`

/** Badge chip fragment; `title` becomes the hover tooltip. */
export function cellBadge(label: string, variant = 'secondary', title?: string): string {
    const t = title ? ` title="${escapeHtml(title)}"` : ''
    return `<span class="badge text-bg-${variant}"${t}>${escapeHtml(label)}</span>`
}

/** Join prebuilt fragments with spacing; an em-dash placeholder when empty. */
export const cellJoin = (parts: string[]): string => (parts.length ? parts.join(' ') : cellMuted('—'))

/** Enabled/disabled status chip (resources carrying an `enabled` flag). */
export const cellEnabled = (enabled: boolean): string =>
    enabled
        ? cellBadge('enabled', 'success')
        : cellBadge('disabled', 'secondary', 'Configured, but rendering no nginx block.')

/** The shared TLS summary cell (proxies / redirects / dead hosts). */
export function cellTls(x: {
    tls?: TlsMode
    force_ssl?: boolean
    http2?: boolean
    hsts?: boolean | HstsOptions
}): string {
    if (!x.tls || x.tls === 'off') return cellMuted('off')
    const chips = [
        cellBadge(
            `TLS ${x.tls}`,
            x.tls === 'required' ? 'success' : 'info',
            x.tls === 'auto'
                ? 'Serves HTTPS when a cert exists; degrades to HTTP otherwise.'
                : 'Hard-fails the block until a cert is present.',
        ),
    ]
    if (x.force_ssl) chips.push(cellBadge('force HTTPS', 'secondary', '80 → 301 https redirect'))
    if (x.http2) chips.push(cellBadge('HTTP/2'))
    if (hstsEnabled(x.hsts)) chips.push(cellBadge('HSTS'))
    return chips.join(' ')
}

/** Access-list reference cell — the named policy, or "open" when unguarded. */
export const cellAccessList = (name?: string): string => (name ? cellMono(name) : cellMuted('open'))

/** The row's state chip HTML (B1) — empty for a healthy resource. */
function stateChipHtml(row: RoutingListItem): string {
    if (!row.stateChip) return ''
    const variant = row.stateChip === 'disabled' ? 'danger' : 'warning'
    const label = row.stateChip === 'disabled' ? 'quarantined' : 'at risk'
    const title = row.stateReason ? ` title="${escapeHtml(row.stateReason)}"` : ''
    return ` <span class="badge text-bg-${variant}"${title}>${label}</span>`
}

/** The injected `<tbody>` HTML — every interpolated value is escaped. */
function routingRowsHtml(
    items: RoutingListItem[],
    columns: AdvancedTableColumn[],
    opts: { busy: boolean; hasEdit: boolean; hasToggle: boolean; hasView: boolean; colSpan: number },
): string {
    if (items.length === 0) {
        return `<tr><td colspan="${opts.colSpan}" class="quaykeeper-admin-empty-cell"><tc-empty-state icon="inbox">Nothing here yet.</tc-empty-state></td></tr>`
    }
    const btn = (icon: ActionIconName, action: string, name: string, label: string, danger = false) =>
        iconBtnHtml({ icon, label, danger, disabled: opts.busy, data: { action, name } })
    return items
        .map((row) => {
            const actions: string[] = []
            if (opts.hasView) actions.push(btn('config', 'view', row.name, 'View rendered config'))
            if (opts.hasToggle && row.toggleLabel) actions.push(btn('toggle', 'toggle', row.name, row.toggleLabel))
            if (opts.hasEdit) actions.push(btn('edit', 'edit', row.name, 'Edit'))
            actions.push(btn('remove', 'remove', row.name, 'Remove', true))
            const cells = columns
                .map((c) => `<td${c.align ? ` style="text-align:${c.align}"` : ''}>${row.cells[c.key] ?? ''}</td>`)
                .join('')
            return (
                `<tr>` +
                `<td><span class="quaykeeper-admin-mono">${escapeHtml(row.name)}</span>${row.nameExtraHtml ?? ''}${stateChipHtml(row)}</td>` +
                cells +
                `<td style="text-align:right"><span class="quaykeeper-routing-actions">${actions.join('')}</span></td>` +
                `</tr>`
            )
        })
        .join('')
}

export function RoutingListTable({
    columns,
    items,
    busy,
    nameLabel = 'Name',
    onEdit,
    onToggle,
    onView,
    onRemove,
}: {
    /** Data columns rendered between the built-in name column and the trailing action column. */
    columns: AdvancedTableColumn[]
    items: RoutingListItem[]
    busy: boolean
    /** Header label for the leading name column (e.g. "Domain"). */
    nameLabel?: string
    onEdit?: (name: string) => void
    onToggle?: (name: string) => void
    /** When provided, each row gets a "Config" button opening the rendered-vhost preview (impl §5). */
    onView?: (name: string) => void
    onRemove: (name: string) => void
}) {
    const hasEdit = !!onEdit
    const hasToggle = !!onToggle
    const hasView = !!onView

    const allColumns = useMemo<AdvancedTableColumn[]>(
        () => [{ key: 'name', label: nameLabel }, ...columns, { key: 'action', label: '', align: 'right' }],
        [columns, nameLabel],
    )

    // Route the delegated action-button clicks back to the callbacks (the buttons
    // live in the injected tbody HTML, so a host-level listener is the only way to
    // reach them). useTc reads handlers live, so identity churn here is harmless.
    const onTableClick = useCallback(
        (event: Event) => {
            const el = (event.target as HTMLElement)?.closest?.('[data-action]') as HTMLElement | null
            if (!el) return
            const name = el.getAttribute('data-name')
            if (name === null) return
            switch (el.getAttribute('data-action')) {
                case 'view':
                    onView?.(name)
                    break
                case 'toggle':
                    onToggle?.(name)
                    break
                case 'edit':
                    onEdit?.(name)
                    break
                case 'remove':
                    onRemove(name)
                    break
            }
        },
        [onView, onToggle, onEdit, onRemove],
    )

    const tableProps = useMemo(
        () => ({
            columns: allColumns,
            total: items.length,
            limit: Math.max(items.length, 1),
            offset: 0,
            // Body rows as the element-owned `rows` HTML string — relocation-safe,
            // re-applied by the component on every internal re-render. Regenerates
            // when the rows or the busy flag (button disabling) change.
            rows: routingRowsHtml(items, columns, {
                busy,
                hasEdit,
                hasToggle,
                hasView,
                colSpan: allColumns.length,
            }),
        }),
        [allColumns, items, columns, busy, hasEdit, hasToggle, hasView],
    )
    const tableRef = useTc<HTMLElement>(tableProps, { click: onTableClick })

    return <tc-advanced-table ref={tableRef} />
}
