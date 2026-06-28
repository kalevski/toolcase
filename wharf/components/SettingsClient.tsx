'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch, describeApiError, isAuthError } from '@/lib/fetcher'
import { useTc, detailValue } from '@/lib/tc'
import { useBranding } from '@/lib/branding-context'
import { THEME_NAMES, THEME_LABEL, type SiteSettings, type ThemeName } from '@/server/domain/settings'

const THEME_ITEMS = THEME_NAMES.map((t) => ({ key: t, label: THEME_LABEL[t] }))

// Curated brand-accent swatches for the tc-color-picker. The picker's footer hex
// input still accepts any `#rgb`/`#rrggbb` value, so this is a shortcut, not a limit.
const BRAND_SWATCHES = [
    '#0d9488', '#0891b2', '#2563eb', '#7c3aed',
    '#db2777', '#dc2626', '#ea580c', '#d97706',
    '#ca8a04', '#16a34a', '#059669', '#475569',
]

// Owner-only global settings. Branding for this instance: app name, tagline, theme
// and brand colour. Saving PUTs the record, then re-pulls the public branding so the
// shell brand + theme re-skin live.
export function SettingsClient() {
    const branding = useBranding()

    const [ready, setReady] = useState(false)
    const [bootErr, setBootErr] = useState<string | null>(null)
    const [err, setErr] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)
    const [busy, setBusy] = useState(false)

    const [appName, setAppName] = useState('')
    const [tagline, setTagline] = useState('')
    const [theme, setTheme] = useState<ThemeName>('default')
    const [brandColor, setBrandColor] = useState('#0d9488')
    const [baseUrl, setBaseUrl] = useState('')
    const [agentUrl, setAgentUrl] = useState('')

    const appNameRef = useRef(appName)
    appNameRef.current = appName
    const taglineRef = useRef(tagline)
    taglineRef.current = tagline
    const themeRef = useRef(theme)
    themeRef.current = theme
    const brandColorRef = useRef(brandColor)
    brandColorRef.current = brandColor
    const baseUrlRef = useRef(baseUrl)
    baseUrlRef.current = baseUrl
    const agentUrlRef = useRef(agentUrl)
    agentUrlRef.current = agentUrl

    // ── boot ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        const ctrl = new AbortController()
        ;(async () => {
            try {
                const s = await apiFetch<SiteSettings>('/api/admin/settings', { signal: ctrl.signal })
                if (ctrl.signal.aborted) return
                setAppName(s.appName)
                setTagline(s.tagline)
                setTheme(s.theme)
                setBrandColor(s.brandColor)
                setBaseUrl(s.baseUrl)
                setAgentUrl(s.agentUrl)
                setReady(true)
            } catch (e) {
                if (ctrl.signal.aborted) return
                setBootErr(isAuthError(e) ? 'Only owners can manage instance settings.' : describeApiError(e))
            }
        })()
        return () => ctrl.abort()
    }, [])

    const save = useCallback(async () => {
        if (busy) return
        setBusy(true)
        setErr(null)
        setSaved(false)
        try {
            await apiFetch<SiteSettings>('/api/admin/settings', {
                method: 'PUT',
                body: JSON.stringify({
                    appName: appNameRef.current,
                    tagline: taglineRef.current,
                    theme: themeRef.current,
                    brandColor: brandColorRef.current,
                    baseUrl: baseUrlRef.current,
                    agentUrl: agentUrlRef.current,
                }),
            })
            // Re-pull the public branding so the brand + theme re-skin live.
            await branding.refresh()
            setSaved(true)
        } catch (e) {
            setErr(describeApiError(e))
        } finally {
            setBusy(false)
        }
    }, [busy, branding])

    const appNameTc = useTc<HTMLElement>(
        useMemo(() => ({ value: appName }), [appName]),
        { 'tc-change': (e: Event) => { setAppName(detailValue<string>(e) ?? ''); setSaved(false) } },
    )
    const taglineTc = useTc<HTMLElement>(
        useMemo(() => ({ value: tagline }), [tagline]),
        { 'tc-change': (e: Event) => { setTagline(detailValue<string>(e) ?? ''); setSaved(false) } },
    )
    const themeTc = useTc<HTMLElement>(
        useMemo(() => ({ items: THEME_ITEMS, value: theme }), [theme]),
        { 'tc-change': (e: Event) => { setTheme((detailValue<string>(e) as ThemeName) ?? 'default'); setSaved(false) } },
    )
    const brandColorTc = useTc<HTMLElement>(
        useMemo(() => ({ value: brandColor, colors: BRAND_SWATCHES }), [brandColor]),
        { 'tc-change': (e: Event) => { setBrandColor(detailValue<string>(e) ?? ''); setSaved(false) } },
    )
    const baseUrlTc = useTc<HTMLElement>(
        useMemo(() => ({ value: baseUrl }), [baseUrl]),
        { 'tc-change': (e: Event) => { setBaseUrl(detailValue<string>(e) ?? ''); setSaved(false) } },
    )
    const agentUrlTc = useTc<HTMLElement>(
        useMemo(() => ({ value: agentUrl }), [agentUrl]),
        { 'tc-change': (e: Event) => { setAgentUrl(detailValue<string>(e) ?? ''); setSaved(false) } },
    )

    if (bootErr) return <tc-banner variant="error">{bootErr}</tc-banner>
    if (!ready) {
        return (
            <div className="wharf-status-line" role="status" aria-busy="true">
                <tc-spinner type="border" size="sm" /> Loading…
            </div>
        )
    }

    return (
        <div className="wharf-page">
            <tc-rich-page-header
                icon-name="Settings"
                icon-color="slate"
                title-text="Settings"
                sub="Instance branding — owner only"
                description={`Branding for this ${branding.appName} instance: the name, tagline, theme and accent colour shown in the sidebar brand, the login screen and the browser tab.`}
            />

            {err && <tc-banner variant="error">{err}</tc-banner>}
            {saved && <tc-banner variant="success">Settings saved.</tc-banner>}

            <tc-section-card title="Branding" icon="Palette">
                <div className="wharf-section-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <tc-input
                            ref={appNameTc}
                            label="Application name"
                            placeholder="Wharf"
                            help="Shown in the sidebar brand, the login screen and the browser tab."
                            required
                        />
                        <tc-input
                            ref={taglineTc}
                            label="Tagline"
                            placeholder="Configuration for your Docker containers."
                            help="One line under the brand on the login screen."
                        />
                        <tc-extended-select
                            ref={themeTc}
                            label="Theme"
                            help="Re-skins every component. Applies live on save."
                            style={{ maxWidth: '20rem' }}
                        />
                        <tc-color-picker
                            ref={brandColorTc}
                            label="Brand colour"
                            columns={6}
                            help="Brand accent for the brand dot / login logo. Pick a swatch or type a hex value."
                            style={{ maxWidth: '16rem' }}
                        />
                    </div>
                </div>
            </tc-section-card>

            <tc-section-card title="Endpoints" icon="Link">
                <div className="wharf-section-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <tc-input
                            ref={baseUrlTc}
                            label="Base URL"
                            placeholder="http://localhost:3000"
                            help="Public dashboard URL (scheme + host + port) the browser uses, e.g. https://wharf.example.com:3000."
                        />
                        <tc-input
                            ref={agentUrlTc}
                            label="Wharf Agent URL"
                            placeholder="http://wharf-agent:4000"
                            help="Agent API URL (scheme + host + port) containers fetch config from. Shown in the wharf-client snippet as WHARF_URL."
                        />
                    </div>
                </div>
            </tc-section-card>

            <div>
                <tc-button variant="primary" onClick={save} disabled={!appName.trim() || busy}>
                    {busy ? 'Saving…' : 'Save settings'}
                </tc-button>
            </div>
        </div>
    )
}
