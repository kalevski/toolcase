'use client'

// Admin → Settings (quaykeeper §13 mirror): instance branding + theme. Theme
// covers every bundled @toolcase/web-components skin × every accent variant
// (base + all eleven). Saving PUTs the changed fields, re-pulls the public
// branding so the theme + brand re-skin live, and toasts.

import { useCallback, useEffect, useState } from 'react'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { useBranding } from '@/lib/branding-context'
import { useToast } from '@/components/Toast'
import { TextField, SelectField, ColorField, type SelectOption } from '@/components/fields'
import { LoadingState, ErrorState } from '@/components/states'
import {
    THEME_NAMES,
    THEME_LABEL,
    THEME_VARIANTS,
    THEME_VARIANT_LABEL,
    isThemeName,
    isThemeVariant,
    type SiteSettings,
    type ThemeName,
    type ThemeVariant,
} from '@/server/domain/settings'

// One flat dropdown over every theme × variant combo. The option value encodes
// the pair as `theme` (base accents) or `theme:variant`; encode/decode
// round-trip through the two stored settings fields.
const THEME_OPTIONS: SelectOption[] = THEME_NAMES.flatMap((t) => [
    { value: t, label: THEME_LABEL[t] },
    ...THEME_VARIANTS.map((v) => ({ value: `${t}:${v}`, label: `${THEME_LABEL[t]} · ${THEME_VARIANT_LABEL[v]}` })),
])

function encodeTheme(theme: ThemeName, variant: ThemeVariant | ''): string {
    return variant ? `${theme}:${variant}` : theme
}

function decodeTheme(value: string): { theme: ThemeName; themeVariant: ThemeVariant | '' } {
    const [theme, variant] = value.split(':')
    return {
        theme: isThemeName(theme) ? theme : 'default',
        themeVariant: isThemeVariant(variant) ? variant : '',
    }
}

// Quick-pick brand swatches (a spread of hues). The picker's footer hex input
// still accepts any #rgb/#rrggbb, so this is convenience, not a limit.
const BRAND_SWATCHES = [
    '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#64748b', '#475569', '#111827',
]

export function SettingsClient() {
    const toast = useToast()
    const branding = useBranding()
    const [data, setData] = useState<SiteSettings | null>(null)
    const [error, setError] = useState<string | null>(null)

    const [appName, setAppName] = useState('')
    const [tagline, setTagline] = useState('')
    const [secondaryText, setSecondaryText] = useState('')
    // Combined `theme:variant` picker value (see encodeTheme/decodeTheme).
    const [theme, setTheme] = useState('default')
    const [brandColor, setBrandColor] = useState('')
    const [busy, setBusy] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)

    // Seed the form from the persisted record (and re-seed after a save).
    const seed = useCallback((s: SiteSettings) => {
        setAppName(s.appName)
        setTagline(s.tagline)
        setSecondaryText(s.secondaryText)
        setTheme(encodeTheme(s.theme, s.themeVariant))
        setBrandColor(s.brandColor)
    }, [])

    const load = useCallback(async () => {
        setError(null)
        try {
            const res = await apiFetch<SiteSettings>('/api/admin/settings')
            setData(res)
            seed(res)
        } catch (err) {
            setError(describeApiError(err))
        }
    }, [seed])

    useEffect(() => {
        void load()
    }, [load])

    const save = useCallback(async () => {
        if (busy) return
        setBusy(true)
        setSaveError(null)
        try {
            const updated = await apiFetch<SiteSettings>('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appName,
                    tagline,
                    secondaryText,
                    ...decodeTheme(theme),
                    brandColor,
                }),
            })
            setData(updated)
            seed(updated)
            // Re-pull the public branding so the theme + brand re-skin live.
            await branding.refresh()
            toast.show('Settings saved', { variant: 'success' })
        } catch (err) {
            setSaveError(describeApiError(err))
        } finally {
            setBusy(false)
        }
    }, [busy, appName, tagline, secondaryText, theme, brandColor, seed, branding, toast])

    if (error) return <ErrorState message={error} onRetry={load} />
    if (!data) return <LoadingState shape="detail" />

    return (
        <div className="voxscribe-page">
            <h1>Settings</h1>
            <p className="voxscribe-muted">
                Instance branding and theme. Changes apply live for everyone — no redeploy needed.
            </p>

            <form
                className="voxscribe-settings"
                onSubmit={(e) => {
                    e.preventDefault()
                    void save()
                }}
            >
                {saveError && <tc-banner variant="error">{saveError}</tc-banner>}

                <div className="voxscribe-card voxscribe-settings-grid">
                    <TextField
                        label="Application name"
                        value={appName}
                        onValue={setAppName}
                        placeholder="voxscribe"
                        help="Shown in the sidebar brand, the login screen, and the browser tab."
                        disabled={busy}
                        required
                    />
                    <SelectField
                        label="Theme"
                        value={theme}
                        onValue={setTheme}
                        options={THEME_OPTIONS}
                        help="Every bundled skin × accent variant (base plus all eleven variants)."
                        disabled={busy}
                    />
                    <TextField
                        label="Tagline"
                        value={tagline}
                        onValue={setTagline}
                        placeholder="Self-hosted audio transcription studio with tagged markdown notes."
                        help="One line under the brand on the login screen."
                        disabled={busy}
                    />
                    <TextField
                        label="Secondary brand text"
                        value={secondaryText}
                        onValue={setSecondaryText}
                        placeholder="transcription studio"
                        help="Optional second phrase shown inline after the app name in the brand. Leave blank for none."
                        disabled={busy}
                    />
                    <ColorField
                        label="Brand colour"
                        value={brandColor}
                        onValue={setBrandColor}
                        colors={BRAND_SWATCHES}
                        help="Brand underline / login logo colour. Pick a swatch or enter a hex; the theme accent is used until one is set."
                        disabled={busy}
                    />
                </div>

                <div className="voxscribe-actions-row">
                    <tc-button type="submit" variant="primary" disabled={!appName.trim() || busy || undefined}>
                        {busy ? 'Saving…' : 'Save settings'}
                    </tc-button>
                </div>
            </form>
        </div>
    )
}
