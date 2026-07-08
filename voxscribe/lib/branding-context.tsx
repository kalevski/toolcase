'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiFetch } from '@/lib/fetcher'
import { DEFAULT_SETTINGS, type SiteSettings } from '@/server/domain/settings'

// Client branding context (quaykeeper §13 mirror). Fetches the PUBLIC
// `GET /api/settings` once on mount and shares the effective instance branding
// down the tree, so the shell brand, the login screen and the tab title read
// live values instead of hardcoding "voxscribe". It also applies the chosen
// theme to the document root (`data-tc-theme` / `data-tc-variant`), which
// re-skins every `tc-*` component at once.
//
// `domain/settings.ts` is pure (no `server-only`), so importing the type +
// defaults here is safe. Until the fetch resolves the context serves
// DEFAULT_SETTINGS — which equals the previous hardcoded values, so there is
// no flash of mismatched branding.
//
// `refresh()` lets the admin Settings page re-pull after a save so the theme +
// brand update live without a full reload.

interface BrandingValue extends SiteSettings {
    /** Re-fetch the public settings (used after an admin saves the Settings form). */
    refresh: () => Promise<void>
}

const BrandingContext = createContext<BrandingValue | null>(null)

export function BrandingProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)

    const refresh = useCallback(async () => {
        try {
            setSettings(await apiFetch<SiteSettings>('/api/settings'))
        } catch {
            /* keep the current (default) branding on a network error */
        }
    }, [])

    useEffect(() => {
        void refresh()
    }, [refresh])

    // Apply the theme to the document root. `default` is the global `:root`
    // voice, so it carries NO attribute; every other skin is scoped under
    // `[data-tc-theme="…"]`. The accent variant rides along as
    // `data-tc-variant` — variant partials are scoped
    // `[data-tc-theme='x'][data-tc-variant='y']`, so the DEFAULT theme's
    // variants need the theme attribute set explicitly.
    useEffect(() => {
        const root = document.documentElement
        const needsThemeAttr = settings.theme !== 'default' || settings.themeVariant !== ''
        if (settings.theme && needsThemeAttr) {
            root.setAttribute('data-tc-theme', settings.theme)
        } else {
            root.removeAttribute('data-tc-theme')
        }
        if (settings.themeVariant) {
            root.setAttribute('data-tc-variant', settings.themeVariant)
        } else {
            root.removeAttribute('data-tc-variant')
        }
    }, [settings.theme, settings.themeVariant])

    return <BrandingContext.Provider value={{ ...settings, refresh }}>{children}</BrandingContext.Provider>
}

/** The live instance branding. Falls back to defaults outside a provider. */
export function useBranding(): BrandingValue {
    const value = useContext(BrandingContext)
    if (!value) return { ...DEFAULT_SETTINGS, refresh: async () => {} }
    return value
}
