'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ROLE_RANK } from '@/server/domain/types'
import { useMe } from '@/lib/me-context'
import { LoadingState, ErrorState } from '@/components/states'

// Shared plumbing for the Config subsystem's maintainer-gated pages (Instances
// list + detail, move_wharf_to_perch.md §7, §10) — the same gate shape as
// `routing/shared.tsx`'s `useMaintainerData`/`RoutingPage` (maintainer rank or
// above; every backing `/api/instances/**` route is independently
// `authorize('maintainer')`-gated server-side, so this is a UX nicety, not the
// security boundary).

export const json = <T,>(r: Response): Promise<T> => (r.ok ? (r.json() as Promise<T>) : Promise.reject(r))

export interface ApiResult<T = unknown> {
    ok: boolean
    status: number
    message?: string
    body?: T
}

/** One JSON mutation against a `/api/instances` or `/api/admin/*` Config route. */
export async function callApi<T = unknown>(url: string, method: string, payload?: unknown): Promise<ApiResult<T>> {
    try {
        const res = await fetch(url, {
            method,
            cache: 'no-store',
            headers: payload !== undefined ? { 'content-type': 'application/json' } : undefined,
            body: payload !== undefined ? JSON.stringify(payload) : undefined,
        })
        const text = await res.text()
        let parsed: unknown = null
        if (text) {
            try {
                parsed = JSON.parse(text)
            } catch {
                parsed = null
            }
        }
        const obj = (parsed ?? {}) as { error?: string; message?: string }
        if (!res.ok) {
            return { ok: false, status: res.status, message: obj.message || obj.error || `error ${res.status}`, body: parsed as T }
        }
        return { ok: true, status: res.status, body: parsed as T }
    } catch {
        return { ok: false, status: 0, message: 'network error' }
    }
}

export type ConfigDataState<T> =
    | { phase: 'loading' }
    | { phase: 'forbidden' }
    | { phase: 'error' }
    | { phase: 'ready'; data: T }

/**
 * Confirm the caller meets the `maintainer` rank, then load a Config dataset
 * via `fetcher`. `fetcher` MUST be stable (wrap in `useCallback`) — it is
 * intentionally omitted from the effect deps so confirming the role doesn't loop.
 */
export function useConfigData<T>(fetcher: () => Promise<T | null>): {
    state: ConfigDataState<T>
    reload: () => Promise<void>
} {
    const router = useRouter()
    const me = useMe()
    const [state, setState] = useState<ConfigDataState<T>>({ phase: 'loading' })

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

/** Frame one Config page: titled header + the body for the current load phase. */
export function ConfigPage<T>({
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
    icon?: string
    iconColor?: string
    state: ConfigDataState<T>
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
                message="The config data didn’t come back. This is usually temporary."
                onRetry={onRetry}
            />
        )
    } else {
        body = <LoadingState shape="rows" count={4} />
    }

    return (
        <section className="quaykeeper-admin">
            <tc-rich-page-header title-text={title} description={subtitle} icon-name={icon} icon-color={iconColor} />
            {body}
        </section>
    )
}
