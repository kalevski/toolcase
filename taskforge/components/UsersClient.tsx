'use client'

import React, { useState } from 'react'
import { Heading, Table, Avatar, Select, Badge, toast, type TableColumn } from '@toolcase/react-components'
import type { Role, UserRecord } from '@/server/types'
import { useConfirm } from './ConfirmModal'

const ROLE_OPTIONS = [
    { value: 'admin', label: 'admin' },
    { value: 'standard', label: 'standard' },
    { value: 'guest', label: 'guest' },
]

export function UsersClient({ users, meId }: { users: UserRecord[]; meId: number }) {
    const confirm = useConfirm()
    const [rows, setRows] = useState(users)

    const adminCount = rows.filter((u) => u.role === 'admin').length

    const setRole = async (user: UserRecord, role: Role) => {
        if (role === user.role) return

        // last-admin guard mirrored client-side
        if (user.role === 'admin' && role !== 'admin' && adminCount === 1) {
            toast.error('Cannot demote the last remaining admin.')
            return
        }
        if (user.role === 'admin' && role !== 'admin') {
            const ok = await confirm({
                title: `Demote @${user.login}?`,
                body: `They will lose admin access${user.githubId === meId ? ' — including your own access to this page' : ''}.`,
                confirmLabel: 'Demote',
                confirmVariant: 'warning',
            })
            if (!ok) return
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
        } else {
            toast.error((await res.json().catch(() => ({}))).error ?? 'Update failed')
        }
    }

    const columns: TableColumn<UserRecord>[] = [
        {
            key: 'user',
            header: 'User',
            render: (u) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Avatar src={u.avatarUrl} name={u.name} size="small" />
                    <span>
                        <strong>@{u.login}</strong>
                        {u.githubId === meId && (
                            <Badge variant="info" size="sm">
                                you
                            </Badge>
                        )}
                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{u.name}</div>
                    </span>
                </span>
            ),
        },
        { key: 'added', header: 'Added', render: (u) => new Date(u.addedAt).toLocaleDateString() },
        {
            key: 'role',
            header: 'Role',
            width: '180px',
            render: (u) => {
                const lastAdmin = u.role === 'admin' && adminCount === 1
                return (
                    <Select
                        options={ROLE_OPTIONS}
                        value={u.role}
                        disabled={lastAdmin}
                        onChange={(e) => setRole(u, e.target.value as Role)}
                    />
                )
            },
        },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Heading as="h1">Users &amp; roles</Heading>
            <Table columns={columns} data={rows} rowKey={(u) => String(u.githubId)} />
        </div>
    )
}
