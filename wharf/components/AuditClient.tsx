'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { useTc } from '@/lib/tc'
import type { AuditEntry } from '@/server/domain/types'
import type { AdvancedTableColumn, AdvancedTableSort, TimelineItem } from '@toolcase/web-components'

const PAGE = 100
const TABLE_PAGE = 20

type View = 'timeline' | 'table'

// Map an audit action to a lucide glyph for the timeline node. Falls back to a
// generic dot when the action isn't recognised (Timeline draws a dot itself).
function actionIcon(action: string): string {
    const a = action.toLowerCase()
    if (a.includes('delete') || a.includes('revoke')) return 'trash-2'
    if (a.includes('create') || a.includes('add')) return 'plus'
    if (a.includes('reveal') || a.includes('export')) return 'eye'
    if (a.includes('clone')) return 'copy'
    if (a.includes('fetch') || a.includes('agent')) return 'download'
    if (a.includes('key')) return 'key-round'
    if (a.includes('member') || a.includes('role') || a.includes('user')) return 'users'
    return 'circle'
}

// Shared audit view: project-scoped when `projectId` is set, else the global log.
export function AuditClient({ projectId, title }: { projectId?: string; title: string }) {
    const base = projectId ? `/api/projects/${projectId}/audit` : '/api/audit'
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [err, setErr] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [done, setDone] = useState(false)
    const [view, setView] = useState<View>('timeline')
    const [offset, setOffset] = useState(0)
    const [sort, setSort] = useState<AdvancedTableSort | null>(null)

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

    // ── timeline items (scannable: when / who / action badge / detail) ─────────
    const timelineItems = useMemo<TimelineItem[]>(
        () =>
            entries.map((row) => ({
                title: row.action,
                date: new Date(row.at).toLocaleString(),
                meta: row.login ?? '—',
                description: row.detail ?? undefined,
                icon: actionIcon(row.action),
            })),
        [entries],
    )
    const timelineRef = useTc<HTMLElement>(
        useMemo(() => ({ items: timelineItems }), [timelineItems]),
    )

    // ── table view (sortable + paginated; client-side over loaded rows) ────────
    const columns = useMemo<AdvancedTableColumn[]>(
        () => [
            { key: 'at', label: 'When' },
            { key: 'login', label: 'Who' },
            { key: 'action', label: 'Action' },
            { key: 'detail', label: 'Detail' },
        ],
        [],
    )
    const sortable = useMemo(() => ['at', 'login', 'action'], [])

    const sorted = useMemo(() => {
        const list = [...entries]
        if (sort) {
            const dir = sort.direction === 'asc' ? 1 : -1
            list.sort((a, b) => {
                let av: number | string
                let bv: number | string
                if (sort.column === 'at') {
                    av = new Date(a.at).getTime()
                    bv = new Date(b.at).getTime()
                } else if (sort.column === 'login') {
                    av = (a.login ?? '').toLowerCase()
                    bv = (b.login ?? '').toLowerCase()
                } else {
                    av = a.action.toLowerCase()
                    bv = b.action.toLowerCase()
                }
                return av < bv ? -dir : av > bv ? dir : 0
            })
        }
        return list
    }, [entries, sort])

    const total = sorted.length
    const safeOffset = Math.min(offset, Math.max(0, total - 1))
    const pageRows = useMemo(() => sorted.slice(safeOffset, safeOffset + TABLE_PAGE), [sorted, safeOffset])

    const tableRef = useTc<HTMLElement>(
        useMemo(
            () => ({ columns, sortableColumns: sortable, sort, limit: TABLE_PAGE, offset: safeOffset, total }),
            [columns, sortable, sort, safeOffset, total],
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
    const tableKey = `${sort?.column ?? ''}_${sort?.direction ?? ''}_${safeOffset}_${pageRows.map((r) => r.id).join('-')}`

    return (
        <div className="wharf-page">
            <tc-rich-page-header icon-name="ScrollText" icon-color="slate" title-text={title} sub="Who did what, when" />


            {err && <tc-banner variant="error">{err}</tc-banner>}

            <tc-section-card title="Activity" icon="ScrollText">
                {entries.length > 0 && (
                    <div slot="action" style={{ display: 'flex', gap: '0.375rem' }}>
                        <tc-button
                            size="sm"
                            variant="secondary"
                            outline={view === 'timeline' ? undefined : true}
                            onClick={() => setView('timeline')}
                        >
                            Timeline
                        </tc-button>
                        <tc-button
                            size="sm"
                            variant="secondary"
                            outline={view === 'table' ? undefined : true}
                            onClick={() => setView('table')}
                        >
                            Table
                        </tc-button>
                    </div>
                )}
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
                    ) : view === 'timeline' ? (
                        <>
                            <tc-timeline ref={timelineRef} variant="minimal" connector="solid" />
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
                    ) : (
                        <>
                            <tc-advanced-table key={tableKey} ref={tableRef}>
                                {pageRows.map((row) => (
                                    <tr key={row.id}>
                                        <td style={{ whiteSpace: 'nowrap' }}>{new Date(row.at).toLocaleString()}</td>
                                        <td>{row.login ?? '—'}</td>
                                        <td>
                                            <tc-badge variant="info">{row.action}</tc-badge>
                                        </td>
                                        <td style={{ color: 'var(--tc-text-muted)' }}>{row.detail ?? ''}</td>
                                    </tr>
                                ))}
                            </tc-advanced-table>
                            {!done && (
                                <tc-button
                                    variant="secondary"
                                    outline
                                    size="sm"
                                    onClick={() => void loadPage(entries[entries.length - 1]?.id)}
                                    style={{ marginTop: '1rem' }}
                                >
                                    Load more rows
                                </tc-button>
                            )}
                        </>
                    )}
                </div>
            </tc-section-card>
        </div>
    )
}
