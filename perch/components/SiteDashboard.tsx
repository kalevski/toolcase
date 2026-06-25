'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTc } from '@/lib/tc'
import { buildSiteDashboard, type SiteStatusPayload } from '@/server/domain/site-dashboard'
import type { PlanLimits, Site, SiteUsage } from '@/server/domain/types'

// Per-site dashboard (§9 step 5, §11, §14, task 734). A live status view for one
// site composed entirely of `tc-*` Web Components driven through the `lib/tc.ts`
// bridge: object data (`items`/`usage`/`lines`) flows in as element *properties*
// and the deploy state is polled from `GET /api/sites/{id}/status`.
//
//   • tc-status-dot / tc-status-card — live | provisioning | failed | over-quota | suspended
//   • tc-build (+ a Redeploy button) — last deploy ref/size, POST …/redeploy
//   • tc-usage-summary-panel         — bytes-used bars vs the plan's maxBytesPerSite
//   • tc-terminal-window             — the deploy log
//
// All presentation is derived by the pure `domain/site-dashboard.ts` view-model, so
// the component is just data-fetching + wiring. The last-known-good guarantee (a bad
// push keeps the previous release serving) is surfaced verbatim from that model.

// Poll cadence: faster while a deploy is in flight, relaxed once terminal.
const POLL_ACTIVE_MS = 5000
const POLL_IDLE_MS = 20000

const REDEPLOY_ERROR_COPY: Record<string, string> = {
    unauthorized: 'Your session expired. Sign in again to redeploy.',
    site_not_found: 'This site no longer exists.',
    forbidden: 'You do not have access to this site.',
    nginxpilot_error: 'The deploy engine is unavailable right now. Try again shortly.',
    internal_error: 'Something went wrong starting the redeploy. Try again.',
}

function redeployError(code: unknown, status: number): string {
    if (typeof code === 'string' && REDEPLOY_ERROR_COPY[code]) return REDEPLOY_ERROR_COPY[code]
    if (typeof code === 'string' && code) return code
    return `Redeploy failed (HTTP ${status}).`
}

export function SiteDashboard({
    site,
    limits,
    accountUsage,
}: {
    site: Site
    limits: PlanLimits
    /** Account-wide usage, to add an "All your sites" storage bar beside the per-site one. */
    accountUsage?: SiteUsage
}) {
    const [payload, setPayload] = useState<SiteStatusPayload | null>(null)
    const [loadError, setLoadError] = useState(false)
    const [redeploying, setRedeploying] = useState(false)
    const [redeployMsg, setRedeployMsg] = useState<string | null>(null)

    const statusUrl = `/api/sites/${encodeURIComponent(site.id)}/status`

    // One-shot status fetch, shared by the poll loop and the post-redeploy refresh.
    const fetchStatus = useCallback(async (): Promise<SiteStatusPayload | null> => {
        const res = await fetch(statusUrl, { cache: 'no-store' })
        if (!res.ok) throw new Error(`status ${res.status}`)
        return (await res.json()) as SiteStatusPayload
    }, [statusUrl])

    // Poll `/status` on mount and on an interval. The cadence adapts to the latest
    // reading: while a deploy is provisioning/syncing we poll quickly, then relax.
    useEffect(() => {
        let cancelled = false
        let timer: ReturnType<typeof setTimeout> | undefined

        const tick = async () => {
            let latest: SiteStatusPayload | null = null
            try {
                latest = await fetchStatus()
                if (cancelled) return
                setPayload(latest)
                setLoadError(false)
            } catch {
                if (!cancelled) setLoadError(true)
            }
            if (cancelled) return
            const active =
                !!latest?.nginxpilot?.syncing ||
                latest?.site.status === 'provisioning' ||
                latest?.site.status === 'draft'
            timer = setTimeout(tick, active ? POLL_ACTIVE_MS : POLL_IDLE_MS)
        }

        void tick()
        return () => {
            cancelled = true
            if (timer) clearTimeout(timer)
        }
    }, [fetchStatus])

    const redeploy = useCallback(async () => {
        setRedeploying(true)
        setRedeployMsg(null)
        try {
            const res = await fetch(`/api/sites/${encodeURIComponent(site.id)}/redeploy`, { method: 'POST' })
            if (!res.ok) {
                const data = (await res.json().catch(() => ({}))) as { error?: unknown }
                setRedeployMsg(redeployError(data.error, res.status))
                return
            }
            setRedeployMsg('Redeploy started — Perch is fetching the latest commit.')
            // Pull a fresh reading so the build card flips to "running" promptly.
            try {
                const next = await fetchStatus()
                setPayload(next)
            } catch {
                /* the poll loop will catch up */
            }
        } catch {
            setRedeployMsg('Network error starting the redeploy. Check your connection and try again.')
        } finally {
            setRedeploying(false)
        }
    }, [site.id, fetchStatus])

    const view = useMemo(
        () => (payload ? buildSiteDashboard(payload, limits, accountUsage) : null),
        [payload, limits, accountUsage],
    )

    // ── tc-* element refs (object props flow through lib/tc.ts) ──────────────────
    const statusCardRef = useTc<HTMLElement>(useMemo(() => ({ items: view?.statusItems ?? [] }), [view]))
    const usageRef = useTc<HTMLElement>(useMemo(() => ({ usage: view?.usage ?? [] }), [view]))
    const terminalRef = useTc<HTMLElement>(useMemo(() => ({ lines: view?.log ?? [] }), [view]))

    const loading = !view
    const head = view?.headline

    return (
        <section className="perch-site" aria-label={`Site ${site.hostname}`}>
            <header className="perch-site-header">
                <div className="perch-site-id">
                    <h2 className="perch-site-host">{site.hostname}</h2>
                    <p className="perch-site-source">
                        {site.repoOwner}/{site.repoName} · {site.branch}
                        {site.subdir ? ` · ${site.subdir}` : ''}
                    </p>
                </div>
                {head ? (
                    <tc-status-dot status={head.dot} label={head.label} pulse={head.pulse || undefined} />
                ) : (
                    <tc-status-dot status="away" label="Loading…" />
                )}
            </header>

            {loadError && (
                <p className="perch-site-loaderror" role="alert">
                    Couldn’t reach the deploy engine for live status. Retrying…
                </p>
            )}

            {/* Last-known-good semantics, stated plainly (§9 step 5). */}
            <p className="perch-site-note">{view?.lastKnownGood ?? 'Loading deploy status…'}</p>

            <div className="perch-site-grid">
                <div className="perch-site-col">
                    {/* Last deploy + Redeploy */}
                    {view ? (
                        <tc-build
                            name={view.build.name}
                            status={view.build.status}
                            date={view.build.date}
                            size={view.build.size}
                            badge={view.build.badge}
                            badge-variant={view.build.badgeVariant}
                        />
                    ) : (
                        <tc-build loading name={site.hostname} />
                    )}
                    <div className="perch-site-actions">
                        <tc-button variant="secondary" onClick={redeploy} disabled={redeploying || undefined}>
                            {redeploying ? 'Redeploying…' : 'Redeploy'}
                        </tc-button>
                        {redeployMsg && (
                            <span className="perch-site-redeploy-msg" role="status">
                                {redeployMsg}
                            </span>
                        )}
                    </div>

                    <tc-status-card ref={statusCardRef} title="Status" loading={loading || undefined} />
                </div>

                <div className="perch-site-col">
                    <tc-usage-summary-panel ref={usageRef} title="Storage" loading={loading || undefined} />
                </div>
            </div>

            <tc-terminal-window ref={terminalRef} title={`deploy · ${site.hostname}`} prompt="❯" />
        </section>
    )
}
