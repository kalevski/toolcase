'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from './AppShell'
import type { MeResponse } from '@/server/domain/types'

type GateState =
    | { phase: 'loading' }
    | { phase: 'ready'; me: MeResponse }
    | { phase: 'error' }

/**
 * Client auth gate (§13, task 732). Fetches `GET /api/me` on mount; an
 * unauthenticated (401) or unprovisioned (403) caller is redirected to the login
 * screen, an authenticated one is handed to the dashboard shell. The shell is
 * driven entirely by the freshly-fetched identity/plan/usage payload.
 */
export function AuthGate({ children }: { children: ReactNode }) {
    const router = useRouter()
    const [state, setState] = useState<GateState>({ phase: 'loading' })

    useEffect(() => {
        let cancelled = false
        fetch('/api/me', { cache: 'no-store' })
            .then(async (res) => {
                if (cancelled) return
                if (res.status === 401 || res.status === 403) {
                    router.replace('/login')
                    return
                }
                if (!res.ok) {
                    setState({ phase: 'error' })
                    return
                }
                const me = (await res.json()) as MeResponse
                if (!cancelled) setState({ phase: 'ready', me })
            })
            .catch(() => {
                if (!cancelled) setState({ phase: 'error' })
            })
        return () => {
            cancelled = true
        }
    }, [router])

    if (state.phase === 'ready') {
        return <AppShell me={state.me}>{children}</AppShell>
    }

    if (state.phase === 'error') {
        return (
            <div className="perch-gate-status" role="alert">
                Could not load your account. <a href="/login">Try signing in again.</a>
            </div>
        )
    }

    // Loading (and the brief moment before a redirect lands): a quiet, aria-busy
    // placeholder so there's no flash of unauthenticated content.
    return (
        <div className="perch-gate-status" role="status" aria-busy="true">
            Loading…
        </div>
    )
}
