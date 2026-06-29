'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { useTcProps, escapeHtml } from '@/lib/tc'
import { tcIcon } from '@/lib/icons'
import type { TelemetrySummary } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { useConfirm } from '../ConfirmModal'
import { helpTexts } from '../helpTexts'

const yFmt = (v: number) => `$${v.toFixed(2)}`

// Read-only per-model breakdown → tc-table (HTML-string cells; model name escaped).
type PerModelRow = TelemetrySummary['perModel'][number]
const PERMODEL_COLUMNS = [
    { key: 'model', header: 'Model', render: (m: PerModelRow) => `<code>${escapeHtml(m.model)}</code>` },
    { key: 'count', header: 'Attempts', width: '7rem', render: (m: PerModelRow) => String(m.count) },
    { key: 'avgElapsed', header: 'Avg elapsed', width: '8rem', render: (m: PerModelRow) => `${escapeHtml(m.avgElapsed)}s` },
    {
        key: 'cost',
        header: 'Cost',
        width: '7rem',
        render: (m: PerModelRow) => (m.costUsd > 0 ? `$${m.costUsd.toFixed(2)}` : '—'),
    },
]

export function OverviewClient() {
    const router = useRouter()
    const confirm = useConfirm()
    const { project, tasks, git, snapshot, wakeAt } = useProject()

    // D1 — telemetry aggregates (loaded lazily; absent until first run).
    const [summary, setSummary] = useState<TelemetrySummary | null>(null)
    const fetchSummary = useCallback(() => {
        let cancelled = false
        fetch(`/api/projects/${project}/telemetry/summary`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (!cancelled && d) setSummary(d)
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [project])

    // Initial load (and on project change).
    useEffect(() => fetchSummary(), [fetchSummary])

    // Refetch only when the run settles (state === 'IDLE'); depending on the raw
    // snapshot.state would refetch on every mid-run transition (IDLE→RUNNING→
    // SLEEPING→…). The `settled` boolean is stable across those transitions, so
    // this fires once when the engine returns to IDLE. Mount is already covered
    // by the initial-load effect above, so skip the first run to avoid a
    // duplicate fetch when the page opens while already IDLE.
    const settled = snapshot.state === 'IDLE'
    const mounted = useRef(false)
    useEffect(() => {
        if (!mounted.current) {
            mounted.current = true
            return
        }
        if (settled) return fetchSummary()
    }, [settled, fetchSummary])

    const [generating, setGenerating] = useState(false)
    const resetClaudeMd = async () => {
        const ok = await confirm({
            title: 'Reset CLAUDE.md to template?',
            body: 'This overwrites the project CLAUDE.md with the default template. Any local edits will be lost. This cannot be undone.',
            confirmLabel: 'Reset CLAUDE.md',
            confirmVariant: 'warning',
        })
        if (!ok) return
        setGenerating(true)
        try {
            const res = await fetch(`/api/projects/${project}/claude-md`, { method: 'POST' })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error ?? 'Failed to reset CLAUDE.md')
                return
            }
            toast.success('CLAUDE.md reset to template')
        } catch {
            toast.error('Failed to reset CLAUDE.md')
        } finally {
            setGenerating(false)
        }
    }

    const total = tasks.length
    const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'running').length
    const done = tasks.filter((t) => t.status === 'done').length
    const error = tasks.filter((t) => t.status === 'error').length

    const showCostChart = !!summary && summary.perDay.some((d) => d.costUsd > 0)

    // All chart/grid data set as element properties (hooks must run unconditionally).
    const topMetrics = useMemo(
        () => [
            { key: 'total', label: 'Tasks', value: String(total), icon: tcIcon('list-task') },
            { key: 'pending', label: 'Pending', value: String(pending), icon: tcIcon('hourglass-split') },
            { key: 'done', label: 'Done', value: String(done), icon: tcIcon('check-circle') },
            { key: 'error', label: 'Errors', value: String(error), icon: tcIcon('exclamation-octagon') },
        ],
        [total, pending, done, error],
    )
    const topMetricsRef = useTcProps<HTMLElement>({ items: topMetrics })

    const insightsMetrics = useMemo(
        () =>
            summary
                ? [
                      { key: 'done', label: 'Attempts done', value: String(summary.totals.done), icon: tcIcon('check-circle') },
                      { key: 'err', label: 'Attempts errored', value: String(summary.totals.error), icon: tcIcon('exclamation-octagon') },
                      {
                          key: 'cost',
                          label: 'Total cost',
                          value: summary.totals.costUsd > 0 ? `$${summary.totals.costUsd.toFixed(2)}` : '—',
                          icon: tcIcon('currency-dollar'),
                      },
                      {
                          key: 'tokens',
                          label: 'Tokens in/out',
                          value:
                              summary.totals.tokensIn > 0
                                  ? `${Math.round(summary.totals.tokensIn / 1000)}k / ${Math.round(summary.totals.tokensOut / 1000)}k`
                                  : '—',
                          icon: tcIcon('cpu'),
                      },
                  ]
                : [],
        [summary],
    )
    const insightsMetricsRef = useTcProps<HTMLElement>({ items: insightsMetrics })

    const perDaySeries = useMemo(
        () =>
            summary
                ? [
                      { label: 'done', data: summary.perDay.map((d) => ({ x: d.date.slice(5), y: d.done })), color: '#10b981' },
                      { label: 'error', data: summary.perDay.map((d) => ({ x: d.date.slice(5), y: d.error })), color: '#ef4444' },
                  ]
                : [],
        [summary],
    )
    const tasksChartRef = useTcProps<HTMLElement>({ series: perDaySeries })

    const costSeries = useMemo(
        () =>
            summary
                ? [{ label: 'cost', data: summary.perDay.map((d) => ({ x: d.date.slice(5), y: Math.round(d.costUsd * 100) / 100 })), color: '#6366f1' }]
                : [],
        [summary],
    )
    const costChartRef = useTcProps<HTMLElement>({ series: costSeries, yFormatter: yFmt })

    const modelBars = useMemo(
        () => (summary ? summary.perModel.map((m) => ({ label: m.model.replace(/^claude-/, ''), value: m.count })) : []),
        [summary],
    )
    const barChartRef = useTcProps<HTMLElement>({ data: modelBars })

    const perModelRef = useTcProps<HTMLElement>(
        useMemo(() => ({ columns: PERMODEL_COLUMNS, data: summary?.perModel ?? [] }), [summary]),
    )

    return (
        <div className="taskforge-page">
            <tc-helper-text text={helpTexts.overview.how} />

            <tc-metric-grid ref={topMetricsRef} columns={4} />

            <tc-grid columns="2" gap="1.25rem">
                <tc-card>
                    <tc-heading slot="header" as="h3">
                        Git
                    </tc-heading>
                    <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                        {git ? (
                            <>
                                <div className="tf-kv">
                                    <span>Branch</span>
                                    <tc-badge variant="secondary"><tc-icon name="GitBranch" /> {git.branch}</tc-badge>
                                </div>
                                <div className="tf-kv">
                                    <span>Working tree</span>
                                    <tc-stack inline direction="horizontal" gap="0.4rem" align="center">
                                        <tc-status-dot status={git.dirty ? 'busy' : 'online'} />
                                        {git.dirty ? `dirty · ${git.dirtyFiles.length} file(s)` : 'clean'}
                                    </tc-stack>
                                </div>
                                {(git.ahead > 0 || git.behind > 0) && (
                                    <div className="tf-kv">
                                        <span>Sync</span>
                                        <tc-badge variant="info">
                                            ↑{git.ahead} ↓{git.behind}
                                        </tc-badge>
                                    </div>
                                )}
                                <tc-button variant="secondary" outline onClick={() => router.push(`/projects/${project}/git`)}>
                                    Manage git
                                </tc-button>
                            </>
                        ) : (
                            <tc-text variant="muted">Not a git repository, or status unavailable.</tc-text>
                        )}
                    </tc-stack>
                </tc-card>

                <tc-card>
                    <tc-heading slot="header" as="h3">
                        Run
                    </tc-heading>
                    <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                        <div className="tf-kv">
                            <span>State</span>
                            <tc-badge variant={snapshot.state === 'IDLE' ? 'secondary' : 'info'}>{snapshot.state}</tc-badge>
                        </div>
                        {snapshot.state === 'SLEEPING' && wakeAt && (
                            <tc-text variant="muted">Sleeping until ~{new Date(wakeAt).toLocaleTimeString()}.</tc-text>
                        )}
                        <div className="tf-kv">
                            <span>Last model</span>
                            <tc-text>{snapshot.model ?? '—'}</tc-text>
                        </div>
                        <tc-stack direction="horizontal" gap="0.75rem" wrap align="center">
                            <tc-button variant="primary" onClick={() => router.push(`/projects/${project}/run`)}>
                                Open run console
                            </tc-button>
                            <tc-button variant="secondary" outline onClick={() => router.push(`/projects/${project}/tasks`)}>
                                Manage tasks
                            </tc-button>
                        </tc-stack>
                    </tc-stack>
                </tc-card>
            </tc-grid>

            {summary && (summary.totals.done > 0 || summary.totals.error > 0) && (
                <tc-card>
                    <tc-heading slot="header" as="h3">
                        Insights (last 30 days)
                    </tc-heading>
                    <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                        <tc-metric-grid ref={insightsMetricsRef} columns={4} />
                        {summary.perDay.length > 0 && (
                            <tc-grid columns="2" gap="1.25rem">
                                <tc-line-chart ref={tasksChartRef} title="Tasks per day" height="200" />
                                {showCostChart ? (
                                    <tc-line-chart ref={costChartRef} title="Cost per day (USD)" height="200" />
                                ) : (
                                    <tc-bar-chart ref={barChartRef} title="Attempts by model" height="200" />
                                )}
                            </tc-grid>
                        )}
                        {summary.perModel.length > 0 && <tc-table ref={perModelRef} />}
                        {(summary.slowest.length > 0 || summary.expensive.length > 0 || summary.retried.length > 0) && (
                            <tc-grid columns="2" gap="1.25rem">
                                {summary.slowest.length > 0 && (
                                    <div>
                                        <tc-text variant="muted">Slowest tasks</tc-text>
                                        {summary.slowest.map((s) => (
                                            <div className="tf-kv" key={`s-${s.task}`}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    <code>{s.task}</code>
                                                </span>
                                                <tc-text>{Math.round(s.elapsed)}s</tc-text>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {summary.expensive.length > 0 ? (
                                    <div>
                                        <tc-text variant="muted">Most expensive tasks</tc-text>
                                        {summary.expensive.map((s) => (
                                            <div className="tf-kv" key={`e-${s.task}`}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    <code>{s.task}</code>
                                                </span>
                                                <tc-text>${s.costUsd.toFixed(2)}</tc-text>
                                            </div>
                                        ))}
                                    </div>
                                ) : summary.retried.length > 0 ? (
                                    <div>
                                        <tc-text variant="muted">Most retried tasks</tc-text>
                                        {summary.retried.map((s) => (
                                            <div className="tf-kv" key={`r-${s.task}`}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    <code>{s.task}</code>
                                                </span>
                                                <tc-text>{s.attempts}×</tc-text>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                            </tc-grid>
                        )}
                    </tc-stack>
                </tc-card>
            )}

            <tc-card>
                <tc-heading slot="header" as="h3">
                    Workspace
                </tc-heading>
                <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                    <tc-text variant="muted">{helpTexts.overview.claudeMd}</tc-text>
                    <tc-stack direction="horizontal" gap="0.75rem" wrap align="center">
                        <tc-button variant="secondary" outline loading={generating || undefined} disabled={generating || undefined} onClick={resetClaudeMd}>
                            Reset CLAUDE.md to template
                        </tc-button>
                    </tc-stack>
                </tc-stack>
            </tc-card>

            {total === 0 && (
                <tc-empty-state icon={tcIcon('inbox')}>
                    <h3>No tasks yet</h3>
                    <p>
                        Head to the <Link href={`/projects/${project}/agents`}>Agents</Link> page to describe work and
                        let Claude split it into task files.
                    </p>
                </tc-empty-state>
            )}
        </div>
    )
}
