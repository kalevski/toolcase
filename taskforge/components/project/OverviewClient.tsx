'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
    MetricGrid,
    Card,
    Heading,
    Text,
    Button,
    Badge,
    StatusDot,
    EmptyState,
    HelperText,
    LineChart,
    BarChart,
    Table,
    toast,
    type TableColumn,
} from '@toolcase/react-components'
import type { TelemetrySummary } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { helpTexts } from '../helpTexts'

export function OverviewClient() {
    const router = useRouter()
    const { project, tasks, git, snapshot, wakeAt } = useProject()

    // D1 — telemetry aggregates (loaded lazily; absent until first run)
    const [summary, setSummary] = useState<TelemetrySummary | null>(null)
    useEffect(() => {
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
    }, [project, snapshot.state])

    const [generating, setGenerating] = useState(false)
    const resetClaudeMd = async () => {
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

    return (
        <div className="tf-stack">
            <HelperText text={helpTexts.overview.how} />

            <MetricGrid
                columns={4}
                items={[
                    { key: 'total', label: 'Tasks', value: total, icon: 'list-task' },
                    { key: 'pending', label: 'Pending', value: pending, icon: 'hourglass-split' },
                    { key: 'done', label: 'Done', value: done, icon: 'check-circle' },
                    { key: 'error', label: 'Errors', value: error, icon: 'exclamation-octagon' },
                ]}
            />

            <div className="tf-grid-2">
                <Card header={<Heading as="h3">Git</Heading>}>
                    <div className="tf-card-body tf-stack-sm">
                        {git ? (
                            <>
                                <div className="tf-kv">
                                    <span>Branch</span>
                                    <Badge variant="secondary">⎇ {git.branch}</Badge>
                                </div>
                                <div className="tf-kv">
                                    <span>Working tree</span>
                                    <span className="tf-inline">
                                        <StatusDot status={git.dirty ? 'busy' : 'online'} />
                                        {git.dirty ? `dirty · ${git.dirtyFiles.length} file(s)` : 'clean'}
                                    </span>
                                </div>
                                {(git.ahead > 0 || git.behind > 0) && (
                                    <div className="tf-kv">
                                        <span>Sync</span>
                                        <Badge variant="info">
                                            ↑{git.ahead} ↓{git.behind}
                                        </Badge>
                                    </div>
                                )}
                                <Button variant="secondary" outline onClick={() => router.push(`/projects/${project}/git`)}>
                                    Manage git
                                </Button>
                            </>
                        ) : (
                            <Text variant="muted">Not a git repository, or status unavailable.</Text>
                        )}
                    </div>
                </Card>

                <Card header={<Heading as="h3">Run</Heading>}>
                    <div className="tf-card-body tf-stack-sm">
                        <div className="tf-kv">
                            <span>State</span>
                            <Badge variant={snapshot.state === 'IDLE' ? 'secondary' : 'info'}>{snapshot.state}</Badge>
                        </div>
                        {snapshot.state === 'SLEEPING' && wakeAt && (
                            <Text variant="muted">Sleeping until ~{new Date(wakeAt).toLocaleTimeString()}.</Text>
                        )}
                        <div className="tf-kv">
                            <span>Last model</span>
                            <Text>{snapshot.model ?? '—'}</Text>
                        </div>
                        <div className="tf-actions">
                            <Button variant="primary" onClick={() => router.push(`/projects/${project}/run`)}>
                                Open run console
                            </Button>
                            <Button variant="secondary" outline onClick={() => router.push(`/projects/${project}/tasks`)}>
                                Manage tasks
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            {summary && (summary.totals.done > 0 || summary.totals.error > 0) && (
                <Card header={<Heading as="h3">Insights (last 30 days)</Heading>}>
                    <div className="tf-card-body tf-stack-sm">
                        <MetricGrid
                            columns={4}
                            items={[
                                { key: 'done', label: 'Attempts done', value: summary.totals.done, icon: 'check-circle' },
                                { key: 'err', label: 'Attempts errored', value: summary.totals.error, icon: 'exclamation-octagon' },
                                {
                                    key: 'cost',
                                    label: 'Total cost',
                                    value: summary.totals.costUsd > 0 ? `$${summary.totals.costUsd.toFixed(2)}` : '—',
                                    icon: 'currency-dollar',
                                },
                                {
                                    key: 'tokens',
                                    label: 'Tokens in/out',
                                    value:
                                        summary.totals.tokensIn > 0
                                            ? `${Math.round(summary.totals.tokensIn / 1000)}k / ${Math.round(summary.totals.tokensOut / 1000)}k`
                                            : '—',
                                    icon: 'cpu',
                                },
                            ]}
                        />
                        {summary.perDay.length > 0 && (
                            <div className="tf-grid-2">
                                <LineChart
                                    title="Tasks per day"
                                    height={200}
                                    series={[
                                        { label: 'done', data: summary.perDay.map((d) => ({ x: d.date.slice(5), y: d.done })), color: '#10b981' },
                                        { label: 'error', data: summary.perDay.map((d) => ({ x: d.date.slice(5), y: d.error })), color: '#ef4444' },
                                    ]}
                                />
                                {summary.perDay.some((d) => d.costUsd > 0) ? (
                                    <LineChart
                                        title="Cost per day (USD)"
                                        height={200}
                                        yFormatter={(v) => `$${v.toFixed(2)}`}
                                        series={[
                                            { label: 'cost', data: summary.perDay.map((d) => ({ x: d.date.slice(5), y: Math.round(d.costUsd * 100) / 100 })), color: '#6366f1' },
                                        ]}
                                    />
                                ) : (
                                    <BarChart
                                        title="Attempts by model"
                                        height={200}
                                        data={summary.perModel.map((m) => ({ label: m.model.replace(/^claude-/, ''), value: m.count }))}
                                    />
                                )}
                            </div>
                        )}
                        {summary.perModel.length > 0 && (
                            <Table
                                columns={
                                    [
                                        { key: 'model', header: 'Model', render: (m) => <code>{m.model}</code> },
                                        { key: 'count', header: 'Attempts', width: '7rem', render: (m) => m.count },
                                        { key: 'avg', header: 'Avg elapsed', width: '8rem', render: (m) => `${m.avgElapsed}s` },
                                        {
                                            key: 'cost',
                                            header: 'Cost',
                                            width: '7rem',
                                            render: (m) => (m.costUsd > 0 ? `$${m.costUsd.toFixed(2)}` : '—'),
                                        },
                                    ] as TableColumn<TelemetrySummary['perModel'][number]>[]
                                }
                                data={summary.perModel}
                                rowKey={(m) => m.model}
                            />
                        )}
                        {(summary.slowest.length > 0 || summary.expensive.length > 0 || summary.retried.length > 0) && (
                            <div className="tf-grid-2">
                                {summary.slowest.length > 0 && (
                                    <div>
                                        <Text variant="muted">Slowest tasks</Text>
                                        {summary.slowest.map((s) => (
                                            <div className="tf-kv" key={`s-${s.task}`}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    <code>{s.task}</code>
                                                </span>
                                                <Text>{Math.round(s.elapsed)}s</Text>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {summary.expensive.length > 0 ? (
                                    <div>
                                        <Text variant="muted">Most expensive tasks</Text>
                                        {summary.expensive.map((s) => (
                                            <div className="tf-kv" key={`e-${s.task}`}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    <code>{s.task}</code>
                                                </span>
                                                <Text>${s.costUsd.toFixed(2)}</Text>
                                            </div>
                                        ))}
                                    </div>
                                ) : summary.retried.length > 0 ? (
                                    <div>
                                        <Text variant="muted">Most retried tasks</Text>
                                        {summary.retried.map((s) => (
                                            <div className="tf-kv" key={`r-${s.task}`}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    <code>{s.task}</code>
                                                </span>
                                                <Text>{s.attempts}×</Text>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                </Card>
            )}

            <Card header={<Heading as="h3">Workspace</Heading>}>
                <div className="tf-card-body tf-stack-sm">
                    <Text variant="muted">{helpTexts.overview.claudeMd}</Text>
                    <div className="tf-actions">
                        <Button variant="secondary" outline loading={generating} disabled={generating} onClick={resetClaudeMd}>
                            Reset CLAUDE.md to template
                        </Button>
                    </div>
                </div>
            </Card>

            {total === 0 && (
                <EmptyState icon="inbox">
                    <h3>No tasks yet</h3>
                    <p>
                        Head to the <Link href={`/projects/${project}/agents`}>Agents</Link> page to describe
                        work and let Claude split it into task files.
                    </p>
                </EmptyState>
            )}
        </div>
    )
}
