'use client'

import { useCallback, useMemo, useState } from 'react'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import { useTc, escapeHtml } from '@/lib/tc'
import type { AdminUserRow, Site } from '@/server/domain/types'
import { iconBtnHtml } from '@/lib/action-icons'
import { AdminPage, json, useOwnerData } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'

// Owner-only site moderation (§13). Every site across all tenants in a
// `tc-advanced-table`, each row carrying a Suspend action. Suspending drops the
// nginxpilot fragment and reloads, so the site stops serving immediately — it's
// reversible (the row is kept). Needs the user roster too, to resolve `ownerId`
// (a github_id) to a login for the Owner column.

interface SitesData {
    sites: Site[]
    users: AdminUserRow[]
}

export function AdminSites() {
    const fetcher = useCallback(async (): Promise<SitesData | null> => {
        try {
            const [sites, users] = await Promise.all([
                fetch('/api/admin/sites', { cache: 'no-store' }).then((r) => json<Site[]>(r)),
                fetch('/api/admin/users', { cache: 'no-store' }).then((r) => json<AdminUserRow[]>(r)),
            ])
            return { sites, users }
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useOwnerData(fetcher)

    return (
        <AdminPage
            title="Sites"
            subtitle="Every site across all tenants. Owner-only."
            icon="layout-dashboard"
            iconColor="blue"
            state={state}
            onRetry={() => void reload()}
        >
            {(data) => (
                <SitesModeration sites={data.sites} users={data.users} onSuspended={() => void reload()} />
            )}
        </AdminPage>
    )
}

const SITE_COLUMNS: AdvancedTableColumn[] = [
    { key: 'hostname', label: 'Host' },
    { key: 'owner', label: 'Owner' },
    { key: 'status', label: 'Status' },
    { key: 'source', label: 'Repo / branch' },
    { key: 'created', label: 'Created' },
    { key: 'action', label: '', align: 'right' },
]

// Body rows are injected as an HTML string into the projected <tbody> (the
// canonical tc-advanced-table pattern — see the examples demo), so every
// interpolated value is escaped. The Suspend control is a plain <button> with a
// data attribute; clicks are caught by delegation on the table host.
function sitesRowsHtml(sites: Site[], ownerById: Map<number, string>): string {
    if (sites.length === 0) {
        return `<tr><td colspan="6" class="quaykeeper-admin-empty-cell"><tc-empty-state icon="panels-top-left">No sites yet.</tc-empty-state></td></tr>`
    }
    return sites
        .map((s) => {
            const owner = ownerById.get(s.ownerId) ?? `#${s.ownerId}`
            const source = `${s.repoOwner}/${s.repoName}@${s.branch}`
            const created = String(s.createdAt).slice(0, 10)
            const action =
                s.status === 'suspended'
                    ? `<span class="quaykeeper-admin-suspended">Suspended</span>`
                    : iconBtnHtml({
                          icon: 'suspend',
                          label: `Suspend ${s.hostname}`,
                          danger: true,
                          data: { 'suspend-id': s.id, 'suspend-host': s.hostname },
                      })
            return (
                `<tr>` +
                `<td>${escapeHtml(s.hostname)}</td>` +
                `<td>${escapeHtml(owner)}</td>` +
                `<td><span class="quaykeeper-admin-status quaykeeper-admin-status--${escapeHtml(s.status)}">${escapeHtml(s.status.replace('_', ' '))}</span></td>` +
                `<td class="quaykeeper-admin-mono">${escapeHtml(source)}</td>` +
                `<td class="quaykeeper-admin-mono">${escapeHtml(created)}</td>` +
                `<td style="text-align:right">${action}</td>` +
                `</tr>`
            )
        })
        .join('')
}

function SitesModeration({
    sites,
    users,
    onSuspended,
}: {
    sites: Site[]
    users: AdminUserRow[]
    onSuspended: () => void
}) {
    const [busyId, setBusyId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    // The site awaiting suspend confirmation (drives the ConfirmDialog).
    const [pending, setPending] = useState<{ id: string; host: string } | null>(null)

    const ownerById = useMemo(() => new Map(users.map((u) => [u.user.githubId, u.user.login])), [users])

    const doSuspend = useCallback(async () => {
        if (!pending || busyId) return
        const { id, host } = pending
        setPending(null)
        setBusyId(id)
        setError(null)
        try {
            const res = await fetch(`/api/admin/sites/${encodeURIComponent(id)}/suspend`, { method: 'POST' })
            if (!res.ok) {
                setError(`Couldn’t suspend ${host} (error ${res.status}).`)
                return
            }
            onSuspended()
        } catch {
            setError(`Couldn’t suspend ${host} — network error.`)
        } finally {
            setBusyId(null)
        }
    }, [pending, busyId, onSuspended])

    // Delegate suspend clicks on the table host (the buttons live in the injected
    // tbody HTML, so a host-level listener is the only way to reach them). A click
    // opens the confirm dialog; the actual POST runs on confirm.
    const onTableClick = useCallback((event: Event) => {
        const btn = (event.target as HTMLElement)?.closest?.('[data-suspend-id]') as HTMLElement | null
        if (!btn) return
        const id = btn.getAttribute('data-suspend-id')
        const host = btn.getAttribute('data-suspend-host') ?? ''
        if (id) setPending({ id, host })
    }, [])

    const tableProps = useMemo(
        () => ({
            columns: SITE_COLUMNS,
            total: sites.length,
            limit: Math.max(sites.length, 1),
            offset: 0,
            // Body rows as the element-owned `rows` HTML string — relocation-safe,
            // re-applied by the component on every internal re-render.
            rows: sitesRowsHtml(sites, ownerById),
        }),
        [sites, ownerById],
    )
    const tableRef = useTc<HTMLElement>(tableProps, { click: onTableClick })

    return (
        <tc-section-card title="Sites" icon="layout-dashboard">
            <div className="quaykeeper-admin-section">
                <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                    Every site across all tenants. Suspending drops the nginxpilot fragment and reloads, so the
                    site stops serving immediately — it’s reversible (the row is kept).
                </p>
                {error && <tc-banner variant="danger">{error}</tc-banner>}
                {busyId && (
                    <p className="quaykeeper-admin-busy" role="status">
                        Suspending…
                    </p>
                )}
                <tc-advanced-table ref={tableRef} />
            </div>
            <ConfirmDialog
                open={!!pending}
                title="Suspend site?"
                message={
                    pending
                        ? `${pending.host} stops serving immediately. This is reversible — the row is kept and you can resume it later.`
                        : undefined
                }
                confirmLabel="Suspend"
                danger
                onConfirm={() => void doSuspend()}
                onCancel={() => setPending(null)}
            />
        </tc-section-card>
    )
}
