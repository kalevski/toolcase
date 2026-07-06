'use client'

import React, { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { escapeHtml, useTc, useTcProps, useTcEvents } from '@/lib/tc'
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
        apiFetch<{ date: string; costUsd: number }[]>('/api/telemetry/global')
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

    // Account registry is owner-gated — fetch best-effort so non-owners still see
    // their (ambient) usage; they just get no account picker.
    React.useEffect(() => {
        let cancelled = false
        apiFetch<AccountSummary[]>('/api/accounts')
            .then((data) => {
                if (!cancelled && Array.isArray(data)) setAccounts(data)
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
        apiFetch<{ usage?: UsageSnapshot }>(`/api/usage${qs}`)
            .then((data) => {
                if (!cancelled) setUsage(data?.usage ?? null)
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
            // Spawns a one-shot /usage subprocess on the host — no client deadline.
            const data = await apiFetch<{ usage?: UsageSnapshot }>('/api/usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account: account || undefined }),
                timeoutMs: 0,
            })
            if (data?.usage) {
                setUsage(data.usage)
                toast.success('Usage refreshed')
            } else {
                toast.error('Failed to refresh usage')
            }
        } catch (e) {
            toast.error(describeApiError(e))
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

type ProjectTrend = { date: string; costUsd: number; runs: number }

// tc-advanced-table header descriptors. Body rows are fed through the `rows`
// HTML-string property (the component owns its <tbody>; React <tr> children
// would be relocated out from under the reconciler and break SSR hydration).
// Row navigation + the Delete button are delegated data-* clicks on the host.
const ADV_COLUMNS = [
    { key: 'name', label: 'Project' },
    { key: 'pending', label: 'Pending', align: 'right' as const },
    { key: 'done', label: 'Done', align: 'right' as const },
    { key: 'error', label: 'Errors', align: 'right' as const },
    { key: 'trend', label: 'Cost trend' },
    { key: 'state', label: 'State' },
    { key: 'actions', label: '', align: 'right' as const },
]

/** The injected tbody HTML — every interpolated value is escaped. */
function projectRowsHtml(projects: ProjectSummary[], trends: Record<string, ProjectTrend[]>): string {
    return projects
        .map((p) => {
            const series = trends[p.name] ?? []
            const data = series.map((d) => Math.round(d.costUsd * 100) / 100)
            // Need ≥2 points for a meaningful line; otherwise a muted dash. The
            // data-action="none" wrapper swallows clicks so hovering/clicking the
            // sparkline never triggers row navigation.
            let trend = '<span style="opacity: 0.4">—</span>'
            if (data.filter((v) => v > 0).length >= 2) {
                const total = series.reduce((s, d) => s + d.costUsd, 0)
                trend =
                    `<tc-tooltip content="${escapeHtml(`30-day cost $${total.toFixed(2)} · ${series.length} active day(s)`)}">` +
                    `<span data-action="none" style="display: inline-block">` +
                    `<tc-sparkline data="${data.join(',')}" type="line" color="#6366f1" width="96" height="28"></tc-sparkline>` +
                    `</span></tc-tooltip>`
            }
            const idle = p.state === 'IDLE'
            return (
                `<tr data-project="${escapeHtml(p.name)}" style="cursor: pointer">` +
                `<td><strong>${escapeHtml(p.name)}</strong></td>` +
                `<td style="text-align: right">${p.pending}</td>` +
                `<td style="text-align: right">${p.done}</td>` +
                `<td style="text-align: right">${p.error > 0 ? `<tc-badge variant="danger">${p.error}</tc-badge>` : p.error}</td>` +
                `<td>${trend}</td>` +
                `<td><span style="display: inline-flex; align-items: center; gap: 0.4rem">` +
                `<tc-status-dot status="${STATE_DOT[p.state]}"${p.state === 'RUNNING' ? ' pulse' : ''}></tc-status-dot>` +
                `<tc-badge variant="${STATE_BADGE[p.state]}">${p.state}</tc-badge>` +
                `</span></td>` +
                `<td style="text-align: right">` +
                `<tc-button variant="danger" outline${idle ? '' : ' disabled'} title="${idle ? 'Delete project' : 'Stop the run before deleting'}" data-action="delete" data-project="${escapeHtml(p.name)}">Delete</tc-button>` +
                `</td>` +
                `</tr>`
            )
        })
        .join('')
}

export function DashboardClient({ projects }: { projects: ProjectSummary[] }) {
    const router = useRouter()
    const newProject = useNewProject()
    const confirm = useConfirm()

    // Modernization — per-project 30-day cost trend, one fetch for the whole grid
    // (the route groups by project), rendered as a tc-sparkline on each row.
    const [trends, setTrends] = React.useState<Record<string, ProjectTrend[]>>({})
    React.useEffect(() => {
        let cancelled = false
        apiFetch<Record<string, ProjectTrend[]>>('/api/telemetry/global?by=project')
            .then((d) => {
                if (!cancelled && d) setTrends(d)
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [])

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
        try {
            await apiFetch(`/api/projects/${name}`, { method: 'DELETE' })
            toast.success(`Deleted ${name}`)
            router.refresh()
        } catch (e) {
            toast.error(describeApiError(e))
        }
    }

    // One delegated click listener: a data-action hit wins (delete acts, "none"
    // swallows sparkline clicks), otherwise a row click navigates to the project.
    const onTableClick = (event: Event) => {
        const target = event.target as HTMLElement
        const action = target.closest?.('[data-action]') as HTMLElement | null
        if (action) {
            if (action.getAttribute('data-action') === 'delete') {
                const name = action.getAttribute('data-project')
                if (name) void onDelete(name)
            }
            return
        }
        const row = target.closest?.('tr[data-project]') as HTMLElement | null
        if (row) router.push(`/projects/${row.getAttribute('data-project')}`)
    }

    const tableProps = useMemo(
        () => ({ columns: ADV_COLUMNS, rows: projectRowsHtml(projects, trends) }),
        [projects, trends],
    )
    const tableRef = useTc<HTMLElement>(tableProps, { click: onTableClick })

    return (
        <div className="taskforge-page">
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
                <tc-advanced-table ref={tableRef} />
            )}
        </div>
    )
}
