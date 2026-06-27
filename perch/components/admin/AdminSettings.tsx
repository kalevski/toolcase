'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminPage, json, useOwnerData } from './shared'
import { TextField, SelectField, type SelectOption } from '@/components/fields'
import { useToast } from '@/components/Toast'
import { useBranding } from '@/lib/branding-context'
import { THEME_NAMES, THEME_LABEL, type SiteSettings } from '@/server/domain/settings'

// Owner-only global settings (§13). Two groups: branding (app name, tagline, theme,
// brand colour) and custom-domain ingress (the server IPv4/IPv6 handed out in the
// A/AAAA-record instructions and verified against before a cert is issued). Theme
// covers every bundled @toolcase/web-components skin. Saving PUTs the whole record,
// re-pulls the public branding so the theme + brand update live, and toasts.

const THEME_OPTIONS: SelectOption[] = THEME_NAMES.map((t) => ({ value: t, label: THEME_LABEL[t] }))

export function AdminSettings() {
    const fetcher = useCallback(async (): Promise<SiteSettings | null> => {
        try {
            return await fetch('/api/admin/settings', { cache: 'no-store' }).then((r) => json<SiteSettings>(r))
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useOwnerData(fetcher)

    return (
        <AdminPage
            title="Settings"
            subtitle="Branding and custom-domain ingress for this instance. Owner-only."
            state={state}
            onRetry={() => void reload()}
        >
            {(settings) => <SettingsForm settings={settings} onSaved={() => void reload()} />}
        </AdminPage>
    )
}

function SettingsForm({ settings, onSaved }: { settings: SiteSettings; onSaved: () => void }) {
    const toast = useToast()
    const branding = useBranding()

    const [appName, setAppName] = useState(settings.appName)
    const [tagline, setTagline] = useState(settings.tagline)
    const [theme, setTheme] = useState<string>(settings.theme)
    const [brandColor, setBrandColor] = useState(settings.brandColor)
    const [ingressIpv4, setIngressIpv4] = useState(settings.ingressIpv4)
    const [ingressIpv6, setIngressIpv6] = useState(settings.ingressIpv6)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    // Re-seed when the persisted record reloads (e.g. after a save round-trip).
    useEffect(() => {
        setAppName(settings.appName)
        setTagline(settings.tagline)
        setTheme(settings.theme)
        setBrandColor(settings.brandColor)
        setIngressIpv4(settings.ingressIpv4)
        setIngressIpv6(settings.ingressIpv6)
    }, [settings])

    const save = useCallback(async () => {
        if (busy) return
        setBusy(true)
        setError(null)
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ appName, tagline, theme, brandColor, ingressIpv4, ingressIpv6 }),
            })
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                setError(body?.error ? `Couldn’t save settings: ${body.error}.` : `Couldn’t save settings (error ${res.status}).`)
                return
            }
            // Re-pull the public branding so the theme + brand re-skin live, then
            // reload the admin form's source of truth.
            await branding.refresh()
            onSaved()
            toast.show('Settings saved.', { variant: 'success' })
        } catch {
            setError('Couldn’t save settings — network error.')
        } finally {
            setBusy(false)
        }
    }, [appName, tagline, theme, brandColor, ingressIpv4, ingressIpv6, busy, branding, onSaved, toast])

    return (
        <form
            className="perch-admin-settings"
            onSubmit={(e) => {
                e.preventDefault()
                void save()
            }}
        >
            {error && <tc-banner variant="danger">{error}</tc-banner>}

            <tc-section-card title="Branding" icon="palette">
                <div className="perch-admin-section perch-admin-settings-grid">
                    <TextField
                        label="Application name"
                        value={appName}
                        onValue={setAppName}
                        placeholder="Perch"
                        help="Shown in the sidebar brand, the login screen, and the browser tab."
                        disabled={busy}
                        required
                    />
                    <SelectField
                        label="Theme"
                        value={theme}
                        onValue={setTheme}
                        options={THEME_OPTIONS}
                        disabled={busy}
                    />
                    <TextField
                        label="Tagline"
                        value={tagline}
                        onValue={setTagline}
                        placeholder="Deploy a branch of your GitHub repository as a static website."
                        help="One line under the brand on the login screen."
                        disabled={busy}
                    />
                    <TextField
                        label="Brand colour"
                        value={brandColor}
                        onValue={setBrandColor}
                        placeholder="#0ea5e9"
                        help="Hex colour for the brand dot / login logo (e.g. #0ea5e9)."
                        disabled={busy}
                    />
                </div>
            </tc-section-card>

            <tc-section-card title="Custom-domain ingress" icon="globe">
                <div className="perch-admin-section perch-admin-settings-grid">
                    <p className="perch-home-lead perch-admin-hint perch-admin-settings-full">
                        The public server IP a tenant’s custom domain must point at. Perch shows it in the A-record
                        instructions and re-resolves the domain server-side to confirm it points here before issuing a
                        certificate. Leave blank to fall back to <code>PERCH_INGRESS_IPV4</code>; an empty IP disables
                        custom-domain verification.
                    </p>
                    <TextField
                        label="Server IP (A record, IPv4)"
                        value={ingressIpv4}
                        onValue={setIngressIpv4}
                        placeholder="203.0.113.10"
                        help="The A-record target shown to tenants adding a custom domain."
                        disabled={busy}
                    />
                    <TextField
                        label="Server IPv6 (AAAA record, optional)"
                        value={ingressIpv6}
                        onValue={setIngressIpv6}
                        placeholder="2001:db8::10"
                        help="Optional AAAA-record target. Leave blank to omit it."
                        disabled={busy}
                    />
                </div>
            </tc-section-card>

            <div className="perch-admin-settings-actions">
                <tc-button type="submit" variant="primary" disabled={!appName.trim() || busy || undefined}>
                    {busy ? 'Saving…' : 'Save settings'}
                </tc-button>
            </div>
        </form>
    )
}
