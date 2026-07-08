'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ToastProvider } from '@/components/Toast'

/**
 * `tc-*` custom elements register via `customElements.define` (browser-only) and
 * upgrade client-side, so the library is imported DYNAMICALLY inside the effect:
 * a static import would evaluate its `class … extends HTMLElement` definitions
 * during SSR/prerender, where `HTMLElement` is undefined. `register()` is
 * idempotent.
 *
 * Children are gated behind `register()` resolving: React attaches refs and sets
 * JS *properties* (objects/arrays via `lib/tc.ts`) at attach time, and on an
 * as-yet-undefined element those land as OWN data properties that shadow the
 * class's prototype setter after upgrade — components silently render empty.
 * Gating removes the race.
 */
export function Providers({ children }: { children: ReactNode }) {
    const [registered, setRegistered] = useState(false)
    useEffect(() => {
        let active = true
        void import('@toolcase/web-components').then((m) => {
            if (!active) return
            m.register()
            setRegistered(true)
        })
        return () => {
            active = false
        }
    }, [])

    if (!registered) return null

    return <ToastProvider>{children}</ToastProvider>
}
