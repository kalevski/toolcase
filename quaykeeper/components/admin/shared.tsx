'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useMe } from '@/lib/me-context'
import { LoadingState, ErrorState } from '@/components/states'

// The owner admin surface. Each area is its own page reached from a dedicated
// left-sidebar entry (AppShell builds the Admin nav section from this list), so
// there is no intra-section tab bar. Bare /admin has no page of its own — it
// redirects to Sites (app/admin/page.tsx).
export interface AdminNavItem {
    /** Stable key, also used as the side-nav item key. */
    id: string
    label: string
    /** Lucide glyph (kebab-case) for the side-nav + page-header icon. */
    icon: string
    /** Route this area lives at. */
    href: string
}

export const ADMIN_TABS: AdminNavItem[] = [
    { id: 'admin-sites', label: 'Sites', icon: 'layout-dashboard', href: '/admin/sites' },
    { id: 'admin-users', label: 'Users', icon: 'users', href: '/admin/users' },
    { id: 'admin-realms', label: 'NGINX Servers', icon: 'server', href: '/admin/realms' },
    // Database-management registry (quaykeeper_database_management.md §9): the servers
    // maintainers manage from /databases; connecting them is owner-only.
    { id: 'admin-db-servers', label: 'DB Servers', icon: 'database', href: '/admin/db-servers' },
    { id: 'admin-domains', label: 'Domains', icon: 'globe', href: '/admin/domains' },
    { id: 'admin-certificates', label: 'Certificates', icon: 'shield-check', href: '/admin/certificates' },
    // Config subsystem admin surfaces (move_wharf_to_perch.md §10): the global
    // variable/secret pools, owner-only.
    { id: 'admin-global-vars', label: 'Global variables', icon: 'variable', href: '/admin/global-vars' },
    { id: 'admin-secrets', label: 'Secrets', icon: 'lock', href: '/admin/secrets' },
    { id: 'admin-settings', label: 'Settings', icon: 'settings', href: '/admin/settings' },
    { id: 'admin-audit', label: 'Audit', icon: 'scroll-text', href: '/admin/audit' },
]

// Shared plumbing for the owner-only admin pages (§13). Each admin surface
// (Sites, Users, Domains, Audit) lives at its own route and fetches only
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
    icon,
    iconColor = 'slate',
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

    // tc-rich-page-header is attribute-driven with no slotted children here, so it
    // re-skins through the library tokens and stays consistent across every admin
    // page. Title/subtitle are static per page, so it never re-renders its subtree.
    return (
        <section className="quaykeeper-admin">
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
