'use client'

// Admin-only instance branding. Two fields: the optional second brand word shown inline
// after "Task Forge" in the sidebar brand + login logo, and the tc-* theme applied to
// the whole instance. Loads from `GET /api/admin/settings`, saves via `PUT`, then
// re-pulls the public branding so the brand + theme update live.

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from '@/lib/toast'
import { useTc, useTcEvents, detailValue } from '@/lib/tc'
import { tcIcon } from '@/lib/icons'
import { useBranding } from '@/lib/branding-context'
import {
    THEME_NAMES,
    THEME_LABEL,
    type SiteSettings,
    type ThemeName,
} from '@/server/domain/site-settings'

const THEME_ITEMS = THEME_NAMES.map((t) => ({ key: t, label: THEME_LABEL[t] }))

export function SiteSettingsClient() {
    const branding = useBranding()

    const [ready, setReady] = useState(false)
    const [bootErr, setBootErr] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [secondaryText, setSecondaryText] = useState('')
    const [theme, setTheme] = useState<ThemeName>('default')

    useEffect(() => {
        const ctrl = new AbortController()
        ;(async () => {
            try {
                const res = await fetch('/api/admin/settings', { cache: 'no-store', signal: ctrl.signal })
                if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'forbidden' : 'failed')
                const s = (await res.json()) as SiteSettings
                if (ctrl.signal.aborted) return
                setSecondaryText(s.secondaryText)
                setTheme(s.theme)
                setReady(true)
            } catch (e) {
                if (ctrl.signal.aborted) return
                setBootErr(
                    (e as Error).message === 'forbidden'
                        ? 'Only admins can manage instance settings.'
                        : 'Couldn’t load settings.',
                )
            }
        })()
        return () => ctrl.abort()
    }, [])

    const secondaryTextRef = useTcEvents<HTMLElement>({
        input: (e) => setSecondaryText((e.target as HTMLInputElement).value),
    })

    const themeTc = useTc<HTMLElement>(
        useMemo(() => ({ items: THEME_ITEMS, value: theme }), [theme]),
        { 'tc-change': (e: Event) => setTheme((detailValue<string>(e) as ThemeName) ?? 'default') },
    )

    const save = async () => {
        if (busy) return
        setBusy(true)
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secondaryText, theme }),
            })
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                throw new Error(body?.error ?? `error ${res.status}`)
            }
            // Re-pull the public branding so the sidebar brand updates live.
            await branding.refresh()
            toast.success('Settings saved.')
        } catch (e) {
            toast.error(`Couldn’t save settings: ${(e as Error).message}.`)
        } finally {
            setBusy(false)
        }
    }

    if (bootErr) return <tc-banner variant="error">{bootErr}</tc-banner>
    if (!ready) {
        return (
            <div role="status" aria-busy="true" style={{ padding: '1rem' }}>
                <tc-spinner type="border" size="sm" /> Loading…
            </div>
        )
    }

    return (
        <div className="tf-page">
            <tc-rich-page-header
                title-text="Settings"
                icon-name={tcIcon('gear')}
                icon-color="violet"
                description="Instance branding — admin only."
            />

            <tc-card>
                <tc-heading slot="header" as="h3">
                    Branding
                </tc-heading>
                <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                    <tc-input
                        ref={secondaryTextRef}
                        label="Secondary brand text"
                        placeholder="cloud"
                        value={secondaryText}
                        help="Optional second word shown inline after “Task Forge” in the brand. Leave blank for none."
                        disabled={busy || undefined}
                    />
                    <tc-extended-select
                        ref={themeTc}
                        label="Theme"
                        help="Re-skins every component. The “Task Forge” wordmark stays fixed. Applies live on save."
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
