'use client'

import React, { useMemo, useState } from 'react'
import { toast } from '@/lib/toast'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { escapeHtml, useTc } from '@/lib/tc'
import { ROLE_RANK, type Role, type UserRecord } from '@/server/domain/types'
import { useConfirm } from './ConfirmModal'

const ROLE_OPTIONS: Role[] = ['owner', 'standard', 'guest']

// tc-advanced-table header descriptors (driven as a JS property) + the columns
// that get a sortable header. Sorting is client-side here (small list).
const COLUMNS = [
    { key: 'user', label: 'User' },
    { key: 'added', label: 'Added', width: '180px' },
    { key: 'role', label: 'Role', width: '210px' },
]
const SORTABLE = ['user', 'added', 'role']
// Role ordering for the sortable column comes from the shared domain ROLE_RANK
// (client-safe import) — no duplicated rank table here.

type SortState = { column: string; direction: 'asc' | 'desc' } | null

// Body rows go through the `rows` HTML-string property — the component owns its
// <tbody>, so React <tr> children are forbidden (they'd be relocated out from
// under the reconciler, and raw <tr> outside a <table> breaks SSR hydration).
// The per-row role picker is a declarative <tc-select data-role-for=…> whose
// native change event bubbles to the delegated handler on the table host.
function userRowsHtml(users: UserRecord[], meId: number, ownerCount: number): string {
    return users
        .map((u) => {
            const lastOwner = u.role === 'owner' && ownerCount === 1
            const options = ROLE_OPTIONS.map(
                (r) => `<tc-option value="${r}"${r === u.role ? ' selected' : ''}>${r}</tc-option>`,
            ).join('')
            return (
                `<tr>` +
                `<td><span style="display: inline-flex; align-items: center; gap: 0.6rem">` +
                `<tc-avatar src="${escapeHtml(u.avatarUrl)}" name="${escapeHtml(u.name)}" size="small"></tc-avatar>` +
                `<span><strong>@${escapeHtml(u.login)}</strong>` +
                (u.githubId === meId ? '<tc-badge variant="info">you</tc-badge>' : '') +
                `<div style="font-size: 0.8rem; opacity: 0.7">${escapeHtml(u.name)}</div>` +
                `</span></span></td>` +
                `<td>${escapeHtml(new Date(u.addedAt).toLocaleDateString())}</td>` +
                `<td><tc-select data-role-for="${u.githubId}" value="${u.role}"${lastOwner ? ' disabled' : ''}>${options}</tc-select></td>` +
                `</tr>`
            )
        })
        .join('')
}

export function UsersClient({ users, meId }: { users: UserRecord[]; meId: number }) {
    const confirm = useConfirm()
    const [rows, setRows] = useState(users)
    const [sort, setSort] = useState<SortState>(null)

    const ownerCount = rows.filter((u) => u.role === 'owner').length

    const setRole = async (user: UserRecord, role: Role): Promise<boolean> => {
        if (role === user.role) return false

        // last-owner guard mirrored client-side
        if (user.role === 'owner' && role !== 'owner' && ownerCount === 1) {
            toast.error('Cannot demote the last remaining owner.')
            return false
        }
        if (user.role === 'owner' && role !== 'owner') {
            const ok = await confirm({
                title: `Demote @${user.login}?`,
                body: `They will lose owner access${user.githubId === meId ? ' — including your own access to this page' : ''}.`,
                confirmLabel: 'Demote',
                confirmVariant: 'warning',
            })
            if (!ok) return false
        }

        try {
            const updated = await apiFetch<UserRecord>(`/api/users/${user.githubId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
            })
            setRows((rs) => rs.map((u) => (u.githubId === updated.githubId ? updated : u)))
            toast.success(`@${user.login} is now ${role}`)
            return true
        } catch (e) {
            toast.error(describeApiError(e))
            return false
        }
    }

    const displayed = useMemo(() => {
        if (!sort) return rows
        const dir = sort.direction === 'asc' ? 1 : -1
        return [...rows].sort((a, b) => {
            let cmp = 0
            if (sort.column === 'user') cmp = a.login.localeCompare(b.login)
            else if (sort.column === 'added') cmp = new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
            else if (sort.column === 'role') cmp = ROLE_RANK[a.role] - ROLE_RANK[b.role]
            return cmp * dir
        })
    }, [rows, sort])

    // A rejected/cancelled pick snaps the select back to the stored role — an
    // applied one re-renders the rows string with the new `selected` marker.
    const onRoleChange = (event: Event) => {
        const host = (event.target as HTMLElement)?.closest?.('tc-select[data-role-for]') as
            | (HTMLElement & { value: string })
            | null
        if (!host) return
        const id = Number(host.getAttribute('data-role-for'))
        const user = rows.find((u) => u.githubId === id)
        if (!user) return
        const picked = host.value as Role
        void setRole(user, picked).then((applied) => {
            if (!applied) host.value = user.role
        })
    }

    const tableProps = useMemo(
        () => ({
            columns: COLUMNS,
            sortableColumns: SORTABLE,
            sort,
            rows: userRowsHtml(displayed, meId, ownerCount),
        }),
        [displayed, meId, ownerCount, sort],
    )
    const tableRef = useTc<HTMLElement>(tableProps, {
        change: onRoleChange,
        'tc-sort-change': (e) => {
            const d = (e as CustomEvent).detail
            setSort(d?.column ? { column: d.column, direction: d.direction } : null)
        },
    })

    return (
        <div className="taskforge-page">
            <tc-rich-page-header
                title-text="Users & roles"
                icon-name="Users"
                icon-color="violet"
                description="Everyone with access to this TaskForge instance, and the role each one holds."
            />
            <tc-advanced-table ref={tableRef} />
        </div>
    )
}
