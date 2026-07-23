'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MetricGridItem } from '@toolcase/web-components'
import { CreateSiteWizard } from './CreateSiteWizard'
import { SiteCard } from './SiteCard'
import { LoadingState, ErrorState } from './states'
import { useTc, useTcProps } from '@/lib/tc'
import { useMe } from '@/lib/me-context'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { formatBytes, formatUtc } from '@/server/domain/site-dashboard'
import type { ExternalSite, Site, SitesOverview } from '@/server/domain/types'

// Dashboard content region (§14). Lists the signed-in user's sites as scannable
// `SiteCard`s — click one to open its full per-site page (`/sites/{id}`) — with a
// "New site" button that opens the create-site wizard (733) in a modal whenever
// the user is below their plan's site limit. A first-time user with no sites gets
// the same wizard behind a prominent call-to-action. Identity/plan come from
// `useMe()` (AuthGate already fetched it, plan WS-3); only `/api/sites/overview`
// is fetched — the stored sites plus live per-instance discovery, so sites that
// exist on a freshly-connected nginxpilot instance show up here too, each labelled
// with the instance it deploys on.

type LoadState =
    | { phase: 'loading' }
    | { phase: 'error'; message: string }
    | { phase: 'ready'; overview: SitesOverview }

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
            const overview = await apiFetch<SitesOverview>('/api/sites/overview')
            setState({ phase: 'ready', overview })
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
            <>
                <tc-rich-page-header
                    key="loading"
                    title-text="Your sites"
                    icon-name="layout-dashboard"
                    icon-color="blue"
                />
                <LoadingState shape="cards" count={3} label="Loading your sites…" />
            </>
        )
    }

    if (state.phase === 'error') {
        return (
            <section className="quaykeeper-home">
                <tc-rich-page-header
                    key="error"
                    title-text="Your sites"
                    icon-name="layout-dashboard"
                    icon-color="blue"
                />
                <ErrorState title="Couldn’t load your sites" message={state.message} onRetry={() => void load()} />
            </section>
        )
    }

    const { sites, realms, external, unreachable } = state.overview
    const canCreate = sites.length < me.limits.maxSites
    const hasSites = sites.length > 0
    // Label every card with its instance only when there's more than one to tell apart.
    const realmNames = new Map(realms.map((r) => [r.id, r.name]))
    const multiRealm = realms.length > 1

    // Plain-text lead for the header `description` attribute (the inline <strong> the
    // bespoke header carried isn't expressible as an attribute — a fair trade for the
    // shared, themed tc-rich-page-header used across every page).
    const lead = hasSites
        ? isFinite(me.limits.maxSites)
            ? `${sites.length} of ${me.limits.maxSites} site${me.limits.maxSites === 1 ? '' : 's'} on your account.`
            : `${sites.length} site${sites.length === 1 ? '' : 's'} — unlimited as the owner.`
        : 'Publish a branch of one of your GitHub repositories as a static website. Pick the repository and branch, choose a hostname, and Quaykeeper deploys it.'

    return (
        <section className="quaykeeper-home quaykeeper-home--wide">
            {/* Keyed per mode so the empty → has-sites transition mounts a FRESH
                header (the action button is present from connect, so the slot capture
                runs cleanly). Within a mode the title is constant and the action
                button stays mounted — only its `disabled` toggles — so the 30s poll
                re-renders never add/remove a relocated slot child. */}
            <tc-rich-page-header
                key={hasSites ? 'sites' : 'create'}
                title-text={hasSites ? 'Your sites' : 'Create a site'}
                icon-name="layout-dashboard"
                icon-color="blue"
                description={lead}
            >
                {hasSites && (
                    <tc-button
                        slot="actions"
                        variant="primary"
                        disabled={!canCreate || undefined}
                        title={canCreate ? undefined : 'You’ve reached your plan’s site limit.'}
                        onClick={openModal}
                    >
                        New site
                    </tc-button>
                )}
            </tc-rich-page-header>

            {hasSites ? (
                <>
                    {/* P6: a Wharf-style roll-up of the account totals opens the
                        dashboard. Sites + storage come from the server-computed
                        me.usage; custom domains are counted off the loaded sites. */}
                    <SitesMetrics sites={sites} />
                    <div className="quaykeeper-card-grid">
                        {sites.map((site) => (
                            <SiteCard
                                key={site.id}
                                site={site}
                                limits={me.limits}
                                realmName={multiRealm ? realmNames.get(site.realmId) : undefined}
                            />
                        ))}
                    </div>
                </>
            ) : canCreate ? (
                <div className="quaykeeper-home-empty">
                    <tc-button variant="primary" size="lg" onClick={openModal}>
                        Create your first site
                    </tc-button>
                </div>
            ) : (
                <p className="quaykeeper-home-lead">
                    You’ve reached your plan’s site limit. Delete a site or upgrade your plan.
                </p>
            )}

            {external.length > 0 && (
                <section className="quaykeeper-external-sites" aria-label="Sites found on connected instances">
                    <h2 className="quaykeeper-external-sites-title">Found on your instances</h2>
                    <p className="quaykeeper-external-sites-lead">
                        These sites are deployed on a connected nginxpilot instance but aren’t managed by
                        Quaykeeper — typically deployed before the instance was added.
                    </p>
                    <div className="quaykeeper-card-grid">
                        {external.map((entry) => (
                            <ExternalSiteCard key={`${entry.realmId}:${entry.domain}`} entry={entry} />
                        ))}
                    </div>
                </section>
            )}

            {unreachable.length > 0 && (
                <p className="quaykeeper-external-sites-warning" role="status">
                    Couldn’t check {unreachable.map((r) => r.realmName).join(', ')} for existing sites —{' '}
                    {unreachable.length === 1 ? 'the instance is' : 'those instances are'} unreachable right now.
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

/**
 * Read-only card for a site discovered on a connected nginxpilot instance that
 * Quaykeeper doesn't manage. Mirrors the SiteCard layout so the grid scans as one
 * surface, but links nowhere — there's no site row behind it — and says plainly
 * which instance it lives on.
 */
function ExternalSiteCard({ entry }: { entry: ExternalSite }) {
    const failing = !!entry.lastError
    const dot = entry.syncing ? 'away' : failing ? 'busy' : entry.neverSynced ? 'offline' : 'online'
    const label = entry.syncing ? 'Syncing' : failing ? 'Failing' : entry.neverSynced ? 'Never synced' : 'Live'
    const deployed = formatUtc(entry.lastSuccess)
    return (
        <article className="quaykeeper-card quaykeeper-card--external" aria-label={`${entry.domain} on ${entry.realmName}`}>
            <header className="quaykeeper-card-header">
                <div className="quaykeeper-card-id">
                    <h3 className="quaykeeper-card-host">{entry.domain}</h3>
                    <p className="quaykeeper-card-source">
                        {entry.sourceType} · {entry.sourceUrl}
                    </p>
                </div>
                <tc-status-dot status={dot} label={label} pulse={entry.syncing || undefined} />
            </header>
            <div className="quaykeeper-card-badges">
                <tc-badge variant="dark">{entry.realmName}</tc-badge>
                {entry.bytes != null && entry.bytes > 0 && (
                    <tc-badge variant="info">{formatBytes(entry.bytes)}</tc-badge>
                )}
                <tc-badge variant="secondary">Deployed {deployed || '—'}</tc-badge>
                <tc-badge variant="light">not managed by Quaykeeper</tc-badge>
            </div>
        </article>
    )
}

/**
 * Account roll-up shown above the site grid (P6) — Sites / Storage used / Custom
 * domains. `tc-metric-grid` is attribute + property driven (no slotted children),
 * so it's safely inside the relocation boundary. Sites + storage read the
 * server-computed `me.usage`; custom domains are counted off the loaded sites.
 */
function SitesMetrics({ sites }: { sites: Site[] }) {
    const me = useMe()
    const items = useMemo<MetricGridItem[]>(() => {
        const customDomains = sites.filter((s) => s.hostKind === 'custom').length
        const maxSites = me.limits.maxSites
        const maxBytes = me.limits.maxBytesTotal
        const maxCustom = me.limits.customDomains
        return [
            {
                key: 'sites',
                label: 'Sites',
                value: String(me.usage.siteCount),
                icon: 'LayoutDashboard',
                hint: isFinite(maxSites) ? `of ${maxSites} on your account` : 'unlimited',
            },
            {
                key: 'storage',
                label: 'Storage used',
                value: formatBytes(me.usage.totalBytes),
                icon: 'HardDrive',
                hint: isFinite(maxBytes) ? `of ${formatBytes(maxBytes)}` : 'unlimited',
            },
            {
                key: 'custom-domains',
                label: 'Custom domains',
                value: String(customDomains),
                icon: 'Globe',
                hint: isFinite(maxCustom) ? `of ${maxCustom} allowed` : 'unlimited',
            },
        ]
    }, [sites, me.usage.siteCount, me.usage.totalBytes, me.limits])
    const ref = useTcProps<HTMLElement>(useMemo(() => ({ items }), [items]))
    return <tc-metric-grid ref={ref} columns="3" className="quaykeeper-sites-metrics" />
}
