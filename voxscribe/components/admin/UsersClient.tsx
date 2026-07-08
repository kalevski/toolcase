'use client'

// Admin → Users (spec §9): user table with a role select per row (delegated
// change event). Setting `guest` revokes access — there is no separate
// "suspend" state. The last-admin-demotion guard answers 409.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TableColumn } from '@toolcase/web-components'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { escapeHtml } from '@/lib/tc'
import { useToast } from '@/components/Toast'
import { DataTable } from '@/components/DataTable'
import { LoadingState, ErrorState } from '@/components/states'
import type { AppUser } from '@/server/domain/types'

const ROLES = ['guest', 'standard', 'admin'] as const

export function UsersClient() {
    const toast = useToast()
    const [users, setUsers] = useState<AppUser[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        setError(null)
        try {
            const res = await apiFetch<{ users: AppUser[] }>('/api/users')
            setUsers(res.users)
        } catch (err) {
            setError(describeApiError(err))
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    const columns = useMemo<TableColumn[]>(
        () => [
            {
                key: 'login',
                header: 'User',
                render: (row: any) => {
                    const u = row as AppUser
                    const avatar = u.avatarUrl
                        ? `<img class="voxscribe-avatar" src="${escapeHtml(u.avatarUrl)}" alt="" width="24" height="24"/> `
                        : ''
                    return `${avatar}<strong>@${escapeHtml(u.login)}</strong> <span class="voxscribe-muted">${escapeHtml(u.name)}</span>`
                },
            },
            { key: 'addedAt', header: 'Added', render: (row: any) => escapeHtml(String((row as AppUser).addedAt).slice(0, 10)) },
            {
                key: 'role',
                header: 'Role',
                render: (row: any) => {
                    const u = row as AppUser
                    const options = ROLES.map(
                        (r) => `<option value="${r}"${u.role === r ? ' selected' : ''}>${r}</option>`,
                    ).join('')
                    return `<select class="form-select form-select-sm voxscribe-role-select" data-action="role" data-id="${u.githubId}" aria-label="Role for @${escapeHtml(u.login)}">${options}</select>`
                },
            },
        ],
        [],
    )

    const onAction = useCallback(
        (action: string, dataset: DOMStringMap, event: Event) => {
            if (action !== 'role' || event.type !== 'change') return
            const githubId = Number(dataset.id)
            const role = (event.target as HTMLSelectElement).value
            void apiFetch(`/api/users/${githubId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
            })
                .then(() => {
                    toast.show('Role updated', { variant: 'success' })
                    void load()
                })
                .catch(async (err) => {
                    toast.show(describeApiError(err), { variant: 'error' })
                    void load() // reset the select to the authoritative value
                })
        },
        [toast, load],
    )

    if (error) return <ErrorState message={error} onRetry={load} />
    if (!users) return <LoadingState shape="rows" count={4} />

    return (
        <div className="voxscribe-page">
            <h1>Users</h1>
            <p className="voxscribe-muted">
                Setting <code>guest</code> revokes access. The first sign-in bootstrapped the first admin.
            </p>
            <DataTable
                columns={columns}
                rows={users as unknown as Record<string, unknown>[]}
                rowKey={(row) => String(row.githubId)}
                onAction={onAction}
            />
        </div>
    )
}
