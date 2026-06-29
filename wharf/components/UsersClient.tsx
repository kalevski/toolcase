'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, describeApiError, ApiError } from '@/lib/fetcher'
import { useTc } from '@/lib/tc'
import type { AppUser, Role } from '@/server/domain/types'
import type { AdvancedTableColumn, AdvancedTableSort } from '@toolcase/web-components'

const PAGE_SIZE = 10

const COLUMNS: AdvancedTableColumn[] = [
    { key: 'name', label: 'User' },
    { key: 'role', label: 'Role' },
    { key: 'action', label: 'Action', align: 'right' },
]
const SORTABLE = ['name', 'role']

export function UsersClient() {
    const [users, setUsers] = useState<AppUser[] | null>(null)
    const [err, setErr] = useState<string | null>(null)
    const [busy, setBusy] = useState<number | null>(null)
    const [confirmDemote, setConfirmDemote] = useState<AppUser | null>(null)
    const [offset, setOffset] = useState(0)
    const [sort, setSort] = useState<AdvancedTableSort | null>(null)

    const load = useCallback(async (signal?: AbortSignal) => {
        try {
            setUsers(await apiFetch<AppUser[]>('/api/users', { signal }))
        } catch (e) {
            if (!signal?.aborted) setErr(describeApiError(e))
        }
    }, [])

    useEffect(() => {
        const ctrl = new AbortController()
        void load(ctrl.signal)
        return () => ctrl.abort()
    }, [load])

    const setRole = async (githubId: number, role: Role) => {
        setBusy(githubId)
        setErr(null)
        try {
            await apiFetch(`/api/users/${githubId}`, { method: 'PATCH', body: JSON.stringify({ role }) })
            await load()
        } catch (e) {
            setErr(e instanceof ApiError && e.status === 409 ? 'Cannot demote the last owner.' : describeApiError(e))
        } finally {
            setBusy(null)
        }
    }

    const confirmRef = useTc<HTMLElement>(
        useMemo(() => ({ open: confirmDemote !== null }), [confirmDemote]),
        {
            'tc-confirm': () => {
                const target = confirmDemote
                setConfirmDemote(null)
                if (target) void setRole(target.githubId, 'guest')
            },
            'tc-cancel': () => setConfirmDemote(null),
        },
    )

    // Client-side sort + page (the roster is already fully loaded).
    const sorted = useMemo(() => {
        const list = [...(users ?? [])]
        if (sort) {
            const dir = sort.direction === 'asc' ? 1 : -1
            list.sort((a, b) => {
                const av = sort.column === 'role' ? a.role : a.name.toLowerCase()
                const bv = sort.column === 'role' ? b.role : b.name.toLowerCase()
                return av < bv ? -dir : av > bv ? dir : 0
            })
        }
        return list
    }, [users, sort])

    const total = sorted.length
    const safeOffset = Math.min(offset, Math.max(0, total - 1))
    const pageRows = useMemo(() => sorted.slice(safeOffset, safeOffset + PAGE_SIZE), [sorted, safeOffset])

    const tableRef = useTc<HTMLElement>(
        useMemo(
            () => ({ columns: COLUMNS, sortableColumns: SORTABLE, sort, limit: PAGE_SIZE, offset: safeOffset, total }),
            [sort, safeOffset, total],
        ),
        {
            'tc-page-change': (e: Event) => setOffset((e as CustomEvent).detail?.offset ?? 0),
            'tc-sort-change': (e: Event) => {
                const d = (e as CustomEvent).detail
                setSort(d?.column ? { column: d.column, direction: d.direction } : null)
                setOffset(0)
            },
        },
    )

    // Keyed remount whenever the visible row set changes — tc-advanced-table
    // captures slotted <tr> into its own tbody on connect, so React must not try
    // to reorder them in place (TaskForge dashboard pattern).
    const tableKey = `${sort?.column ?? ''}_${sort?.direction ?? ''}_${safeOffset}_${pageRows.map((u) => u.githubId).join('-')}`

    return (
        <div className="wharf-page">
            <tc-rich-page-header icon-name="Users" icon-color="slate" title-text="Users" sub="Global roles" />

            {err && <tc-banner variant="error">{err}</tc-banner>}

            <tc-section-card title="People" icon="Users">
                <div className="wharf-section-body">
                    <p style={{ margin: '0 0 1rem', color: 'var(--tc-text-muted)' }}>
                        Everyone who has signed in. Owners see and manage everything; a guest needs project membership.
                    </p>
                    {users === null ? (
                        <div className="wharf-status-line" role="status" aria-busy="true">
                            <tc-spinner type="border" size="sm" /> Loading…
                        </div>
                    ) : users.length === 0 ? (
                        <tc-empty-state icon="Users">
                            <h2>No users yet</h2>
                            <p>Users appear here after they sign in.</p>
                        </tc-empty-state>
                    ) : (
                        <tc-advanced-table key={tableKey} ref={tableRef}>
                            {pageRows.map((u) => (
                                <tr key={u.githubId}>
                                    <td>
                                        <strong>{u.name}</strong>{' '}
                                        <span style={{ color: 'var(--tc-text-muted)' }}>@{u.login}</span>
                                    </td>
                                    <td>
                                        <tc-badge variant={u.role === 'owner' ? 'primary' : 'secondary'}>{u.role}</tc-badge>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {u.role === 'owner' ? (
                                            <tc-button
                                                size="sm"
                                                variant="secondary"
                                                outline
                                                disabled={busy === u.githubId}
                                                onClick={() => setConfirmDemote(u)}
                                            >
                                                Demote to guest
                                            </tc-button>
                                        ) : (
                                            <tc-button
                                                size="sm"
                                                variant="primary"
                                                disabled={busy === u.githubId}
                                                onClick={() => setRole(u.githubId, 'owner')}
                                            >
                                                Promote to owner
                                            </tc-button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tc-advanced-table>
                    )}
                </div>
            </tc-section-card>

            <tc-confirm-dialog
                ref={confirmRef}
                eyebrow="Demote user"
                dialog-title="Demote this owner to guest?"
                message={
                    confirmDemote
                        ? `${confirmDemote.name} (@${confirmDemote.login}) will lose owner access and need project membership to see anything.`
                        : ''
                }
                confirm-label="Demote"
                cancel-label="Cancel"
                danger
            />
        </div>
    )
}
