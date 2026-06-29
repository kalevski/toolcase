'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { useTc } from '@/lib/tc'
import type { Backup } from '@/server/domain/types'
import type { AdvancedTableColumn, AdvancedTableSort } from '@toolcase/web-components'

const PAGE_SIZE = 10

const COLUMNS: AdvancedTableColumn[] = [
    { key: 'createdAt', label: 'Created' },
    { key: 'kind', label: 'Kind' },
    { key: 'sizeBytes', label: 'Size', align: 'right' },
    { key: 'keyId', label: 'Key' },
    { key: 'download', label: 'Download', align: 'right' },
]
const SORTABLE = ['createdAt', 'kind', 'sizeBytes']

function fmtSize(n: number): string {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function BackupsClient() {
    const [backups, setBackups] = useState<Backup[] | null>(null)
    const [err, setErr] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [offset, setOffset] = useState(0)
    const [sort, setSort] = useState<AdvancedTableSort | null>({ column: 'createdAt', direction: 'desc' })

    const load = useCallback(async (signal?: AbortSignal) => {
        try {
            setBackups(await apiFetch<Backup[]>('/api/admin/backups', { signal }))
        } catch (e) {
            if (!signal?.aborted) setErr(describeApiError(e))
        }
    }, [])

    useEffect(() => {
        const ctrl = new AbortController()
        void load(ctrl.signal)
        return () => ctrl.abort()
    }, [load])

    const takeNow = async () => {
        setBusy(true)
        setErr(null)
        try {
            await apiFetch('/api/admin/backups', { method: 'POST' })
            setOffset(0)
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        } finally {
            setBusy(false)
        }
    }

    const sorted = useMemo(() => {
        const list = [...(backups ?? [])]
        if (sort) {
            const dir = sort.direction === 'asc' ? 1 : -1
            list.sort((a, b) => {
                let av: number | string
                let bv: number | string
                if (sort.column === 'sizeBytes') {
                    av = a.sizeBytes
                    bv = b.sizeBytes
                } else if (sort.column === 'kind') {
                    av = a.kind
                    bv = b.kind
                } else {
                    av = new Date(a.createdAt).getTime()
                    bv = new Date(b.createdAt).getTime()
                }
                return av < bv ? -dir : av > bv ? dir : 0
            })
        }
        return list
    }, [backups, sort])

    const total = sorted.length
    const safeOffset = Math.min(offset, Math.max(0, total - 1))
    const pageRows = useMemo(() => sorted.slice(safeOffset, safeOffset + PAGE_SIZE), [sorted, safeOffset])

    const tableRef = useTc<HTMLElement>(
        useMemo(
            () => ({ columns: COLUMNS, sortableColumns: SORTABLE, sort, limit: PAGE_SIZE, offset: safeOffset, total }),
            [sort, safeOffset, total],
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

    const tableKey = `${sort?.column ?? ''}_${sort?.direction ?? ''}_${safeOffset}_${pageRows.map((b) => b.id).join('-')}`

    return (
        <div className="wharf-page">
            <tc-rich-page-header
                icon-name="DatabaseBackup"
                icon-color="rose"
                title-text="Backups"
                sub="Encrypted SQLite snapshots"
            >
                <tc-button slot="actions" variant="primary" onClick={takeNow} disabled={busy}>
                    {busy ? 'Taking…' : 'Take backup now'}
                </tc-button>
            </tc-rich-page-header>

            {err && <tc-banner variant="error">{err}</tc-banner>}

            <tc-banner variant="warning">
                Restore is a manual procedure: stop the app → decrypt the blob with your <code>ENCRYPTION_KEY</code> →
                replace <code>DB_PATH</code> → restart. There is no one-click restore (decision #15).
            </tc-banner>

            <tc-section-card title="Snapshots" icon="DatabaseBackup">
                <div className="wharf-section-body">
                    <p style={{ margin: '0 0 1rem', color: 'var(--tc-text-muted)' }}>
                        AES-256-GCM. Taken automatically on a schedule; take one now from the header.
                    </p>
                    {backups === null ? (
                        <div className="wharf-status-line" role="status" aria-busy="true">
                            <tc-spinner type="border" size="sm" /> Loading…
                        </div>
                    ) : backups.length === 0 ? (
                        <tc-empty-state icon="DatabaseBackup">
                            <h2>No backups yet</h2>
                            <p>Take one now, or wait for the scheduled snapshot.</p>
                        </tc-empty-state>
                    ) : (
                        <tc-advanced-table key={tableKey} ref={tableRef}>
                            {pageRows.map((b) => (
                                <tr key={b.id}>
                                    <td>{new Date(b.createdAt).toLocaleString()}</td>
                                    <td>
                                        <tc-badge variant={b.kind === 'manual' ? 'primary' : 'secondary'}>{b.kind}</tc-badge>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{fmtSize(b.sizeBytes)}</td>
                                    <td><code style={{ fontSize: '0.8125rem' }}>{b.keyId ?? '—'}</code></td>
                                    <td style={{ textAlign: 'right' }}>
                                        <a href={`/api/admin/backups/${b.id}`} download>
                                            Download
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tc-advanced-table>
                    )}
                </div>
            </tc-section-card>
        </div>
    )
}
