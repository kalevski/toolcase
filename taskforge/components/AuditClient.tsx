'use client'

// D3 — admin audit-log table with filters.

import React, { useCallback, useEffect, useState } from 'react'
import { Table, Badge, Button, Input, Select, Text, HelperText, type TableColumn } from '@toolcase/react-components'
import type { AuditRecord } from '@/server/domain/types'
import { helpTexts } from './helpTexts'

export function AuditClient() {
    const [entries, setEntries] = useState<AuditRecord[]>([])
    const [actions, setActions] = useState<string[]>([])
    const [total, setTotal] = useState(0)
    const [project, setProject] = useState('')
    const [login, setLogin] = useState('')
    const [action, setAction] = useState('')
    const [loading, setLoading] = useState(false)

    const load = useCallback(
        async (beforeId?: number) => {
            setLoading(true)
            try {
                const params = new URLSearchParams()
                if (project) params.set('project', project)
                if (login) params.set('login', login)
                if (action) params.set('action', action)
                if (beforeId) params.set('beforeId', String(beforeId))
                const d = await fetch(`/api/audit?${params}`).then((r) => (r.ok ? r.json() : null))
                if (d) {
                    setEntries((prev) => (beforeId ? [...prev, ...d.entries] : d.entries))
                    setActions(d.actions)
                    setTotal(d.total)
                }
            } finally {
                setLoading(false)
            }
        },
        [project, login, action],
    )

    useEffect(() => {
        void load()
    }, [load])

    const columns: TableColumn<AuditRecord>[] = [
        {
            key: 'at',
            header: 'When',
            width: '12rem',
            render: (e) => <Text variant="muted">{new Date(e.at).toLocaleString()}</Text>,
        },
        { key: 'login', header: 'Who', width: '9rem', render: (e) => <code>{e.login ?? '—'}</code> },
        { key: 'action', header: 'Action', width: '11rem', render: (e) => <Badge variant="secondary">{e.action}</Badge> },
        { key: 'project', header: 'Project', width: '10rem', render: (e) => (e.project ? <code>{e.project}</code> : <span style={{ opacity: 0.4 }}>—</span>) },
        { key: 'detail', header: 'Detail', render: (e) => <Text variant="muted">{e.detail ?? ''}</Text> },
    ]

    const oldest = entries.length ? entries[entries.length - 1].id : undefined

    return (
        <div className="tf-stack">
            <HelperText text={helpTexts.audit.intro} />
            <div className="tf-form-row">
                <Input label="Project" placeholder="filter…" value={project} onChange={(e) => setProject(e.target.value)} />
                <Input label="User" placeholder="login" value={login} onChange={(e) => setLogin(e.target.value)} />
                <div style={{ minWidth: 220 }}>
                    <Select
                        label="Action"
                        options={[{ value: '', label: 'All actions' }, ...actions.map((a) => ({ value: a, label: a }))]}
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                    />
                </div>
            </div>
            <Table columns={columns} data={entries} rowKey={(e) => String(e.id)} emptyMessage="No audit entries match." />
            <div className="tf-actions">
                <Text variant="muted">
                    {entries.length} of {total} entries
                </Text>
                {entries.length < total && oldest && (
                    <Button size="small" variant="secondary" outline disabled={loading} onClick={() => void load(oldest)}>
                        Load older
                    </Button>
                )}
            </div>
        </div>
    )
}
