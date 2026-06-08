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
    Button,
    UsageSummaryPanel,
    Text,
    toast,
    type TableColumn,
} from '@toolcase/react-components'
import type { EngineState, ProjectSummary, UsageSnapshot } from '@/server/types'
import { useNewProject } from './NewProjectModal'
import { useConfirm } from './ConfirmModal'

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

function UsageSection() {
    const [usage, setUsage] = React.useState<UsageSnapshot | null>(null)
    const [refreshing, setRefreshing] = React.useState(false)

    // Load the cached snapshot on mount — never triggers /usage on its own.
    React.useEffect(() => {
        let cancelled = false
        fetch('/api/usage')
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!cancelled && data?.usage) setUsage(data.usage as UsageSnapshot)
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [])

    const onRefresh = async () => {
        setRefreshing(true)
        try {
            const res = await fetch('/api/usage', { method: 'POST' })
            const data = await res.json().catch(() => ({}))
            if (res.ok && data.usage) {
                setUsage(data.usage as UsageSnapshot)
                toast.success('Usage refreshed')
            } else {
                toast.error(data.error ?? 'Failed to refresh usage')
            }
        } catch {
            toast.error('Failed to refresh usage')
        } finally {
            setRefreshing(false)
        }
    }

    const panelUsage = (usage?.entries ?? []).map((e) => ({
        label: e.resets ? `${e.label} · resets ${e.resets}` : e.label,
        used: e.percent,
        total: 100,
        measurementUnit: '%',
        warn: e.percent >= 80,
    }))

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <Heading as="h2">Agent usage</Heading>
                <Button variant="secondary" outline loading={refreshing} onClick={onRefresh}>
                    Refresh
                </Button>
            </div>

            {usage ? (
                <>
                    {usage.note && (
                        <Text as="p" variant="muted" style={{ margin: 0 }}>
                            {usage.note}
                        </Text>
                    )}
                    {panelUsage.length > 0 && <UsageSummaryPanel usage={panelUsage} />}
                    <Text as="small" variant="muted">
                        Last refreshed {new Date(usage.fetchedAt).toLocaleString()}
                    </Text>
                </>
            ) : (
                <Text as="p" variant="muted" style={{ margin: 0 }}>
                    No usage data cached yet — press Refresh to fetch it from the agent.
                </Text>
            )}
        </div>
    )
}

export function DashboardClient({ projects }: { projects: ProjectSummary[] }) {
    const router = useRouter()
    const newProject = useNewProject()
    const confirm = useConfirm()

    const pendingTotal = projects.reduce((sum, p) => sum + p.pending, 0)
    const running = projects.filter((p) => p.state !== 'IDLE').length

    const onNew = async () => {
        const name = await newProject()
        if (name) router.push(`/projects/${name}`)
    }

    const onDelete = async (name: string) => {
        const ok = await confirm({
            title: `Delete ${name}?`,
            body: 'This permanently removes the project folder (repo clone, tasks, knowledge, logs). This cannot be undone.',
            confirmLabel: 'Delete project',
            confirmVariant: 'danger',
        })
        if (!ok) return
        const res = await fetch(`/api/projects/${name}`, { method: 'DELETE' })
        if (res.ok) {
            toast.success(`Deleted ${name}`)
            router.refresh()
        } else {
            const data = await res.json().catch(() => ({}))
            toast.error(data.error ?? 'Failed to delete project')
        }
    }

    const columns: TableColumn<ProjectSummary>[] = [
        { key: 'name', header: 'Project', render: (p) => <strong>{p.name}</strong> },
        { key: 'pending', header: 'Pending', align: 'right', render: (p) => p.pending },
        { key: 'done', header: 'Done', align: 'right', render: (p) => p.done },
        {
            key: 'error',
            header: 'Errors',
            align: 'right',
            render: (p) => (p.error > 0 ? <Badge variant="danger">{p.error}</Badge> : p.error),
        },
        {
            key: 'state',
            header: 'State',
            render: (p) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <StatusDot status={STATE_DOT[p.state]} pulse={p.state === 'RUNNING'} />
                    <Badge variant={STATE_BADGE[p.state]}>{p.state}</Badge>
                </span>
            ),
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (p) => (
                <Button
                    variant="danger"
                    outline
                    disabled={p.state !== 'IDLE'}
                    title={p.state !== 'IDLE' ? 'Stop the run before deleting' : 'Delete project'}
                    onClick={(e) => {
                        e.stopPropagation()
                        void onDelete(p.name)
                    }}
                >
                    Delete
                </Button>
            ),
        },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <Heading as="h1">Dashboard</Heading>
                <Button variant="primary" startIcon={<span>＋</span>} onClick={onNew}>
                    New project
                </Button>
            </div>

            <MetricGrid
                columns={3}
                items={[
                    { key: 'projects', label: 'Projects', value: projects.length, icon: 'collection' },
                    { key: 'pending', label: 'Pending tasks', value: pendingTotal, icon: 'list-task' },
                    { key: 'running', label: 'Active runs', value: running, icon: 'play-circle' },
                ]}
            />

            <UsageSection />

            {projects.length === 0 ? (
                <EmptyState icon="inbox">
                    <h3>No projects yet</h3>
                    <p>
                        Create a project from a git URL — TaskForge clones it into a dedicated workspace and Claude
                        works the queued tasks.
                    </p>
                    <div style={{ marginTop: '1rem' }}>
                        <Button variant="primary" startIcon={<span>＋</span>} onClick={onNew}>
                            New project
                        </Button>
                    </div>
                </EmptyState>
            ) : (
                <Table
                    columns={columns}
                    data={projects}
                    rowKey={(p) => p.name}
                    hoverable
                    onRowClick={(p) => router.push(`/projects/${p.name}`)}
                />
            )}
        </div>
    )
}
