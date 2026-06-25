'use client'

import { useEffect, useState } from 'react'
import { CreateSiteWizard } from './CreateSiteWizard'
import { SiteDashboard } from './SiteDashboard'
import type { MeResponse, Site } from '@/server/domain/types'

// Dashboard content region (§14). Lists the signed-in user's sites — each rendered
// as a live `SiteDashboard` (task 734) — and offers the create-site wizard (733)
// whenever the user is below their plan's site limit. A first-time user with no
// sites lands straight on the wizard.

type LoadState =
    | { phase: 'loading' }
    | { phase: 'error' }
    | { phase: 'ready'; me: MeResponse; sites: Site[] }

export function DashboardHome() {
    const [state, setState] = useState<LoadState>({ phase: 'loading' })

    useEffect(() => {
        let cancelled = false
        Promise.all([
            fetch('/api/me', { cache: 'no-store' }).then((r) => (r.ok ? (r.json() as Promise<MeResponse>) : Promise.reject(r))),
            fetch('/api/sites', { cache: 'no-store' }).then((r) => (r.ok ? (r.json() as Promise<Site[]>) : Promise.reject(r))),
        ])
            .then(([me, sites]) => {
                if (!cancelled) setState({ phase: 'ready', me, sites })
            })
            .catch(() => {
                if (!cancelled) setState({ phase: 'error' })
            })
        return () => {
            cancelled = true
        }
    }, [])

    if (state.phase === 'loading') {
        return (
            <section className="perch-home" role="status" aria-busy="true">
                <p className="perch-home-lead">Loading your sites…</p>
            </section>
        )
    }

    if (state.phase === 'error') {
        return (
            <section className="perch-home" role="alert">
                <h1 className="perch-home-title">Couldn’t load your sites</h1>
                <p className="perch-home-lead">Refresh the page to try again.</p>
            </section>
        )
    }

    const { me, sites } = state
    const canCreate = sites.length < me.limits.maxSites

    // First-time user: no sites yet — lead straight into the create wizard.
    if (sites.length === 0) {
        return (
            <section className="perch-home">
                <header className="perch-home-header">
                    <h1 className="perch-home-title">Create a site</h1>
                    <p className="perch-home-lead">
                        Publish a branch of one of your GitHub repositories as a static website. Pick the
                        repository and branch, choose a hostname, and Perch deploys it.
                    </p>
                </header>
                <CreateSiteWizard />
            </section>
        )
    }

    return (
        <section className="perch-home perch-home--wide">
            <header className="perch-home-header">
                <h1 className="perch-home-title">Your sites</h1>
                <p className="perch-home-lead">
                    {sites.length} of {me.limits.maxSites} site{me.limits.maxSites === 1 ? '' : 's'} on your{' '}
                    <strong>{me.plan}</strong> plan.
                </p>
            </header>

            <div className="perch-site-list">
                {sites.map((site) => (
                    <SiteDashboard key={site.id} site={site} limits={me.limits} accountUsage={me.usage} />
                ))}
            </div>

            {canCreate && (
                <section className="perch-home-create">
                    <h2 className="perch-home-subtitle">Create another site</h2>
                    <CreateSiteWizard />
                </section>
            )}
        </section>
    )
}
