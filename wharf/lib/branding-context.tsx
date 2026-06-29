'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, type SiteSettings } from '@/server/domain/settings'

// Client branding context. Fetches the PUBLIC `GET /api/settings` once on mount and
// shares the effective instance branding down the tree, so the shell brand and the
// login screen read live values instead of hardcoding "Wharf" / `#0d9488`. It also
// applies the chosen theme to the document root (`data-tc-theme`), which re-skins
// every `tc-*` component at once, and keeps the browser-tab title in sync.
//
// `domain/settings.ts` is pure (no `server-only`), so importing the type + defaults
// here is safe. Until the fetch resolves the context serves DEFAULT_SETTINGS — which
// equals the previous hardcoded values, so there is no flash of mismatched branding.
//
// `refresh()` lets the admin Settings page re-pull after a save so the theme + brand
// update live without a full reload.

interface BrandingValue extends SiteSettings {
    /** Re-fetch the public settings (used after an owner saves the Settings form). */
    refresh: () => Promise<void>
}

const BrandingContext = createContext<BrandingValue | null>(null)

export function BrandingProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)

    const refresh = useCallback(async () => {
        try {
            const res = await fetch('/api/settings', { cache: 'no-store' })
            if (!res.ok) return
            const data = (await res.json()) as SiteSettings
            setSettings(data)
        } catch {
            /* keep the current (default) branding on a network error */
        }
    }, [])

    useEffect(() => {
        void refresh()
    }, [refresh])

    // Apply the theme to the document root. `default` is the global `:root` voice, so
    // it carries NO attribute; every other skin is scoped under `[data-tc-theme="…"]`.
    useEffect(() => {
        const root = document.documentElement
        if (settings.theme && settings.theme !== 'default') {
            root.setAttribute('data-tc-theme', settings.theme)
        } else {
            root.removeAttribute('data-tc-theme')
        }
    }, [settings.theme])

    // Keep the browser-tab title in sync with the app name.
    useEffect(() => {
        if (settings.appName) document.title = settings.appName
    }, [settings.appName])

    return <BrandingContext.Provider value={{ ...settings, refresh }}>{children}</BrandingContext.Provider>
}

/** The live instance branding. Falls back to defaults outside a provider. */
export function useBranding(): BrandingValue {
    const value = useContext(BrandingContext)
    if (!value) return { ...DEFAULT_SETTINGS, refresh: async () => {} }
    return value
}
