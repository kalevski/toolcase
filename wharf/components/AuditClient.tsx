'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { useTc, escapeHtml } from '@/lib/tc'
import type { AuditEntry } from '@/server/domain/types'

const PAGE = 100

// Shared audit view: project-scoped when `projectId` is set, else the global log.
export function AuditClient({ projectId, title }: { projectId?: string; title: string }) {
    const base = projectId ? `/api/projects/${projectId}/audit` : '/api/audit'
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [err, setErr] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [done, setDone] = useState(false)

    const loadPage = useCallback(
        async (before?: number, signal?: AbortSignal) => {
            try {
                const url = `${base}?limit=${PAGE}${before ? `&before=${before}` : ''}`
                const page = await apiFetch<AuditEntry[]>(url, { signal })
                if (signal?.aborted) return
                setEntries((prev) => (before ? [...prev, ...page] : page))
                setDone(page.length < PAGE)
            } catch (e) {
                if (!signal?.aborted) setErr(describeApiError(e))
            } finally {
                if (!signal?.aborted) setLoading(false)
            }
        },
        [base],
    )

    useEffect(() => {
        const ctrl = new AbortController()
        void loadPage(undefined, ctrl.signal)
        return () => ctrl.abort()
    }, [loadPage])

    const columns = useMemo(
        () => [
            {
                key: 'at',
                header: 'When',
                render: (row: AuditEntry) =>
                    `<span style="white-space:nowrap">${escapeHtml(new Date(row.at).toLocaleString())}</span>`,
            },
            { key: 'login', header: 'Who', render: (row: AuditEntry) => escapeHtml(row.login ?? '—') },
            {
                key: 'action',
                header: 'Action',
                render: (row: AuditEntry) =>
                    `<tc-badge variant="info">${escapeHtml(row.action)}</tc-badge>`,
            },
            {
                key: 'detail',
                header: 'Detail',
                render: (row: AuditEntry) =>
                    `<span style="color:var(--tc-text-muted)">${escapeHtml(row.detail ?? '')}</span>`,
            },
        ],
        [],
    )
    const tableRef = useTc<HTMLElement>(useMemo(() => ({ columns, data: entries }), [columns, entries]))

    return (
        <div className="wharf-page">
            <tc-rich-page-header icon-name="ScrollText" icon-color="slate" title-text={title} sub="Who did what, when" />


            {err && <tc-banner variant="error">{err}</tc-banner>}

            <tc-section-card title="Activity" icon="ScrollText">
                <div className="wharf-section-body">
                    <p style={{ margin: '0 0 1rem', color: 'var(--tc-text-muted)' }}>
                        Reveals, value-bearing exports, agent fetches and clones are all recorded.
                    </p>
                    {loading ? (
                        <div className="wharf-status-line" role="status" aria-busy="true">
                            <tc-spinner type="border" size="sm" /> Loading…
                        </div>
                    ) : entries.length === 0 ? (
                        <tc-empty-state icon="ScrollText">
                            <h2>No activity yet</h2>
                            <p>Actions will appear here as they happen.</p>
                        </tc-empty-state>
                    ) : (
                        <>
                            <tc-table ref={tableRef} />
                            {!done && (
                                <tc-button
                                    variant="secondary"
                                    outline
                                    size="sm"
                                    onClick={() => void loadPage(entries[entries.length - 1]?.id)}
                                    style={{ marginTop: '1rem' }}
                                >
                                    Load more
                                </tc-button>
                            )}
                        </>
                    )}
                </div>
            </tc-section-card>
        </div>
    )
}
