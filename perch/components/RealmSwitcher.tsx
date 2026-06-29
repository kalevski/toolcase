'use client'

import { useCallback, useState } from 'react'
import { useMe } from '@/lib/me-context'
import { SelectField } from '@/components/fields'

// Owner-only active-realm switcher (multiple_realms.md §E.3). Sits in the sidebar panel
// (above the user panel) and lists every realm; selecting one POSTs the choice to
// `/api/realms/active` (which sets the signed cookie) and reloads so every client data
// fetcher re-runs against the new active realm. Rendered only for the owner AND only when
// more than one realm exists — a single-instance deployment shows nothing (zero change).
// Non-owners never see it: they're pinned to their owner-assigned default realm (§0.6).

export function RealmSwitcher() {
    const me = useMe()
    const [busy, setBusy] = useState(false)

    const switchTo = useCallback(
        async (id: string) => {
            if (busy || id === me.activeRealm.id) return
            setBusy(true)
            try {
                const res = await fetch('/api/realms/active', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ realmId: id }),
                })
                // Reload so /api/me + every realm-selected fetcher re-resolves the new realm.
                if (res.ok) window.location.reload()
                else setBusy(false)
            } catch {
                setBusy(false)
            }
        },
        [busy, me.activeRealm.id],
    )

    const realms = me.realms ?? []
    // Only the owner switches, and only when there's a choice to make.
    if (!me.canSwitchRealms || realms.length < 2) return null

    const options = realms.map((r) => ({
        value: r.id,
        label: r.isDefault ? `${r.name} (default)` : r.name,
    }))

    return (
        <div className="perch-realm-switcher" slot="sidebar-panel">
            <SelectField
                size="sm"
                label="Active realm"
                value={me.activeRealm.id}
                options={options}
                disabled={busy}
                onValue={(v) => void switchTo(v)}
                ariaLabel="Active realm"
            />
        </div>
    )
}
