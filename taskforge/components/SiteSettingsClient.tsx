'use client'

// Admin-only instance settings — the full branding + appearance surface:
// the brand wordmark, optional second word, small brand label and accent color
// (everything `tc-brand` renders), plus the tc-* theme and its accent variant
// applied to the whole instance. Loads from `GET /api/admin/settings`, saves via
// `PUT`, then re-pulls the public branding so brand + theme update live.

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from '@/lib/toast'
import { apiFetch, describeApiError, isAuthError } from '@/lib/fetcher'
import { useTc, useTcEvents, detailValue } from '@/lib/tc'
import { tcIcon } from '@/lib/icons'
import { useBranding } from '@/lib/branding-context'
import { ErrorState, LoadingState } from './states'
import {
    THEME_NAMES,
    THEME_LABEL,
    VARIANT_NAMES,
    VARIANT_LABEL,
    DEFAULT_SETTINGS,
    type SiteSettings,
    type ThemeName,
    type VariantName,
} from '@/server/domain/site-settings'

const THEME_ITEMS = THEME_NAMES.map((t) => ({ key: t, label: THEME_LABEL[t] }))

// Preset swatches for the brand accent picker (the panel's hex field still
// accepts any custom color). First entry is the shipped default.
const BRAND_COLORS = [
    { value: DEFAULT_SETTINGS.brandColor, label: 'Violet (default)' },
    { value: '#8e44ad', label: 'Purple' },
    { value: '#e84393', label: 'Pink' },
    { value: '#e74c3c', label: 'Red' },
    { value: '#e67e22', label: 'Orange' },
    { value: '#f39c12', label: 'Amber' },
    { value: '#27ae60', label: 'Green' },
    { value: '#1abc9c', label: 'Teal' },
    { value: '#3498db', label: 'Blue' },
    { value: '#2980b9', label: 'Deep blue' },
    { value: '#34495e', label: 'Navy' },
    { value: '#64748b', label: 'Slate' },
]

/** Expand `#rgb` (the picker's hex field accepts it) to the `#rrggbb` the API requires. */
function normalizeHex(v: string): string {
    return /^#[0-9a-fA-F]{3}$/.test(v) ? '#' + [...v.slice(1)].map((c) => c + c).join('') : v
}
// tc-extended-select needs a non-empty key per item; the base-accents variant is
// stored as '' so it maps through a sentinel key here.
const VARIANT_NONE = 'none'
const VARIANT_ITEMS = VARIANT_NAMES.map((v) => ({ key: v || VARIANT_NONE, label: VARIANT_LABEL[v] }))

export function SiteSettingsClient() {
    const branding = useBranding()

    const [ready, setReady] = useState(false)
    const [bootErr, setBootErr] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [primaryText, setPrimaryText] = useState(DEFAULT_SETTINGS.primaryText)
    const [secondaryText, setSecondaryText] = useState('')
    const [brandLabel, setBrandLabel] = useState('')
    const [brandColor, setBrandColor] = useState(DEFAULT_SETTINGS.brandColor)
    const [theme, setTheme] = useState<ThemeName>('default')
    const [themeVariant, setThemeVariant] = useState<VariantName>('')

    useEffect(() => {
        const ctrl = new AbortController()
        ;(async () => {
            try {
                const s = await apiFetch<SiteSettings>('/api/admin/settings', { signal: ctrl.signal })
                if (ctrl.signal.aborted) return
                setPrimaryText(s.primaryText)
                setSecondaryText(s.secondaryText)
                setBrandLabel(s.brandLabel)
                setBrandColor(s.brandColor)
                setTheme(s.theme)
                setThemeVariant(s.themeVariant)
                setReady(true)
            } catch (e) {
                // A caller abort (unmount) re-throws as-is — ignore it.
                if (ctrl.signal.aborted) return
                setBootErr(isAuthError(e) ? 'Only the owner can manage instance settings.' : 'Couldn’t load settings.')
            }
        })()
        return () => ctrl.abort()
    }, [])

    const primaryTextRef = useTcEvents<HTMLElement>({
        input: (e) => setPrimaryText((e.target as HTMLInputElement).value),
    })
    const secondaryTextRef = useTcEvents<HTMLElement>({
        input: (e) => setSecondaryText((e.target as HTMLInputElement).value),
    })
    const brandLabelRef = useTcEvents<HTMLElement>({
        input: (e) => setBrandLabel((e.target as HTMLInputElement).value),
    })
    const brandColorTc = useTc<HTMLElement>(
        useMemo(() => ({ colors: BRAND_COLORS, value: brandColor }), [brandColor]),
        {
            'tc-change': (e: Event) => {
                const v = detailValue<string>(e)
                if (v) setBrandColor(normalizeHex(v))
            },
        },
    )

    const themeTc = useTc<HTMLElement>(
        useMemo(() => ({ items: THEME_ITEMS, value: theme }), [theme]),
        { 'tc-change': (e: Event) => setTheme((detailValue<string>(e) as ThemeName) ?? 'default') },
    )
    const variantTc = useTc<HTMLElement>(
        useMemo(() => ({ items: VARIANT_ITEMS, value: themeVariant || VARIANT_NONE }), [themeVariant]),
        {
            'tc-change': (e: Event) => {
                const key = detailValue<string>(e)
                setThemeVariant(key === VARIANT_NONE || !key ? '' : (key as VariantName))
            },
        },
    )

    const save = async () => {
        if (busy) return
        setBusy(true)
        try {
            await apiFetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ primaryText, secondaryText, brandLabel, brandColor, theme, themeVariant }),
            })
            // Re-pull the public branding so the brand + theme update live.
            await branding.refresh()
            toast.success('Settings saved.')
        } catch (e) {
            toast.error(`Couldn’t save settings: ${describeApiError(e)}`)
        } finally {
            setBusy(false)
        }
    }

    if (bootErr) return <ErrorState message={bootErr} />
    if (!ready) return <LoadingState />

    return (
        <div className="taskforge-page">
            <tc-rich-page-header
                title-text="Settings"
                icon-name={tcIcon('gear')}
                icon-color="violet"
                description="Instance branding & appearance — admin only."
            />

            <tc-card>
                <tc-heading slot="header" as="h3">
                    Brand
                </tc-heading>
                <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                    <tc-input
                        ref={primaryTextRef}
                        label="Primary brand text"
                        placeholder={DEFAULT_SETTINGS.primaryText}
                        value={primaryText}
                        help={`The wordmark shown in the sidebar brand and the login logo. Clear it to restore “${DEFAULT_SETTINGS.primaryText}”.`}
                        disabled={busy || undefined}
                    />
                    <tc-input
                        ref={secondaryTextRef}
                        label="Secondary brand text"
                        placeholder="cloud"
                        value={secondaryText}
                        help="Optional second word shown inline after the primary text. Leave blank for none."
                        disabled={busy || undefined}
                    />
                    <tc-input
                        ref={brandLabelRef}
                        label="Brand label"
                        placeholder="beta"
                        value={brandLabel}
                        help="Optional small tag rendered next to the brand (e.g. “beta”, “internal”). Leave blank for none."
                        disabled={busy || undefined}
                    />
                    <tc-color-picker
                        ref={brandColorTc}
                        label="Brand accent color"
                        columns={6}
                        help="The brand mark’s accent. Themes don’t change this — it’s your instance’s identity color."
                        disabled={busy || undefined}
                        style={{ maxWidth: '20rem' }}
                    />
                </tc-stack>
            </tc-card>

            <tc-card>
                <tc-heading slot="header" as="h3">
                    Appearance
                </tc-heading>
                <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                    <tc-extended-select
                        ref={themeTc}
                        label="Theme"
                        help="Re-skins every component. Applies live on save."
                        disabled={busy || undefined}
                        style={{ maxWidth: '20rem' }}
                    />
                    <tc-extended-select
                        ref={variantTc}
                        label="Accent variant"
                        help="Swaps only the theme’s primary/secondary accents — canvas, text and status colors stay the theme’s own."
                        disabled={busy || undefined}
                        style={{ maxWidth: '20rem' }}
                    />
                    <div>
                        <tc-button variant="primary" onClick={save} disabled={busy || undefined}>
                            {busy ? 'Saving…' : 'Save settings'}
                        </tc-button>
                    </div>
                </tc-stack>
            </tc-card>
        </div>
    )
}
