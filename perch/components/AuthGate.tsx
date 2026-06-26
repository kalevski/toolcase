'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from './AppShell'
import { ToastProvider } from './Toast'
import { MeProvider } from '@/lib/me-context'
import { apiFetch, describeApiError, isAuthError } from '@/lib/fetcher'
import { reviveLimits, type MeResponse } from '@/server/domain/types'

type GateState =
    | { phase: 'loading' }
    | { phase: 'ready'; me: MeResponse }
    | { phase: 'error'; message: string }

/**
 * Client auth gate (§13, task 732). Fetches `GET /api/me` on mount; an
 * unauthenticated (401) or unprovisioned (403) caller is redirected to the login
 * screen, an authenticated one is handed to the dashboard shell. The identity is
 * shared down the tree via `MeProvider` (plan WS-3), so descendant views read it
 * with `useMe()` instead of refetching `/api/me`. A failed load shows a specific
 * message and an in-place Retry rather than a "refresh the page" dead end.
 */
export function AuthGate({ children }: { children: ReactNode }) {
    const router = useRouter()
    const [state, setState] = useState<GateState>({ phase: 'loading' })

    const load = useCallback(
        async (signal?: AbortSignal) => {
            setState({ phase: 'loading' })
            try {
                const me = await apiFetch<MeResponse>('/api/me', { signal })
                // Infinity limits arrive as null over JSON — revive once here so every
                // consumer reading from context sees unlimited as unlimited.
                me.limits = reviveLimits(me.limits)
                setState({ phase: 'ready', me })
            } catch (err) {
                if (signal?.aborted) return
                if (isAuthError(err)) {
                    router.replace('/login')
                    return
                }
                setState({ phase: 'error', message: describeApiError(err) })
            }
        },
        [router],
    )

    useEffect(() => {
        const ctrl = new AbortController()
        void load(ctrl.signal)
        return () => ctrl.abort()
    }, [load])

    if (state.phase === 'ready') {
        return (
            <MeProvider me={state.me}>
                <ToastProvider>
                    <AppShell me={state.me}>{children}</AppShell>
                </ToastProvider>
            </MeProvider>
        )
    }

    if (state.phase === 'error') {
        return (
            <div className="perch-gate-status" role="alert">
                <div className="perch-gate-error">
                    <p>{state.message}</p>
                    <tc-button variant="primary" size="sm" onClick={() => void load()}>
                        Try again
                    </tc-button>
                </div>
            </div>
        )
    }

    // Loading (and the brief moment before a redirect lands): a quiet, aria-busy
    // placeholder so there's no flash of unauthenticated content.
    return (
        <div className="perch-gate-status" role="status" aria-busy="true">
            <tc-spinner type="border" size="sm" />
            <span>Loading…</span>
        </div>
    )
}
