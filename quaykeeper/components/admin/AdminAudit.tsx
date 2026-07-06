'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { escapeHtml, useTc } from '@/lib/tc'
import type { AuditEntry } from '@/server/domain/types'
import { AdminPage, json, useOwnerData } from './shared'

// Owner-only audit trail (§12/§13, impl §8) — rebuilt from the tc-timeline feed onto
// tc-advanced-table: server-side filters (object key / login / action prefix / site),
// offset pagination against the repo's COUNT, and a sortable Time column. Body rows are
// injected as HTML strings into the table's tbody (the AdminSites precedent) so React
// never owns slotted children and the web component's re-renders can't break
// reconciliation. Entries carrying a `meta` snapshot (B3) expand inline via <details>.

const PAGE_SIZE = 25

/** The audit query the table drives; every change refetches server-side. */
interface AuditQuery {
    filters: Record<string, string>
    offset: number
    order: 'asc' | 'desc'
}

interface AuditPage {
    entries: AuditEntry[]
    total: number
}

const INITIAL_QUERY: AuditQuery = { filters: {}, offset: 0, order: 'desc' }

/** Compose the `/api/admin/audit` URL for one query. */
function auditUrl(q: AuditQuery): string {
    const params = new URLSearchParams()
    for (const key of ['key', 'login', 'action', 'site'] as const) {
        const v = q.filters[key]?.trim()
        if (v) params.set(key, v)
    }
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String(q.offset))
    if (q.order === 'asc') params.set('order', 'asc')
    return `/api/admin/audit?${params.toString()}`
}

async function fetchAudit(q: AuditQuery): Promise<AuditPage | null> {
    try {
        return await fetch(auditUrl(q), { cache: 'no-store' }).then((r) => json<AuditPage>(r))
    } catch {
        return null
    }
}

/** Pretty-print a stored meta JSON string; fall back to the raw text on bad JSON. */
function prettyMeta(meta: string): string {
    try {
        return JSON.stringify(JSON.parse(meta), null, 2)
    } catch {
        return meta
    }
}

/** Wall-clock cell: "2026-07-03 14:05:09" from the stored ISO timestamp. */
function fmtAt(at: string): string {
    return String(at).replace('T', ' ').slice(0, 19)
}

/** The injected tbody rows — everything escaped; the Snapshot cell expands inline. */
function auditRowsHtml(entries: AuditEntry[]): string {
    if (entries.length === 0) {
        return `<tr><td colspan="6" class="quaykeeper-audit-empty-row"><tc-empty-state icon="scroll-text">No audit entries match.</tc-empty-state></td></tr>`
    }
    return entries
        .map((e) => {
            const snapshot = e.meta
                ? `<details class="quaykeeper-audit-snapshot"><summary>view</summary>` +
                  `<pre class="quaykeeper-admin-mono">${escapeHtml(prettyMeta(e.meta))}</pre></details>`
                : '<span class="quaykeeper-admin-hint">—</span>'
            return (
                `<tr>` +
                `<td class="quaykeeper-audit-time">${escapeHtml(fmtAt(e.at))}</td>` +
                `<td>@${escapeHtml(e.login ?? 'system')}</td>` +
                `<td><span class="quaykeeper-admin-mono">${escapeHtml(e.action)}</span></td>` +
                `<td>${e.site ? `<span class="quaykeeper-admin-mono">${escapeHtml(e.site)}</span>` : '<span class="quaykeeper-admin-hint">—</span>'}</td>` +
                `<td>${e.detail ? escapeHtml(e.detail) : '<span class="quaykeeper-admin-hint">—</span>'}</td>` +
                `<td>${snapshot}</td>` +
                `</tr>`
            )
        })
        .join('')
}

export function AdminAudit() {
    // The owner gate + first page load ride useOwnerData (shared frame behavior);
    // subsequent paging/filtering/sorting is the table's own fetch cycle below.
    const fetcher = useCallback(() => fetchAudit(INITIAL_QUERY), [])
    const { state, reload } = useOwnerData(fetcher)

    return (
        <AdminPage
            title="Audit"
            subtitle="The append-only trail of owner actions and quota events. Owner-only."
            icon="scroll-text"
            iconColor="amber"
            state={state}
            onRetry={() => void reload()}
        >
            {(firstPage) => <AuditTable firstPage={firstPage} />}
        </AdminPage>
    )
}

function AuditTable({ firstPage }: { firstPage: AuditPage }) {
    const [query, setQuery] = useState<AuditQuery>(INITIAL_QUERY)
    const [page, setPage] = useState<AuditPage>(firstPage)
    const [loading, setLoading] = useState(false)
    const [failed, setFailed] = useState(false)
    // Debounce timer for filter keystrokes — the component intentionally never
    // re-renders on filter input, so only the fetch needs damping.
    const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Refetch on every committed query change (skip the initial query — it's the
    // server-loaded first page).
    const firstQuery = useRef(true)
    useEffect(() => {
        if (firstQuery.current) {
            firstQuery.current = false
            return
        }
        let cancelled = false
        setLoading(true)
        setFailed(false)
        void fetchAudit(query).then((next) => {
            if (cancelled) return
            setLoading(false)
            if (next) setPage(next)
            else setFailed(true)
        })
        return () => {
            cancelled = true
        }
    }, [query])

    const onFilterChange = useCallback((e: Event) => {
        const { key, value } = (e as CustomEvent).detail as { key: string; value: string }
        if (debounce.current) clearTimeout(debounce.current)
        debounce.current = setTimeout(() => {
            setQuery((q) => ({ ...q, filters: { ...q.filters, [key]: value }, offset: 0 }))
        }, 300)
    }, [])

    const onSortChange = useCallback((e: Event) => {
        const { direction } = (e as CustomEvent).detail as { column: string | null; direction: string | null }
        // Only `at` is sortable; a cleared sort restores newest-first.
        setQuery((q) => ({ ...q, order: direction === 'asc' ? 'asc' : 'desc', offset: 0 }))
    }, [])

    const onPageChange = useCallback((e: Event) => {
        const { offset } = (e as CustomEvent).detail as { offset: number }
        setQuery((q) => ({ ...q, offset }))
    }, [])

    const tableProps = useMemo(
        () => ({
            columns: [
                { key: 'at', label: 'Time', width: '11rem' },
                { key: 'login', label: 'Actor', width: '9rem' },
                { key: 'action', label: 'Action', width: '13rem' },
                { key: 'site', label: 'Target', width: '11rem' },
                { key: 'detail', label: 'Detail' },
                { key: 'meta', label: 'Snapshot', width: '7rem' },
            ],
            filters: [
                { key: 'key', label: 'Object key', type: 'text', placeholder: 'api.example.com / db_pool' },
                { key: 'login', label: 'Actor', type: 'text', placeholder: 'login' },
                { key: 'action', label: 'Action prefix', type: 'text', placeholder: 'routing.' },
                { key: 'site', label: 'Site', type: 'text', placeholder: 'site id / hostname' },
            ],
            filterValues: query.filters,
            sortableColumns: ['at'],
            sort: { column: 'at', direction: query.order },
            total: page.total,
            limit: PAGE_SIZE,
            offset: query.offset,
            loading,
            // Body rows as the element-owned `rows` HTML string — relocation-safe,
            // re-applied by the component on every internal re-render.
            rows: auditRowsHtml(page.entries),
        }),
        [query.filters, query.order, query.offset, page.total, page.entries, loading],
    )

    const tableRef = useTc<HTMLElement>(tableProps, {
        'tc-filter-change': onFilterChange,
        'tc-sort-change': onSortChange,
        'tc-page-change': onPageChange,
    })

    const hasFilters = Object.values(query.filters).some((v) => v?.trim())

    return (
        <tc-section-card title="Audit trail" icon="scroll-text">
            <div className="quaykeeper-admin-section">
                {failed && <tc-banner variant="danger">Couldn’t load that page of the audit log.</tc-banner>}
                {page.total === 0 && !hasFilters && !loading ? (
                    <tc-empty-state icon="scroll-text">No audit entries yet.</tc-empty-state>
                ) : (
                    <tc-advanced-table ref={tableRef} />
                )}
            </div>
        </tc-section-card>
    )
}
