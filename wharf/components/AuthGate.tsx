'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from './AppShell'
import { MeProvider } from '@/lib/me-context'
import { apiFetch, describeApiError, isAuthError } from '@/lib/fetcher'
import { type MeResponse } from '@/server/domain/types'

type GateState =
    | { phase: 'loading' }
    | { phase: 'ready'; me: MeResponse }
    | { phase: 'error'; message: string }

/**
 * Client auth gate. Fetches `GET /api/me` on mount; an unauthenticated (401) or
 * unprovisioned (403) caller is bounced to /login; an authenticated one is handed
 * to the dashboard shell. Identity is shared down the tree via `MeProvider`.
 */
export function AuthGate({ children }: { children: ReactNode }) {
    const router = useRouter()
    const [state, setState] = useState<GateState>({ phase: 'loading' })

    const load = useCallback(
        async (signal?: AbortSignal) => {
            setState({ phase: 'loading' })
            try {
                const me = await apiFetch<MeResponse>('/api/me', { signal })
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
                <AppShell me={state.me}>{children}</AppShell>
            </MeProvider>
        )
    }

    if (state.phase === 'error') {
        return (
            <div className="wharf-gate-status" role="alert">
                <div className="wharf-gate-error">
                    <p>{state.message}</p>
                    <tc-button variant="primary" size="sm" onClick={() => void load()}>
                        Try again
                    </tc-button>
                </div>
            </div>
        )
    }

    return (
        <div className="wharf-gate-status" role="status" aria-busy="true">
            <tc-spinner type="border" size="sm" />
            <span>Loading…</span>
        </div>
    )
}
