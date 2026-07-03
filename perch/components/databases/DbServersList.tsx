'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import { useTc, escapeHtml } from '@/lib/tc'
import { useMe } from '@/lib/me-context'
import type { DbServer } from '@/server/domain/types'
import { DbPage, json, useDbData } from './shared'

// Maintainer entry page for database management (perch_database_management.md
// §9): the servers the owner connected in one tc-advanced-table, click-through
// to the per-server detail (databases / users / access). Connecting new servers
// is owner-only and lives on the DB Servers admin page.

const SERVER_COLUMNS: AdvancedTableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'kind', label: 'Engine' },
    { key: 'endpoint', label: 'Endpoint' },
    { key: 'tls', label: 'TLS' },
    { key: 'status', label: 'Status' },
    { key: 'action', label: '', align: 'right' },
]

// Body rows are injected as an HTML string into the projected <tbody> (the
// canonical tc-advanced-table pattern — same as /admin/sites), so every
// interpolated value is escaped. The Manage control is a plain <button> with a
// data attribute; clicks are caught by delegation on the table host.
function serversRowsHtml(servers: DbServer[]): string {
    return servers
        .map((s) => {
            const status = s.lastError
                ? `<span class="badge text-bg-danger" title="${escapeHtml(s.lastError)}">last operation failed</span>`
                : `<span class="badge text-bg-success">ok</span>`
            return (
                `<tr>` +
                `<td><button type="button" class="btn btn-link p-0" data-manage-id="${escapeHtml(s.id)}">${escapeHtml(s.name)}</button></td>` +
                `<td><span class="badge text-bg-info">${escapeHtml(s.kind)}</span></td>` +
                `<td class="perch-admin-mono">${escapeHtml(`${s.host}:${s.port}`)}</td>` +
                `<td>${s.tls === 'require' ? `<span class="badge text-bg-light">require</span>` : `<span class="perch-admin-hint">off</span>`}</td>` +
                `<td>${status}</td>` +
                `<td style="text-align:right"><button type="button" class="btn btn-sm btn-outline-secondary" data-manage-id="${escapeHtml(s.id)}">Manage</button></td>` +
                `</tr>`
            )
        })
        .join('')
}

export function DbServersList() {
    const me = useMe()
    const fetcher = useCallback(async (): Promise<DbServer[] | null> => {
        try {
            return await fetch('/api/db-servers', { cache: 'no-store' }).then((r) => json<DbServer[]>(r))
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useDbData(fetcher)

    return (
        <DbPage
            title="Databases"
            subtitle="Manage the databases, users, and access on the connected servers. Live reads — the server itself is the source of truth."
            icon="database"
            iconColor="cyan"
            state={state}
            onRetry={() => void reload()}
        >
            {(servers) =>
                servers.length === 0 ? (
                    <tc-empty-state icon="database">
                        {me.role === 'owner'
                            ? 'No database servers connected yet — add one under Admin → DB Servers.'
                            : 'No database servers connected yet — ask the owner to add one.'}
                    </tc-empty-state>
                ) : (
                    <ServersTable servers={servers} />
                )
            }
        </DbPage>
    )
}

function ServersTable({ servers }: { servers: DbServer[] }) {
    const router = useRouter()

    // Delegate Manage/name clicks on the table host (the buttons live in the
    // injected tbody HTML, so a host-level listener is the only way to reach them).
    const onTableClick = useCallback(
        (event: Event) => {
            const btn = (event.target as HTMLElement)?.closest?.('[data-manage-id]') as HTMLElement | null
            const id = btn?.getAttribute('data-manage-id')
            if (id) router.push(`/databases/${encodeURIComponent(id)}/databases`)
        },
        [router],
    )

    const tableProps = useMemo(
        () => ({ columns: SERVER_COLUMNS, total: servers.length, limit: Math.max(servers.length, 1), offset: 0 }),
        [servers.length],
    )
    const tableRef = useTc<HTMLElement>(tableProps, { click: onTableClick })

    // Inject the body rows after the element has rendered its <tbody>. Re-runs
    // whenever the server list changes.
    useEffect(() => {
        const el = tableRef.current
        if (!el) return
        const body = el.querySelector('.tc-advanced-table-body')
        if (body) body.innerHTML = serversRowsHtml(servers)
    }, [servers, tableRef])

    return (
        <tc-section-card title="Connected servers" icon="database">
            <div className="perch-admin-section">
                <tc-advanced-table ref={tableRef} />
            </div>
        </tc-section-card>
    )
}
