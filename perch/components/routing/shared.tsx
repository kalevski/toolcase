'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ROLE_RANK } from '@/server/domain/types'
import { useMe } from '@/lib/me-context'
import { LoadingState, ErrorState } from '@/components/states'

// Shared plumbing for the maintainer routing pages (Proxies, Upstreams) — the
// maintainer counterpart to `components/admin/shared.tsx`. Same gate shape, one
// rank up from owner-only: confirm the caller is a `maintainer` *or above* (so
// owners pass too), redirect anyone below away before requesting data, and render
// a consistent loading/error frame. Every backing `/api/routing/**` route is
// independently `authorize('maintainer')`-gated server-side, so this is a UX
// nicety, not the security boundary. The role comes from `useMe()` (plan WS-3).

/** Reject a non-OK response so a failed fetch surfaces as the error phase. */
export const json = <T,>(r: Response): Promise<T> => (r.ok ? (r.json() as Promise<T>) : Promise.reject(r))

export type RoutingDataState<T> =
    | { phase: 'loading' }
    | { phase: 'forbidden' }
    | { phase: 'error' }
    | { phase: 'ready'; data: T }

/**
 * Confirm the caller meets the `maintainer` rank, then load a routing dataset via
 * `fetcher`. Anyone below maintainer is redirected to the dashboard and never sees
 * routing data. `reload` re-runs the fetcher and swaps in fresh data (after a
 * mutation, or via the error Retry). `fetcher` MUST be stable (wrap in
 * `useCallback`) — it is intentionally omitted from the effect deps.
 */
export function useMaintainerData<T>(fetcher: () => Promise<T | null>): {
    state: RoutingDataState<T>
    reload: () => Promise<void>
} {
    const router = useRouter()
    const me = useMe()
    const [state, setState] = useState<RoutingDataState<T>>({ phase: 'loading' })

    useEffect(() => {
        if (ROLE_RANK[me.role] < ROLE_RANK.maintainer) {
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
 * Frame one routing page: a titled header plus the body for the current load
 * phase. `children` renders the ready data; loading/forbidden show shimmer
 * skeletons and error shows a banner with an in-place Retry (plan WS-4). Mirrors
 * `admin/shared.tsx`'s `AdminPage` so the routing pages stay visually consistent
 * with the admin surface (reuses the same `.perch-admin-*` layout classes).
 */
export function RoutingPage<T>({
    title,
    subtitle,
    icon,
    iconColor = 'cyan',
    state,
    onRetry,
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
    children: (data: T) => ReactNode
}) {
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
    // maintainer routing pages visually consistent with the owner admin surface.
    return (
        <section className="perch-admin">
            <tc-rich-page-header
                title-text={title}
                description={subtitle}
                icon-name={icon}
                icon-color={iconColor}
            />
            {body}
        </section>
    )
}
