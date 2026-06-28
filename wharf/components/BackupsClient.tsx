'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import type { Backup } from '@/server/domain/types'

function fmtSize(n: number): string {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function BackupsClient() {
    const [backups, setBackups] = useState<Backup[] | null>(null)
    const [err, setErr] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

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
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        } finally {
            setBusy(false)
        }
    }

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
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Created</th>
                                    <th>Kind</th>
                                    <th>Size</th>
                                    <th>Key</th>
                                    <th style={{ textAlign: 'right' }}>Download</th>
                                </tr>
                            </thead>
                            <tbody>
                                {backups.map((b) => (
                                    <tr key={b.id}>
                                        <td>{new Date(b.createdAt).toLocaleString()}</td>
                                        <td>
                                            <tc-badge variant={b.kind === 'manual' ? 'primary' : 'secondary'}>{b.kind}</tc-badge>
                                        </td>
                                        <td>{fmtSize(b.sizeBytes)}</td>
                                        <td><code style={{ fontSize: '0.8125rem' }}>{b.keyId ?? '—'}</code></td>
                                        <td style={{ textAlign: 'right' }}>
                                            <a href={`/api/admin/backups/${b.id}`} download>
                                                Download
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </tc-section-card>
        </div>
    )
}
