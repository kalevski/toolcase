'use client'

import { useCallback, useEffect, useState } from 'react'
import { CreateSiteWizard } from './CreateSiteWizard'
import { SiteCard } from './SiteCard'
import { LoadingState, ErrorState } from './states'
import { useTc } from '@/lib/tc'
import { useMe } from '@/lib/me-context'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { type Site } from '@/server/domain/types'

// Dashboard content region (§14). Lists the signed-in user's sites as scannable
// `SiteCard`s — click one to open its full per-site page (`/sites/{id}`) — with a
// "New site" button that opens the create-site wizard (733) in a modal whenever
// the user is below their plan's site limit. A first-time user with no sites gets
// the same wizard behind a prominent call-to-action. Identity/plan come from
// `useMe()` (AuthGate already fetched it, plan WS-3); only `/api/sites` is fetched.

type LoadState =
    | { phase: 'loading' }
    | { phase: 'error'; message: string }
    | { phase: 'ready'; sites: Site[] }

export function DashboardHome() {
    const me = useMe()
    const [state, setState] = useState<LoadState>({ phase: 'loading' })
    // The create-site modal is mounted only while open: it mounts with the `open`
    // attribute (BsOverlay shows it on connect) and unmounts on `tc-hidden`. Mounting
    // the wizard fresh each time resets it for free and avoids fetching its repo list
    // on every page load — and, crucially, sidesteps the "tc-modal relocated my
    // children, then React re-rendered" staleness, since nothing reconciles the
    // modal's subtree while it's up.
    const [creating, setCreating] = useState(false)

    // Reload /api/sites. Runs once on mount and again whenever the modal closes, so
    // a freshly created site shows up in the grid. A failed reload keeps the last
    // good grid (better than blanking it to an error on a transient blip).
    const load = useCallback(async () => {
        try {
            const sites = await apiFetch<Site[]>('/api/sites')
            setState({ phase: 'ready', sites })
        } catch (err) {
            setState((prev) => (prev.phase === 'ready' ? prev : { phase: 'error', message: describeApiError(err) }))
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    // Refresh the grid on an interval so a deploy finishing elsewhere (or in the
    // create modal) shows up without a manual reload. Pause while the tab is hidden
    // to avoid pointless background churn (plan Phase 4). A failed reload keeps the
    // last good grid (see `load`).
    useEffect(() => {
        let timer: ReturnType<typeof setInterval> | undefined
        const start = () => {
            if (!timer) timer = setInterval(() => void load(), 30000)
        }
        const stop = () => {
            if (timer) {
                clearInterval(timer)
                timer = undefined
            }
        }
        const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop())
        if (document.visibilityState === 'visible') start()
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            stop()
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [load])

    // `tc-hidden` fires after the close animation (backdrop click, Esc, the ✕, or a
    // programmatic close): unmount the modal and refresh the list so a new site shows.
    const modalRef = useTc<HTMLElement>(undefined, {
        'tc-hidden': () => {
            setCreating(false)
            void load()
        },
    })
    const openModal = useCallback(() => setCreating(true), [])

    if (state.phase === 'loading') {
        return (
            <section className="perch-home perch-home--wide">
                <header className="perch-home-header">
                    <h1 className="perch-home-title">Your sites</h1>
                </header>
                <LoadingState shape="cards" count={3} label="Loading your sites…" />
            </section>
        )
    }

    if (state.phase === 'error') {
        return (
            <section className="perch-home">
                <header className="perch-home-header">
                    <h1 className="perch-home-title">Your sites</h1>
                </header>
                <ErrorState title="Couldn’t load your sites" message={state.message} onRetry={() => void load()} />
            </section>
        )
    }

    const { sites } = state
    const canCreate = sites.length < me.limits.maxSites
    const hasSites = sites.length > 0

    return (
        <section className={`perch-home${hasSites ? ' perch-home--wide' : ''}`}>
            <header className="perch-home-header perch-home-header--row">
                <div>
                    <h1 className="perch-home-title">{hasSites ? 'Your sites' : 'Create a site'}</h1>
                    <p className="perch-home-lead">
                        {hasSites ? (
                            isFinite(me.limits.maxSites) ? (
                                <>
                                    {sites.length} of {me.limits.maxSites} site
                                    {me.limits.maxSites === 1 ? '' : 's'} on your{' '}
                                    <strong>{me.plan}</strong> plan.
                                </>
                            ) : (
                                <>
                                    {sites.length} site{sites.length === 1 ? '' : 's'} —{' '}
                                    <strong>unlimited</strong> as the owner.
                                </>
                            )
                        ) : (
                            <>
                                Publish a branch of one of your GitHub repositories as a static website.
                                Pick the repository and branch, choose a hostname, and Perch deploys it.
                            </>
                        )}
                    </p>
                </div>
                {canCreate && hasSites && (
                    <tc-button variant="primary" onClick={openModal}>
                        New site
                    </tc-button>
                )}
            </header>

            {hasSites ? (
                <div className="perch-card-grid">
                    {sites.map((site) => (
                        <SiteCard key={site.id} site={site} limits={me.limits} />
                    ))}
                </div>
            ) : canCreate ? (
                <div className="perch-home-empty">
                    <tc-button variant="primary" size="lg" onClick={openModal}>
                        Create your first site
                    </tc-button>
                </div>
            ) : (
                <p className="perch-home-lead">
                    You’ve reached your plan’s site limit. Delete a site or upgrade your plan.
                </p>
            )}

            {creating && canCreate && (
                <tc-modal
                    ref={modalRef}
                    open
                    title="Create a site"
                    size="lg"
                    scrollable
                    centered
                    static-backdrop
                >
                    <CreateSiteWizard />
                </tc-modal>
            )}
        </section>
    )
}
