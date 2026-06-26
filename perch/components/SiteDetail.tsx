'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SiteDashboard } from './SiteDashboard'
import { LoadingState, ErrorState, EmptyState } from './states'
import { useMe } from '@/lib/me-context'
import { ApiError, apiFetch, describeApiError } from '@/lib/fetcher'
import { type Site } from '@/server/domain/types'

// Per-site page body (`/sites/{id}`, §14). Reads the owner context (plan limits +
// account usage) from `useMe()` and fetches the one site row (`/api/sites/{id}`),
// then hands them to the full live `SiteDashboard`. A back link returns to the
// card grid; a failed load shows a specific message with an in-place Retry.

type LoadState =
    | { phase: 'loading' }
    | { phase: 'error'; notFound: boolean; message: string }
    | { phase: 'ready'; site: Site }

export function SiteDetail({ siteId }: { siteId: string }) {
    const router = useRouter()
    const me = useMe()
    const [state, setState] = useState<LoadState>({ phase: 'loading' })

    const load = useCallback(async (signal?: AbortSignal) => {
        setState({ phase: 'loading' })
        try {
            const site = await apiFetch<Site>(`/api/sites/${encodeURIComponent(siteId)}`, { signal })
            setState({ phase: 'ready', site })
        } catch (err) {
            if (signal?.aborted) return
            const notFound = err instanceof ApiError && (err.kind === 'notfound' || err.kind === 'forbidden')
            setState({ phase: 'error', notFound, message: describeApiError(err) })
        }
    }, [siteId])

    useEffect(() => {
        const ctrl = new AbortController()
        void load(ctrl.signal)
        return () => ctrl.abort()
    }, [load])

    const back = (
        <button type="button" className="perch-back" onClick={() => router.push('/')}>
            ← All sites
        </button>
    )

    if (state.phase === 'loading') {
        return (
            <section className="perch-home perch-home--wide">
                {back}
                <LoadingState shape="detail" label="Loading site…" />
            </section>
        )
    }

    if (state.phase === 'error') {
        return (
            <section className="perch-home perch-home--wide">
                {back}
                {state.notFound ? (
                    <EmptyState
                        icon="search-x"
                        title="Site not found"
                        description="It may have been deleted, or you don’t have access to it."
                    >
                        <tc-button variant="primary" size="sm" onClick={() => router.push('/')}>
                            Back to your sites
                        </tc-button>
                    </EmptyState>
                ) : (
                    <ErrorState title="Couldn’t load this site" message={state.message} onRetry={() => void load()} />
                )}
            </section>
        )
    }

    return (
        <section className="perch-home perch-home--wide">
            {back}
            <SiteDashboard
                site={state.site}
                limits={me.limits}
                accountUsage={me.usage}
                onDeleted={() => router.push('/')}
            />
        </section>
    )
}
