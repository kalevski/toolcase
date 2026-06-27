'use client'

import React, { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { useTc, useTcProps, useTcEvents } from '@/lib/tc'
import { tcIcon } from '@/lib/icons'
import type { AccountSummary, EngineState, ProjectSummary, UsageSnapshot } from '@/server/domain/types'
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
        <tc-stack gap="0.75rem">
            <tc-heading as="h2">Cost (30 days · all projects · ${total.toFixed(2)})</tc-heading>
            <tc-line-chart ref={chartRef} height="180" />
        </tc-stack>
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
    // '' = the ambient host login; otherwise a registry account alias.
    const [account, setAccount] = React.useState('')
    const [accounts, setAccounts] = React.useState<AccountSummary[]>([])

    // Account registry is admin-gated — fetch best-effort so non-admins still see
    // their (ambient) usage; they just get no account picker.
    React.useEffect(() => {
        let cancelled = false
        fetch('/api/accounts')
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => {
                if (!cancelled && Array.isArray(data)) setAccounts(data as AccountSummary[])
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [])

    // Load the cached snapshot for the selected account — never triggers /usage.
    React.useEffect(() => {
        let cancelled = false
        const qs = account ? `?account=${encodeURIComponent(account)}` : ''
        fetch(`/api/usage${qs}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!cancelled) setUsage((data?.usage as UsageSnapshot) ?? null)
            })
            .catch(() => {
                if (!cancelled) setUsage(null)
            })
        return () => {
            cancelled = true
        }
    }, [account])

    const accountRef = useTcEvents<HTMLElement>({ change: (e) => setAccount((e.target as HTMLSelectElement).value) })

    const onRefresh = async () => {
        setRefreshing(true)
        try {
            const res = await fetch('/api/usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account: account || undefined }),
            })
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
        <tc-stack gap="0.75rem">
            <tc-stack direction="horizontal" gap="1rem" wrap align="center" justify="space-between">
                <tc-heading as="h2">Agent usage</tc-heading>
                <tc-stack inline direction="horizontal" gap="0.5rem" align="flex-end">
                    {accounts.length > 0 && (
                        <div style={{ minWidth: 200 }}>
                            <tc-select ref={accountRef} label="Account" value={account}>
                                <tc-option value="">Default (host login)</tc-option>
                                {accounts.map((a) => (
                                    <tc-option key={a.alias} value={a.alias}>
                                        {a.alias}
                                        {a.label ? ` — ${a.label}` : ''}
                                    </tc-option>
                                ))}
                            </tc-select>
                        </div>
                    )}
                    <tc-button variant="secondary" outline loading={refreshing || undefined} onClick={onRefresh}>
                        Refresh
                    </tc-button>
                </tc-stack>
            </tc-stack>

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
                    {account
                        ? `No cached usage for ${account} yet — press Refresh to run /usage under that account.`
                        : 'No usage data cached yet — press Refresh to fetch it from the agent.'}
                </tc-text>
            )}
        </tc-stack>
    )
}

type Col = { key: string; header: string; align?: 'right'; render: (p: ProjectSummary) => React.ReactNode }

// tc-advanced-table header descriptors (the body rows are slotted React <tr>,
// so they keep their onClick navigation + Delete handler).
const ADV_COLUMNS = [
    { key: 'name', label: 'Project' },
    { key: 'pending', label: 'Pending', align: 'right' as const },
    { key: 'done', label: 'Done', align: 'right' as const },
    { key: 'error', label: 'Errors', align: 'right' as const },
    { key: 'state', label: 'State' },
    { key: 'actions', label: '', align: 'right' as const },
]

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

    // tc-advanced-table captures slotted <tr> into its own tbody on connect, so
    // React can't safely reorder them — remount with a fresh key whenever the
    // project set changes (router.refresh re-renders with new server data).
    const tableRef = useTc<HTMLElement>({ columns: ADV_COLUMNS })
    const tableKey = projects.map((p) => p.name).join('_')

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

            <tc-rich-page-header title-text="Dashboard" icon-name="LayoutDashboard" icon-color="blue">
                <tc-button slot="actions" variant="primary" onClick={onNew}>
                    <tc-icon name={tcIcon('Plus')} /> New project
                </tc-button>
            </tc-rich-page-header>

            <tc-metric-grid ref={metricsRef} columns={3} />

            <UsageSection />

            <GlobalCostSection />

            {projects.length === 0 ? (
                <tc-empty-state icon={tcIcon('inbox')}>
                    <h3>No projects yet</h3>
                    <p>{helpTexts.dashboard.empty}</p>
                    <div style={{ marginTop: '1rem' }}>
                        <tc-button variant="primary" onClick={onNew}>
                            <tc-icon name={tcIcon('Plus')} /> New project
                        </tc-button>
                    </div>
                </tc-empty-state>
            ) : (
                <tc-advanced-table key={tableKey} ref={tableRef}>
                    {projects.map((p) => (
                        <tr key={p.name} style={{ cursor: 'pointer' }} onClick={() => router.push(`/projects/${p.name}`)}>
                            {columns.map((c) => (
                                <td key={c.key} style={c.align === 'right' ? { textAlign: 'right' } : undefined}>
                                    {c.render(p)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tc-advanced-table>
            )}
        </div>
    )
}
