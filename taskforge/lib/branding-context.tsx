'use client'

// Client branding context. Fetches the PUBLIC `GET /api/settings` once on mount and
// shares the effective instance branding down the tree, so the sidebar brand and the
// login logo read the live secondary brand text instead of hardcoding it. The brand
// wordmark ("Task Forge") + accent (#6c5ce7) stay fixed in the components.
//
// `domain/site-settings.ts` is pure (no `server-only`), so importing the type +
// defaults here is safe. Until the fetch resolves the context serves DEFAULT_SETTINGS
// (empty secondary text), so there is no flash of mismatched branding.
//
// `refresh()` lets the admin Settings page re-pull after a save so the brand updates
// live without a full reload.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, type SiteSettings } from '@/server/domain/site-settings'

interface BrandingValue extends SiteSettings {
    /** Re-fetch the public settings (used after an admin saves the Settings form). */
    refresh: () => Promise<void>
}

const BrandingContext = createContext<BrandingValue | null>(null)

export function BrandingProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)

    const refresh = useCallback(async () => {
        try {
            const res = await fetch('/api/settings', { cache: 'no-store' })
            if (!res.ok) return
            setSettings((await res.json()) as SiteSettings)
        } catch {
            /* keep the current (default) branding on a network error */
        }
    }, [])

    useEffect(() => {
        void refresh()
    }, [refresh])

    return <BrandingContext.Provider value={{ ...settings, refresh }}>{children}</BrandingContext.Provider>
}

/** The live instance branding. Falls back to defaults outside a provider. */
export function useBranding(): BrandingValue {
    const value = useContext(BrandingContext)
    if (!value) return { ...DEFAULT_SETTINGS, refresh: async () => {} }
    return value
}
