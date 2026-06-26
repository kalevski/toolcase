'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTc, targetValue } from '@/lib/tc'
import { useToast } from './Toast'
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

const DELETE_ERROR_COPY: Record<string, string> = {
    unauthorized: 'Your session expired. Sign in again to delete this site.',
    site_not_found: 'This site no longer exists.',
    forbidden: 'You do not have access to this site.',
    nginxpilot_error: 'The deploy engine is unavailable right now. Try again shortly.',
    internal_error: 'Something went wrong deleting the site. Try again.',
}

function deleteError(code: unknown, status: number): string {
    if (typeof code === 'string' && DELETE_ERROR_COPY[code]) return DELETE_ERROR_COPY[code]
    if (typeof code === 'string' && code) return code
    return `Delete failed (HTTP ${status}).`
}

export function SiteDashboard({
    site,
    limits,
    accountUsage,
    onDeleted,
}: {
    site: Site
    limits: PlanLimits
    /** Account-wide usage, to add an "All your sites" storage bar beside the per-site one. */
    accountUsage?: SiteUsage
    /** Called after the site is deleted (204) — the parent navigates away from the gone page. */
    onDeleted?: () => void
}) {
    const toast = useToast()
    const [payload, setPayload] = useState<SiteStatusPayload | null>(null)
    const [loadError, setLoadError] = useState(false)
    const [redeploying, setRedeploying] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [deleteMsg, setDeleteMsg] = useState<string | null>(null)
    // Type-to-confirm: the user must type the hostname before Delete enables, so a
    // destructive, irreversible action can't be a single misclick.
    const [confirmText, setConfirmText] = useState('')

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
        try {
            const res = await fetch(`/api/sites/${encodeURIComponent(site.id)}/redeploy`, { method: 'POST' })
            if (!res.ok) {
                const data = (await res.json().catch(() => ({}))) as { error?: unknown }
                toast.show(redeployError(data.error, res.status), { variant: 'error', title: 'Redeploy failed' })
                return
            }
            toast.show('Redeploy started — Perch is fetching the latest commit.', { variant: 'success' })
            // Pull a fresh reading so the build card flips to "running" promptly.
            try {
                const next = await fetchStatus()
                setPayload(next)
            } catch {
                /* the poll loop will catch up */
            }
        } catch {
            toast.show('Network error starting the redeploy. Check your connection and try again.', {
                variant: 'error',
                title: 'Redeploy failed',
            })
        } finally {
            setRedeploying(false)
        }
    }, [site.id, fetchStatus, toast])

    // The type-to-confirm field; reads its value live into `confirmText`.
    const confirmInputRef = useTc<HTMLElement & { value: string }>(undefined, {
        input: (e: Event) => setConfirmText(targetValue(e)),
    })

    // Delete-confirm modal. `tc-hidden` clears any stale error AND the typed
    // confirmation so reopening is clean; the ref drives show()/hide() imperatively.
    const deleteModalRef = useTc<HTMLElement & { show(): void; hide(): void }>(undefined, {
        'tc-hidden': () => {
            setDeleteMsg(null)
            setConfirmText('')
            if (confirmInputRef.current) confirmInputRef.current.value = ''
        },
    })

    const canDelete = confirmText.trim() === site.hostname

    const confirmDelete = useCallback(async () => {
        if (confirmText.trim() !== site.hostname) return
        setDeleting(true)
        setDeleteMsg(null)
        try {
            const res = await fetch(`/api/sites/${encodeURIComponent(site.id)}`, { method: 'DELETE' })
            if (res.status === 204) {
                deleteModalRef.current?.hide()
                onDeleted?.()
                return
            }
            const data = (await res.json().catch(() => ({}))) as { error?: unknown }
            setDeleteMsg(deleteError(data.error, res.status))
        } catch {
            setDeleteMsg('Network error deleting the site. Check your connection and try again.')
        } finally {
            setDeleting(false)
        }
    }, [site.id, site.hostname, confirmText, onDeleted, deleteModalRef])

    const view = useMemo(
        () => (payload ? buildSiteDashboard(payload, limits, accountUsage) : null),
        [payload, limits, accountUsage],
    )

    // ── tc-* element refs (object props flow through lib/tc.ts) ──────────────────
    const statusCardRef = useTc<HTMLElement>(useMemo(() => ({ items: view?.statusItems ?? [] }), [view]))
    const usageRef = useTc<HTMLElement>(useMemo(() => ({ usage: view?.usage ?? [] }), [view]))

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
                        <tc-button
                            variant="danger"
                            outline
                            onClick={() => deleteModalRef.current?.show()}
                            disabled={deleting || undefined}
                        >
                            Delete site
                        </tc-button>
                    </div>

                    <tc-status-card ref={statusCardRef} title="Status" loading={loading || undefined} />
                </div>

                <div className="perch-site-col">
                    <tc-usage-summary-panel ref={usageRef} title="Storage" loading={loading || undefined} />
                </div>
            </div>

            {/* Delete confirmation. Body is one stable wrapper div (the modal relocates
                children into its body once at connect, so conditional content must live
                inside a node that's always present, not be a direct modal child). */}
            <tc-modal ref={deleteModalRef} title="Delete site" centered static-backdrop>
                <div className="perch-site-delete-body">
                    <p>
                        Permanently delete <strong>{site.hostname}</strong>? Perch removes its serving config and
                        deployed files. This cannot be undone.
                    </p>
                    <label className="perch-site-delete-confirm">
                        <span className="perch-wizard-field-label">
                            Type <strong>{site.hostname}</strong> to confirm
                        </span>
                        <tc-input ref={confirmInputRef} placeholder={site.hostname} autocomplete="off" />
                    </label>
                    {deleteMsg && <tc-banner variant="danger">{deleteMsg}</tc-banner>}
                </div>
                <tc-button
                    slot="footer"
                    variant="secondary"
                    outline
                    onClick={() => deleteModalRef.current?.hide()}
                    disabled={deleting || undefined}
                >
                    Cancel
                </tc-button>
                <tc-button
                    slot="footer"
                    variant="danger"
                    onClick={confirmDelete}
                    disabled={deleting || !canDelete || undefined}
                >
                    {deleting ? 'Deleting…' : 'Delete site'}
                </tc-button>
            </tc-modal>
        </section>
    )
}
