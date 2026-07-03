'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMe } from '@/lib/me-context'
import type { DbServer } from '@/server/domain/types'
import { DbPage, json, useDbData } from './shared'

// Maintainer entry page for database management (perch_database_management.md
// §9): the servers the owner connected, click-through to the per-server detail
// (databases / users / access). Connecting new servers is owner-only and lives
// on the DB Servers admin page.

export function DbServersList() {
    const router = useRouter()
    const me = useMe()
    const fetcher = useCallback(async (): Promise<DbServer[] | null> => {
        try {
            return await fetch('/api/db-servers', { cache: 'no-store' }).then((r) => json<DbServer[]>(r))
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useDbData(fetcher)

    return (
        <DbPage
            title="Database servers"
            subtitle="Manage the databases, users, and access on the connected servers. Live reads — the server itself is the source of truth."
            icon="database"
            iconColor="cyan"
            state={state}
            onRetry={() => void reload()}
        >
            {(servers) =>
                servers.length === 0 ? (
                    <tc-empty-state icon="database">
                        {me.role === 'owner'
                            ? 'No database servers connected yet — add one under Admin → DB Servers.'
                            : 'No database servers connected yet — ask the owner to add one.'}
                    </tc-empty-state>
                ) : (
                    <div className="perch-admin-section">
                        {servers.map((s) => (
                            <tc-section-card key={s.id} title={s.name} icon="database">
                                <div className="perch-admin-section">
                                    <p className="perch-admin-hint">
                                        <span className="badge text-bg-info">{s.kind}</span>{' '}
                                        <span className="perch-admin-mono">{`${s.host}:${s.port}`}</span>
                                        {s.tls === 'require' && (
                                            <>
                                                {' '}
                                                <span className="badge text-bg-light">tls</span>
                                            </>
                                        )}
                                        {s.lastError && (
                                            <>
                                                {' '}
                                                <span className="badge text-bg-danger" title={s.lastError}>
                                                    last operation failed
                                                </span>
                                            </>
                                        )}
                                    </p>
                                    <div className="perch-list-actions">
                                        <tc-button
                                            variant="primary"
                                            size="sm"
                                            onClick={() => router.push(`/databases/${s.id}/databases`)}
                                        >
                                            Manage
                                        </tc-button>
                                    </div>
                                </div>
                            </tc-section-card>
                        ))}
                    </div>
                )
            }
        </DbPage>
    )
}
