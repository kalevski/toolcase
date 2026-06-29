'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { BrandingProvider } from '@/lib/branding-context'

/**
 * `tc-*` custom elements register via `customElements.define` (browser-only), so
 * the library is imported DYNAMICALLY inside the effect — a static import would
 * evaluate `class … extends HTMLElement` during SSR, where `HTMLElement` is
 * undefined. Children are gated behind `register()` resolving so React never sets
 * JS properties on an un-upgraded element (which would shadow the prototype
 * setters and render the component empty). First client render returns null,
 * matching the server, so there is no hydration mismatch.
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
    return <BrandingProvider>{children}</BrandingProvider>
}
