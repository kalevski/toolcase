'use client'

// D3 — admin audit-log table with filters.

import React, { useCallback, useEffect, useState } from 'react'
import { useTcEvents } from '@/lib/tc'
import type { AuditRecord } from '@/server/domain/types'
import { helpTexts } from './helpTexts'

type Col = { key: string; header: string; width?: string; render: (e: AuditRecord) => React.ReactNode }

export function AuditClient() {
    const [entries, setEntries] = useState<AuditRecord[]>([])
    const [actions, setActions] = useState<string[]>([])
    const [total, setTotal] = useState(0)
    const [project, setProject] = useState('')
    const [login, setLogin] = useState('')
    const [action, setAction] = useState('')
    const [loading, setLoading] = useState(false)

    const projectRef = useTcEvents<HTMLElement>({ input: (e) => setProject((e.target as HTMLInputElement).value) })
    const loginRef = useTcEvents<HTMLElement>({ input: (e) => setLogin((e.target as HTMLInputElement).value) })
    const actionRef = useTcEvents<HTMLElement>({ change: (e) => setAction((e.target as HTMLSelectElement).value) })

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

    // Debounce so typing in the Project/User filters fires one request after the
    // user pauses, not one per keystroke (which also raced response ordering).
    useEffect(() => {
        const t = setTimeout(() => void load(), 250)
        return () => clearTimeout(t)
    }, [load])

    const columns: Col[] = [
        {
            key: 'at',
            header: 'When',
            width: '12rem',
            render: (e) => <tc-text variant="muted">{new Date(e.at).toLocaleString()}</tc-text>,
        },
        { key: 'login', header: 'Who', width: '9rem', render: (e) => <code>{e.login ?? '—'}</code> },
        { key: 'action', header: 'Action', width: '11rem', render: (e) => <tc-badge variant="secondary">{e.action}</tc-badge> },
        {
            key: 'project',
            header: 'Project',
            width: '10rem',
            render: (e) => (e.project ? <code>{e.project}</code> : <span style={{ opacity: 0.4 }}>—</span>),
        },
        { key: 'detail', header: 'Detail', render: (e) => <tc-text variant="muted">{e.detail ?? ''}</tc-text> },
    ]

    const oldest = entries.length ? entries[entries.length - 1].id : undefined

    return (
        <div className="tf-stack">
            <tc-helper-text text={helpTexts.audit.intro} />
            <div className="tf-form-row">
                <tc-input ref={projectRef} label="Project" placeholder="filter…" value={project} />
                <tc-input ref={loginRef} label="User" placeholder="login" value={login} />
                <div style={{ minWidth: 220 }}>
                    <tc-select ref={actionRef} label="Action" value={action}>
                        <tc-option value="">All actions</tc-option>
                        {actions.map((a) => (
                            <tc-option key={a} value={a}>
                                {a}
                            </tc-option>
                        ))}
                    </tc-select>
                </div>
            </div>
            <table className="table">
                <thead>
                    <tr>
                        {columns.map((c) => (
                            <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                                {c.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {entries.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} style={{ textAlign: 'center', opacity: 0.6 }}>
                                No audit entries match.
                            </td>
                        </tr>
                    ) : (
                        entries.map((e) => (
                            <tr key={String(e.id)}>
                                {columns.map((c) => (
                                    <td key={c.key}>{c.render(e)}</td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
            <div className="tf-actions">
                <tc-text variant="muted">
                    {entries.length} of {total} entries
                </tc-text>
                {entries.length < total && oldest && (
                    <tc-button size="sm" variant="secondary" outline disabled={loading || undefined} onClick={() => void load(oldest)}>
                        Load older
                    </tc-button>
                )}
            </div>
        </div>
    )
}
