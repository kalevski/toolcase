'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
    MetricGrid,
    Table,
    Badge,
    StatusDot,
    EmptyState,
    Heading,
    type TableColumn,
} from '@toolcase/react-components'
import type { EngineState, RepoSummary } from '@/server/types'

const STATE_DOT: Record<EngineState, 'online' | 'offline' | 'busy' | 'away'> = {
    RUNNING: 'busy',
    SLEEPING: 'away',
    STOPPING: 'away',
    IDLE: 'offline',
}

const STATE_BADGE: Record<EngineState, 'info' | 'success' | 'warning' | 'secondary'> = {
    RUNNING: 'info',
    SLEEPING: 'warning',
    STOPPING: 'warning',
    IDLE: 'secondary',
}

export function DashboardClient({ repos }: { repos: RepoSummary[] }) {
    const router = useRouter()

    const pendingTotal = repos.reduce((sum, r) => sum + r.pending, 0)
    const running = repos.filter((r) => r.state !== 'IDLE').length

    const columns: TableColumn<RepoSummary>[] = [
        { key: 'name', header: 'Repository', render: (r) => <strong>{r.name}</strong> },
        { key: 'pending', header: 'Pending', align: 'right', render: (r) => r.pending },
        { key: 'done', header: 'Done', align: 'right', render: (r) => r.done },
        {
            key: 'error',
            header: 'Errors',
            align: 'right',
            render: (r) => (r.error > 0 ? <Badge variant="danger">{r.error}</Badge> : r.error),
        },
        {
            key: 'state',
            header: 'State',
            render: (r) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <StatusDot status={STATE_DOT[r.state]} pulse={r.state === 'RUNNING'} />
                    <Badge variant={STATE_BADGE[r.state]}>{r.state}</Badge>
                </span>
            ),
        },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Heading as="h1">Dashboard</Heading>

            <MetricGrid
                columns={3}
                items={[
                    { key: 'repos', label: 'Repositories', value: repos.length, icon: 'collection' },
                    { key: 'pending', label: 'Pending tasks', value: pendingTotal, icon: 'list-task' },
                    { key: 'running', label: 'Active runs', value: running, icon: 'play-circle' },
                ]}
            />

            {repos.length === 0 ? (
                <EmptyState icon="inbox">
                    <h3>No repositories</h3>
                    <p>
                        Clone a git repository into <code>/workspace/repos/&lt;name&gt;</code> to get started.
                    </p>
                </EmptyState>
            ) : (
                <Table
                    columns={columns}
                    data={repos}
                    rowKey={(r) => r.name}
                    hoverable
                    onRowClick={(r) => router.push(`/repos/${r.name}`)}
                />
            )}
        </div>
    )
}
