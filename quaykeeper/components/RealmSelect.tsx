'use client'

import { useCallback, useMemo, useState } from 'react'
import type { ExtendedSelectItem } from '@toolcase/web-components'
import { useTc, detailValue } from '@/lib/tc'
import { useMe } from '@/lib/me-context'

// Inline active-nginxpilot-instance (realm) selector (multiple_realms.md §E.3).
// Replaces the old sidebar RealmSwitcher: the picker now lives on each page whose
// data is scoped to the active realm (the routing pages, base-domain/cert views…),
// so the choice is made in-context. Selecting a realm POSTs to `/api/realms/active`
// (which sets the signed `quaykeeper_realm` cookie — the persisted preference that
// carries across every feature) and reloads so every realm-scoped fetcher re-runs
// against the new instance.
//
// Uses `tc-extended-select` (searchable) via the imperative `items` property + the
// `tc-change` CustomEvent, mirroring the CreateSiteWizard pattern. Rendered only for
// a caller who may switch (owner) AND when more than one realm exists — a
// single-instance deployment or a pinned non-owner shows nothing (zero change).

export function RealmSelect({ className }: { className?: string }) {
    const me = useMe()
    const [busy, setBusy] = useState(false)

    const realms = useMemo(() => me.realms ?? [], [me.realms])
    const activeRealmId = me.activeRealm?.id ?? ''

    const items = useMemo<ExtendedSelectItem[]>(
        () =>
            realms.map((r) => ({
                key: r.id,
                label: r.isDefault ? `${r.name} (default)` : r.name,
                description: r.adminUrl,
            })),
        [realms],
    )

    const switchTo = useCallback(
        async (id: string) => {
            if (busy || !id || id === activeRealmId) return
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
        [busy, activeRealmId],
    )

    const ref = useTc<HTMLElement>(
        useMemo(() => ({ items, value: activeRealmId, disabled: busy }), [items, activeRealmId, busy]),
        { 'tc-change': (event: Event) => void switchTo(detailValue<string>(event)) },
    )

    // Only the owner switches, and only when there's a choice to make.
    if (!me.canSwitchRealms || realms.length < 2) return null

    return (
        <div className={`quaykeeper-realm-select${className ? ` ${className}` : ''}`}>
            <label className="quaykeeper-realm-select-label">Active NGINX server</label>
            <tc-extended-select
                ref={ref}
                placeholder="Select an nginxpilot instance…"
                search-placeholder="Search instances…"
                aria-label="Active NGINX server"
            />
        </div>
    )
}
