'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { SubTabBar, type SubTab } from '@/components/SubTabBar'
import type { DbServer } from '@/server/domain/types'
import { DbPage, json, useDbData } from './shared'
import { DatabasesTab } from './DatabasesTab'
import { UsersTab } from './UsersTab'
import { AccessTab } from './AccessTab'

// Per-server management page (`/databases/{id}/{databases|users|access}`,
// quaykeeper_database_management.md §9). Header + route-based SubTabBar (the
// InstanceDetail pattern); each tab component owns its own live reads.

export type DbServerTab = 'databases' | 'users' | 'access'

export function DbServerDetail({ serverId, tab }: { serverId: string; tab: DbServerTab }) {
    const router = useRouter()
    // The maintainer surface has no per-id server endpoint — the list is tiny and
    // already masked, so resolve the row client-side.
    const fetcher = useCallback(async (): Promise<DbServer | null> => {
        try {
            const servers = await fetch('/api/db-servers', { cache: 'no-store' }).then((r) =>
                json<DbServer[]>(r),
            )
            return servers.find((s) => s.id === serverId) ?? null
        } catch {
            return null
        }
    }, [serverId])
    const { state, reload } = useDbData(fetcher)

    const tabs: SubTab[] = [
        { id: 'databases', label: 'Databases', href: `/databases/${serverId}/databases` },
        { id: 'users', label: 'Users', href: `/databases/${serverId}/users` },
        { id: 'access', label: 'Access', href: `/databases/${serverId}/access` },
    ]

    return (
        <DbPage
            title="Database server"
            subtitle="Databases, users, and access on this server — all reads are live from its catalogs."
            icon="database"
            iconColor="cyan"
            state={state}
            onRetry={() => void reload()}
        >
            {(server) => (
                <>
                    <button type="button" className="quaykeeper-back" onClick={() => router.push('/databases')}>
                        ← All servers
                    </button>
                    <p className="quaykeeper-admin-hint">
                        <span className="quaykeeper-admin-realm-name">{server.name}</span>{' '}
                        <span className="badge text-bg-info">{server.kind}</span>{' '}
                        <span className="quaykeeper-admin-mono">{`${server.host}:${server.port}`}</span>
                    </p>
                    <SubTabBar tabs={tabs} />
                    {tab === 'databases' && <DatabasesTab server={server} />}
                    {tab === 'users' && <UsersTab server={server} />}
                    {tab === 'access' && <AccessTab server={server} />}
                </>
            )}
        </DbPage>
    )
}
