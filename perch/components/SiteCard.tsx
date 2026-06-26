'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { buildSiteDashboard, formatBytes, type SiteStatusPayload } from '@/server/domain/site-dashboard'
import type { PlanLimits, Site } from '@/server/domain/types'

// Summary card for one site (dashboard grid, §14). Shows just enough to scan —
// hostname, repo source, live status dot, last deploy, and storage — and links to
// the full per-site page (`/sites/{id}`) where `SiteDashboard` renders the detail.
//
// Polls `GET /api/sites/{id}/status` like the detail view, but only to drive the
// headline dot + a couple of figures; all derivation reuses the pure
// `domain/site-dashboard.ts` view-model so card and page never disagree.

const POLL_ACTIVE_MS = 5000
const POLL_IDLE_MS = 30000

export function SiteCard({ site, limits }: { site: Site; limits: PlanLimits }) {
    const router = useRouter()
    const [payload, setPayload] = useState<SiteStatusPayload | null>(null)
    // Track a fetch failure so a backend outage reads as "Status unavailable"
    // rather than a perpetual "Loading…" dot (plan Phase 4).
    const [errored, setErrored] = useState(false)

    const statusUrl = `/api/sites/${encodeURIComponent(site.id)}/status`
    const href = `/sites/${encodeURIComponent(site.id)}`

    const fetchStatus = useCallback(async (): Promise<SiteStatusPayload | null> => {
        const res = await fetch(statusUrl, { cache: 'no-store' })
        if (!res.ok) throw new Error(`status ${res.status}`)
        return (await res.json()) as SiteStatusPayload
    }, [statusUrl])

    useEffect(() => {
        let cancelled = false
        let timer: ReturnType<typeof setTimeout> | undefined

        const tick = async () => {
            let latest: SiteStatusPayload | null = null
            try {
                latest = await fetchStatus()
                if (cancelled) return
                setPayload(latest)
                setErrored(false)
            } catch {
                /* keep last reading; the next tick retries */
                if (!cancelled) setErrored(true)
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

    const view = useMemo(() => (payload ? buildSiteDashboard(payload, limits) : null), [payload, limits])
    const head = view?.headline

    const go = useCallback(() => router.push(href), [router, href])
    const onKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                router.push(href)
            }
        },
        [router, href],
    )

    return (
        <article
            className="perch-card"
            role="link"
            tabIndex={0}
            onClick={go}
            onKeyDown={onKeyDown}
            aria-label={`Open ${site.hostname}`}
        >
            <header className="perch-card-header">
                <div className="perch-card-id">
                    <h2 className="perch-card-host">{site.hostname}</h2>
                    <p className="perch-card-source">
                        {site.repoOwner}/{site.repoName} · {site.branch}
                        {site.subdir ? ` · ${site.subdir}` : ''}
                    </p>
                </div>
                {head ? (
                    <tc-status-dot status={head.dot} label={head.label} pulse={head.pulse || undefined} />
                ) : (
                    <tc-status-dot status="away" label={errored ? 'Status unavailable' : 'Loading…'} />
                )}
            </header>

            <dl className="perch-card-meta">
                <div className="perch-card-stat">
                    <dt>Last deploy</dt>
                    <dd>{view?.build.date ?? '—'}</dd>
                </div>
                <div className="perch-card-stat">
                    <dt>Storage</dt>
                    <dd>
                        {formatBytes(view ? (payload?.nginxpilot?.bytes ?? site.bytes ?? 0) : site.bytes ?? 0)} /{' '}
                        {formatBytes(limits.maxBytesPerSite)}
                    </dd>
                </div>
            </dl>
        </article>
    )
}
