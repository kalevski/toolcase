'use client'

import { useEffect, type ReactNode } from 'react'

/**
 * `tc-*` custom elements register via `customElements.define` (browser-only) and
 * upgrade client-side, so the library is imported DYNAMICALLY inside the effect:
 * a static import would evaluate its `class … extends HTMLElement` definitions
 * during SSR/prerender, where `HTMLElement` is undefined. `register()` is
 * idempotent. Children render immediately — elements upgrade once registered,
 * with the `:not(:defined)` CSS fallback covering the brief pre-upgrade frame.
 */
export function Providers({ children }: { children: ReactNode }) {
    useEffect(() => {
        void import('@toolcase/web-components').then((m) => m.register())
    }, [])

    return <>{children}</>
}
