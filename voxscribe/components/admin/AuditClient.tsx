'use client'

// Admin → Audit (spec §9): the audit table, paged, newest first.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TableColumn } from '@toolcase/web-components'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { escapeHtml } from '@/lib/tc'
import { DataTable } from '@/components/DataTable'
import { LoadingState, ErrorState } from '@/components/states'
import type { AuditEntry } from '@/server/domain/types'

interface AuditResponse {
    entries: AuditEntry[]
    total: number
    page: number
    pageSize: number
}

export function AuditClient() {
    const [data, setData] = useState<AuditResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [page, setPage] = useState(1)

    const load = useCallback(async () => {
        setError(null)
        try {
            setData(await apiFetch<AuditResponse>(`/api/audit?page=${page}`))
        } catch (err) {
            setError(describeApiError(err))
        }
    }, [page])

    useEffect(() => {
        void load()
    }, [load])

    const columns = useMemo<TableColumn[]>(
        () => [
            { key: 'at', header: 'When', render: (row: any) => escapeHtml(String((row as AuditEntry).at).slice(0, 19).replace('T', ' ')) },
            { key: 'login', header: 'Who', render: (row: any) => escapeHtml((row as AuditEntry).login ?? 'system') },
            { key: 'action', header: 'Action' },
            { key: 'detail', header: 'Detail', render: (row: any) => escapeHtml((row as AuditEntry).detail ?? '') },
        ],
        [],
    )

    if (error) return <ErrorState message={error} onRetry={load} />
    if (!data) return <LoadingState shape="rows" count={8} />

    const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))

    return (
        <div className="voxscribe-page">
            <h1>Audit</h1>
            <DataTable
                columns={columns}
                rows={data.entries as unknown as Record<string, unknown>[]}
                rowKey={(row) => String(row.id)}
                emptyMessage="No audit entries yet."
            />
            {totalPages > 1 && (
                <div className="voxscribe-pager">
                    <tc-button variant="secondary" outline size="sm" disabled={page <= 1 || undefined} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                        ← Prev
                    </tc-button>
                    <span>
                        Page {data.page} of {totalPages}
                    </span>
                    <tc-button variant="secondary" outline size="sm" disabled={page >= totalPages || undefined} onClick={() => setPage((p) => p + 1)}>
                        Next →
                    </tc-button>
                </div>
            )}
        </div>
    )
}
