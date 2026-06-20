'use client'

import React, { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { useTcEvents } from '@/lib/tc'
import type { Role, UserRecord } from '@/server/domain/types'
import { useConfirm } from './ConfirmModal'

const ROLE_OPTIONS = [
    { value: 'admin', label: 'admin' },
    { value: 'standard', label: 'standard' },
    { value: 'guest', label: 'guest' },
]

// Per-row role <select>. A component (not an inline cell) so it can own the
// addEventListener('change') ref — React 18 doesn't fire onChange on tc-select.
function RoleSelect({
    value,
    disabled,
    onChange,
}: {
    value: Role
    disabled: boolean
    // Returns whether the change was applied; if not (rejected/cancelled), the
    // select snaps back to `value` so it never shows an un-applied role.
    onChange: (role: Role) => Promise<boolean>
}) {
    const ref = useTcEvents<HTMLElement>({
        change: (e) => {
            const picked = (e.target as HTMLSelectElement).value as Role
            void onChange(picked).then((applied) => {
                if (!applied && ref.current) (ref.current as HTMLSelectElement).value = value
            })
        },
    })
    // Keep the element in sync when `value` changes from outside (e.g. another
    // row's update re-renders the table). React won't rewrite an unchanged
    // attribute, so a rejected pick would otherwise linger in the native select.
    useEffect(() => {
        if (ref.current) (ref.current as HTMLSelectElement).value = value
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value])
    return (
        <tc-select ref={ref} value={value} disabled={disabled || undefined}>
            {ROLE_OPTIONS.map((o) => (
                <tc-option key={o.value} value={o.value}>
                    {o.label}
                </tc-option>
            ))}
        </tc-select>
    )
}

export function UsersClient({ users, meId }: { users: UserRecord[]; meId: number }) {
    const confirm = useConfirm()
    const [rows, setRows] = useState(users)

    const adminCount = rows.filter((u) => u.role === 'admin').length

    const setRole = async (user: UserRecord, role: Role): Promise<boolean> => {
        if (role === user.role) return false

        // last-admin guard mirrored client-side
        if (user.role === 'admin' && role !== 'admin' && adminCount === 1) {
            toast.error('Cannot demote the last remaining admin.')
            return false
        }
        if (user.role === 'admin' && role !== 'admin') {
            const ok = await confirm({
                title: `Demote @${user.login}?`,
                body: `They will lose admin access${user.githubId === meId ? ' — including your own access to this page' : ''}.`,
                confirmLabel: 'Demote',
                confirmVariant: 'warning',
            })
            if (!ok) return false
        }

        const res = await fetch(`/api/users/${user.githubId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role }),
        })
        if (res.ok) {
            const updated = (await res.json()) as UserRecord
            setRows((rs) => rs.map((u) => (u.githubId === updated.githubId ? updated : u)))
            toast.success(`@${user.login} is now ${role}`)
            return true
        }
        toast.error((await res.json().catch(() => ({}))).error ?? 'Update failed')
        return false
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <tc-heading as="h1">Users &amp; roles</tc-heading>
            <table className="table table-hover">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Added</th>
                        <th style={{ width: '180px' }}>Role</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((u) => {
                        const lastAdmin = u.role === 'admin' && adminCount === 1
                        return (
                            <tr key={u.githubId}>
                                <td>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <tc-avatar src={u.avatarUrl} name={u.name} size="small" />
                                        <span>
                                            <strong>@{u.login}</strong>
                                            {u.githubId === meId && <tc-badge variant="info">you</tc-badge>}
                                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{u.name}</div>
                                        </span>
                                    </span>
                                </td>
                                <td>{new Date(u.addedAt).toLocaleDateString()}</td>
                                <td>
                                    <RoleSelect
                                        value={u.role}
                                        disabled={lastAdmin}
                                        onChange={(role) => setRole(u, role)}
                                    />
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
