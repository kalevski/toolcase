'use client'

import { useEffect, useState, type ReactNode } from 'react'

/**
 * `tc-*` custom elements register via `customElements.define` (browser-only) and
 * upgrade client-side, so the library is imported DYNAMICALLY inside the effect:
 * a static import would evaluate its `class … extends HTMLElement` definitions
 * during SSR/prerender, where `HTMLElement` is undefined. `register()` is
 * idempotent.
 *
 * Children are gated behind `register()` resolving (`if (!registered) return null`).
 * They must NOT mount before the elements are defined: React attaches refs and
 * sets JS *properties* (objects/arrays via `lib/tc.ts`) at attach time, and on an
 * as-yet-undefined element those land as OWN data properties on the instance.
 * When the element later upgrades, that own property shadows the class's prototype
 * setter (e.g. `set sections`), so the setter never runs and the component renders
 * empty — components silently "disappear" on a hard refresh, where the dynamic
 * import loses the race to the first client render. Gating removes the race.
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

    // First client render returns null — same as the server output (the whole tree
    // is client-only behind AuthGate), so there is no hydration mismatch.
    if (!registered) return null

    return <>{children}</>
}
