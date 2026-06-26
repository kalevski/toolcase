'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useMe } from '@/lib/me-context'
import { LoadingState, ErrorState } from '@/components/states'

// Shared plumbing for the owner-only admin pages (§13). Each admin surface
// (Sites, Users, Domains, Plans, Audit) lives at its own route and fetches only
// its own slice, but they all share the same gate: confirm the owner role first
// (the AuthGate only guarantees an authenticated user), redirect any non-owner
// away before requesting admin data, and render a consistent loading/error frame.
// Every backing /api/admin/** route is independently `authorize('owner')`-gated
// server-side, so this gate is a UX nicety, not the security boundary.
//
// The role now comes from `useMe()` (the identity AuthGate already fetched, plan
// WS-3) rather than a second `/api/me` round-trip per admin page.

/** Reject a non-OK response so a `Promise.all` of fetches fails fast. */
export const json = <T,>(r: Response): Promise<T> => (r.ok ? (r.json() as Promise<T>) : Promise.reject(r))

export type OwnerDataState<T> =
    | { phase: 'loading' }
    | { phase: 'forbidden' }
    | { phase: 'error' }
    | { phase: 'ready'; data: T }

/**
 * Confirm the owner role, then load an admin dataset via `fetcher`. Non-owners are
 * redirected to the dashboard and never see admin data. `reload` re-runs the
 * fetcher and swaps in the fresh data (used after a mutation, or by the error
 * Retry button).
 *
 * `fetcher` MUST be stable (wrap it in `useCallback` at the call site) — it is
 * intentionally omitted from the effect deps so confirming the role doesn't loop.
 */
export function useOwnerData<T>(fetcher: () => Promise<T | null>): {
    state: OwnerDataState<T>
    reload: () => Promise<void>
} {
    const router = useRouter()
    const me = useMe()
    const [state, setState] = useState<OwnerDataState<T>>({ phase: 'loading' })

    useEffect(() => {
        if (me.role !== 'owner') {
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
    }, [me.role, router])

    const reload = useCallback(async () => {
        setState({ phase: 'loading' })
        const data = await fetcher()
        setState(data ? { phase: 'ready', data } : { phase: 'error' })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return { state, reload }
}

/**
 * Frame one admin page: a titled section header plus the body for the current
 * load phase. `children` renders the ready data; loading/forbidden show shimmer
 * skeletons and error shows a banner with an in-place Retry (plan WS-4). Keeps all
 * five admin pages visually consistent without repeating the phase switch.
 */
export function AdminPage<T>({
    title,
    subtitle,
    state,
    onRetry,
    children,
}: {
    title: string
    subtitle?: string
    state: OwnerDataState<T>
    onRetry?: () => void
    children: (data: T) => ReactNode
}) {
    let body: ReactNode
    if (state.phase === 'ready') {
        body = children(state.data)
    } else if (state.phase === 'error') {
        body = (
            <ErrorState
                title="Couldn’t load this page"
                message="The admin data didn’t come back. This is usually temporary."
                onRetry={onRetry}
            />
        )
    } else {
        body = <LoadingState shape="rows" count={4} />
    }

    return (
        <section className="perch-admin">
            <header className="perch-home-header">
                <h1 className="perch-home-title">{title}</h1>
                {subtitle && <p className="perch-home-lead">{subtitle}</p>}
            </header>
            {body}
        </section>
    )
}
