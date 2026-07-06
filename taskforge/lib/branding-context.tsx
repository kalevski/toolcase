'use client'

// Client branding context. Fetches the PUBLIC `GET /api/settings` once on mount and
// shares the effective instance branding down the tree, so the sidebar brand and the
// login logo read the live wordmark / secondary text / label / accent instead of
// hardcoding them. It also applies the chosen theme + accent variant to the document
// root (`data-tc-theme` / `data-tc-variant`), which re-skins every `tc-*` component
// at once.
//
// `domain/site-settings.ts` is pure (no `server-only`), so importing the type +
// defaults here is safe. Until the fetch resolves the context serves DEFAULT_SETTINGS
// (empty secondary text), so there is no flash of mismatched branding.
//
// `refresh()` lets the admin Settings page re-pull after a save so the brand updates
// live without a full reload.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, type SiteSettings } from '@/server/domain/site-settings'
import { apiFetch } from './fetcher'

interface BrandingValue extends SiteSettings {
    /** Re-fetch the public settings (used after an admin saves the Settings form). */
    refresh: () => Promise<void>
}

const BrandingContext = createContext<BrandingValue | null>(null)

export function BrandingProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)

    const refresh = useCallback(async () => {
        try {
            const s = await apiFetch<SiteSettings>('/api/settings')
            if (s) setSettings(s)
        } catch {
            /* keep the current (default) branding on a network error */
        }
    }, [])

    useEffect(() => {
        void refresh()
    }, [refresh])

    // Apply the theme + accent variant to the document root. `default` is the global
    // `:root` voice, so it normally carries NO attribute — EXCEPT when a variant is
    // active: the variant selectors are double-attribute scoped
    // (`[data-tc-theme='default'][data-tc-variant='ocean']`), so the explicit
    // `data-tc-theme="default"` must be present for the variant to take effect.
    useEffect(() => {
        const root = document.documentElement
        const variant = settings.themeVariant
        if (settings.theme && settings.theme !== 'default') {
            root.setAttribute('data-tc-theme', settings.theme)
        } else if (variant) {
            root.setAttribute('data-tc-theme', 'default')
        } else {
            root.removeAttribute('data-tc-theme')
        }
        if (variant) root.setAttribute('data-tc-variant', variant)
        else root.removeAttribute('data-tc-variant')
    }, [settings.theme, settings.themeVariant])

    return <BrandingContext.Provider value={{ ...settings, refresh }}>{children}</BrandingContext.Provider>
}

/** The live instance branding. Falls back to defaults outside a provider. */
export function useBranding(): BrandingValue {
    const value = useContext(BrandingContext)
    if (!value) return { ...DEFAULT_SETTINGS, refresh: async () => {} }
    return value
}
