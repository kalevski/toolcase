'use client'

// D3 — admin audit-log table with filters.

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTcEvents, useTcProps, escapeHtml } from '@/lib/tc'
import type { AuditRecord } from '@/server/domain/types'
import { helpTexts } from './helpTexts'

// Read-only table → tc-table. Cells are emitted as HTML strings (the tc-table
// `render` contract); all record-derived text is escaped to avoid injection.
const COLUMNS = [
    {
        key: 'at',
        header: 'When',
        width: '12rem',
        render: (e: AuditRecord) => `<tc-text variant="muted">${escapeHtml(new Date(e.at).toLocaleString())}</tc-text>`,
    },
    { key: 'login', header: 'Who', width: '9rem', render: (e: AuditRecord) => `<code>${escapeHtml(e.login ?? '—')}</code>` },
    {
        key: 'action',
        header: 'Action',
        width: '11rem',
        render: (e: AuditRecord) => `<tc-badge variant="secondary">${escapeHtml(e.action)}</tc-badge>`,
    },
    {
        key: 'project',
        header: 'Project',
        width: '10rem',
        render: (e: AuditRecord) =>
            e.project ? `<code>${escapeHtml(e.project)}</code>` : `<span style="opacity:0.4">—</span>`,
    },
    { key: 'detail', header: 'Detail', render: (e: AuditRecord) => `<tc-text variant="muted">${escapeHtml(e.detail ?? '')}</tc-text>` },
]

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

    const oldest = entries.length ? entries[entries.length - 1].id : undefined

    const tableRef = useTcProps<HTMLElement>(
        useMemo(() => ({ columns: COLUMNS, data: entries }), [entries]),
    )

    return (
        <tc-stack gap="1.25rem">
            <tc-helper-text text={helpTexts.audit.intro} />
            <tc-stack direction="horizontal" gap="1rem" wrap align="flex-end">
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
            </tc-stack>
            <tc-table
                ref={tableRef}
                hoverable
                empty-message="No audit entries match."
                loading={loading && entries.length === 0 ? true : undefined}
            />
            <tc-stack direction="horizontal" gap="0.75rem" wrap align="center">
                <tc-text variant="muted">
                    {entries.length} of {total} entries
                </tc-text>
                {entries.length < total && oldest && (
                    <tc-button size="sm" variant="secondary" outline disabled={loading || undefined} onClick={() => void load(oldest)}>
                        Load older
                    </tc-button>
                )}
            </tc-stack>
        </tc-stack>
    )
}
