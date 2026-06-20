'use client'

import React, { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { useTcProps } from '@/lib/tc'
import { tcIcon } from '@/lib/icons'
import type { EngineState, ProjectSummary, UsageSnapshot } from '@/server/domain/types'
import { useNewProject } from './NewProjectModal'
import { useConfirm } from './ConfirmModal'
import { helpTexts } from './helpTexts'

const yFmt = (v: number) => `$${v.toFixed(2)}`

/** D1 — global per-day cost across all projects (renders only when costs exist). */
function GlobalCostSection() {
    const [days, setDays] = React.useState<{ date: string; costUsd: number }[] | null>(null)

    React.useEffect(() => {
        let cancelled = false
        fetch('/api/telemetry/global')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (!cancelled && d) setDays(d)
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [])

    const series = useMemo(
        () => [
            {
                label: 'cost/day',
                data: (days ?? []).map((d) => ({ x: d.date.slice(5), y: Math.round(d.costUsd * 100) / 100 })),
                color: '#6366f1',
            },
        ],
        [days],
    )
    const chartRef = useTcProps<HTMLElement>({ series, yFormatter: yFmt })

    if (!days || !days.some((d) => d.costUsd > 0)) return null
    const total = days.reduce((s, d) => s + d.costUsd, 0)

    return (
        <div className="tf-stack-sm">
            <tc-heading as="h2">Cost (30 days · all projects · ${total.toFixed(2)})</tc-heading>
            <tc-line-chart ref={chartRef} height="180" />
        </div>
    )
}

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
    const panelRef = useTcProps<HTMLElement>({ usage: panelUsage })

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <tc-heading as="h2">Agent usage</tc-heading>
                <tc-button variant="secondary" outline loading={refreshing || undefined} onClick={onRefresh}>
                    Refresh
                </tc-button>
            </div>

            {usage ? (
                <>
                    {usage.note && (
                        <tc-text as="p" variant="muted" style={{ margin: 0 }}>
                            {usage.note}
                        </tc-text>
                    )}
                    {panelUsage.length > 0 && <tc-usage-summary-panel ref={panelRef} />}
                    <tc-text as="small" variant="muted">
                        Last refreshed {new Date(usage.fetchedAt).toLocaleString()}
                    </tc-text>
                </>
            ) : (
                <tc-text as="p" variant="muted" style={{ margin: 0 }}>
                    No usage data cached yet — press Refresh to fetch it from the agent.
                </tc-text>
            )}
        </div>
    )
}

type Col = { key: string; header: string; align?: 'right'; render: (p: ProjectSummary) => React.ReactNode }

export function DashboardClient({ projects }: { projects: ProjectSummary[] }) {
    const router = useRouter()
    const newProject = useNewProject()
    const confirm = useConfirm()

    const pendingTotal = projects.reduce((sum, p) => sum + p.pending, 0)
    const running = projects.filter((p) => p.state !== 'IDLE').length

    const metrics = useMemo(
        () => [
            { key: 'projects', label: 'Projects', value: String(projects.length), icon: tcIcon('collection') },
            { key: 'pending', label: 'Pending tasks', value: String(pendingTotal), icon: tcIcon('list-task') },
            { key: 'running', label: 'Active runs', value: String(running), icon: tcIcon('play-circle') },
        ],
        [projects.length, pendingTotal, running],
    )
    const metricsRef = useTcProps<HTMLElement>({ items: metrics })

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

    const columns: Col[] = [
        { key: 'name', header: 'Project', render: (p) => <strong>{p.name}</strong> },
        { key: 'pending', header: 'Pending', align: 'right', render: (p) => p.pending },
        { key: 'done', header: 'Done', align: 'right', render: (p) => p.done },
        {
            key: 'error',
            header: 'Errors',
            align: 'right',
            render: (p) => (p.error > 0 ? <tc-badge variant="danger">{p.error}</tc-badge> : p.error),
        },
        {
            key: 'state',
            header: 'State',
            render: (p) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <tc-status-dot status={STATE_DOT[p.state]} pulse={p.state === 'RUNNING' || undefined} />
                    <tc-badge variant={STATE_BADGE[p.state]}>{p.state}</tc-badge>
                </span>
            ),
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (p) => (
                <tc-button
                    variant="danger"
                    outline
                    disabled={p.state !== 'IDLE' || undefined}
                    title={p.state !== 'IDLE' ? 'Stop the run before deleting' : 'Delete project'}
                    onClick={(e) => {
                        e.stopPropagation()
                        void onDelete(p.name)
                    }}
                >
                    Delete
                </tc-button>
            ),
        },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <tc-announcement-bar variant="info" icon-name={tcIcon('info-circle')} dismissible persist-dismiss-key="tf-intro-dashboard">
                {helpTexts.dashboard.intro}
            </tc-announcement-bar>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <tc-heading as="h1">Dashboard</tc-heading>
                <tc-button variant="primary" onClick={onNew}>
                    <span>＋</span> New project
                </tc-button>
            </div>

            <tc-metric-grid ref={metricsRef} columns={3} />

            <UsageSection />

            <GlobalCostSection />

            {projects.length === 0 ? (
                <tc-empty-state icon={tcIcon('inbox')}>
                    <h3>No projects yet</h3>
                    <p>{helpTexts.dashboard.empty}</p>
                    <div style={{ marginTop: '1rem' }}>
                        <tc-button variant="primary" onClick={onNew}>
                            <span>＋</span> New project
                        </tc-button>
                    </div>
                </tc-empty-state>
            ) : (
                <table className="table table-hover">
                    <thead>
                        <tr>
                            {columns.map((c) => (
                                <th key={c.key} style={c.align === 'right' ? { textAlign: 'right' } : undefined}>
                                    {c.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {projects.map((p) => (
                            <tr key={p.name} style={{ cursor: 'pointer' }} onClick={() => router.push(`/projects/${p.name}`)}>
                                {columns.map((c) => (
                                    <td key={c.key} style={c.align === 'right' ? { textAlign: 'right' } : undefined}>
                                        {c.render(p)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}
