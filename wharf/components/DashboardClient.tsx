'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMe } from '@/lib/me-context'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { useTc } from '@/lib/tc'
import { detailValue } from '@/lib/tc'
import type { ProjectSummary } from '@/server/domain/types'

/** Build a cumulative "projects created over time" series from real createdAt
 *  timestamps. Buckets by month so the x axis stays readable; returns null when
 *  there's nothing dated to plot (→ honest empty state, never fabricated). */
function buildCreatedSeries(projects: ProjectSummary[]) {
    const dated = projects
        .map((p) => p.project.createdAt)
        .filter((d): d is string => !!d)
        .map((d) => new Date(d))
        .filter((d) => !isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime())
    if (dated.length === 0) return null

    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const perMonth = new Map<string, number>()
    for (const d of dated) perMonth.set(monthKey(d), (perMonth.get(monthKey(d)) ?? 0) + 1)

    // Walk every month between the first and last creation so gaps read as flat.
    const points: { x: string; y: number }[] = []
    const cursor = new Date(dated[0].getFullYear(), dated[0].getMonth(), 1)
    const end = new Date(dated[dated.length - 1].getFullYear(), dated[dated.length - 1].getMonth(), 1)
    let cumulative = 0
    while (cursor <= end) {
        const key = monthKey(cursor)
        cumulative += perMonth.get(key) ?? 0
        points.push({ x: key, y: cumulative })
        cursor.setMonth(cursor.getMonth() + 1)
    }
    return points
}

export function DashboardClient() {
    const me = useMe()
    const router = useRouter()
    const isOwner = me.role === 'owner'
    const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
    const [err, setErr] = useState<string | null>(null)
    const [name, setName] = useState('')
    const [busy, setBusy] = useState(false)
    const nameRef = useRef(name)
    nameRef.current = name

    const load = useCallback(async (signal?: AbortSignal) => {
        try {
            setProjects(await apiFetch<ProjectSummary[]>('/api/projects', { signal }))
        } catch (e) {
            if (!signal?.aborted) setErr(describeApiError(e))
        }
    }, [])

    useEffect(() => {
        const ctrl = new AbortController()
        void load(ctrl.signal)
        return () => ctrl.abort()
    }, [load])

    const create = async () => {
        const value = nameRef.current.trim()
        if (!value || busy) return
        setBusy(true)
        setErr(null)
        try {
            await apiFetch('/api/projects', { method: 'POST', body: JSON.stringify({ name: value }) })
            setName('')
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        } finally {
            setBusy(false)
        }
    }

    const inputRef = useTc<HTMLElement>(
        useMemo(() => ({ value: name }), [name]),
        { 'tc-change': (e: Event) => setName(detailValue<string>(e) ?? '') },
    )

    const metricItems = useMemo(
        () =>
            projects && projects.length
                ? [
                      { label: 'Projects', value: projects.length, icon: 'Boxes' },
                      {
                          label: 'Environments',
                          value: projects.reduce((sum, p) => sum + p.environmentCount, 0),
                          icon: 'Layers',
                      },
                      {
                          label: 'Instances',
                          value: projects.reduce((sum, p) => sum + p.instanceCount, 0),
                          icon: 'Container',
                      },
                  ]
                : [],
        [projects],
    )
    const metricRef = useTc<HTMLElement>(useMemo(() => ({ items: metricItems }), [metricItems]))

    // W1 trend — cumulative projects created over time, from real createdAt data.
    const createdPoints = useMemo(() => (projects ? buildCreatedSeries(projects) : null), [projects])
    const chartSeries = useMemo(
        () =>
            createdPoints
                ? [{ name: 'Projects', data: createdPoints, color: 'var(--wharf-accent)' }]
                : [],
        [createdPoints],
    )
    const xFmt = useMemo(
        () =>
            (v: number | string): string => {
                // x is a YYYY-MM bucket key → "Mon ’YY".
                const [y, m] = String(v).split('-').map(Number)
                if (!y || !m) return String(v)
                return new Date(y, m - 1, 1).toLocaleString('en', { month: 'short', year: '2-digit' })
            },
        [],
    )
    const chartRef = useTc<HTMLElement>(
        useMemo(() => ({ series: chartSeries, xFormatter: xFmt }), [chartSeries, xFmt]),
    )

    // W1 usage panel — honest coverage metrics derived from the existing payload:
    // how many projects already have an environment / an instance.
    const usageItems = useMemo(() => {
        if (!projects || projects.length === 0) return []
        const total = projects.length
        const withEnv = projects.filter((p) => p.environmentCount > 0).length
        const withInst = projects.filter((p) => p.instanceCount > 0).length
        return [
            { label: 'Projects with an environment', used: withEnv, total, measurementUnit: 'projects', warn: withEnv < total },
            { label: 'Projects with an instance', used: withInst, total, measurementUnit: 'projects', warn: withInst < total },
        ]
    }, [projects])
    const usageRef = useTc<HTMLElement>(useMemo(() => ({ usage: usageItems }), [usageItems]))

    return (
        <div className="wharf-page">
            <tc-rich-page-header
                icon-name="Boxes"
                icon-color="cyan"
                title-text="Projects"
                sub="Configuration for your Docker containers"
            />

            {isOwner && (
                <tc-section-card title="New project" icon="Plus">
                    <div className="wharf-section-body">
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <tc-input
                                ref={inputRef}
                                label="Project name"
                                placeholder="e.g. Acme API"
                                style={{ flex: '1 1 18rem' }}
                            />
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <tc-button variant="primary" onClick={create} disabled={busy || !name.trim()}>
                                Create
                            </tc-button>
                        </div>
                    </div>
                </tc-section-card>
            )}

            {err && <tc-banner variant="error">{err}</tc-banner>}

            {projects === null ? (
                <div className="wharf-status-line">
                    <tc-spinner type="border" size="sm" /> Loading…
                </div>
            ) : projects.length === 0 ? (
                <tc-empty-state icon="Boxes">
                    <h2>No projects yet</h2>
                    <p>{isOwner ? 'Create your first project above.' : 'Ask an owner to grant you access.'}</p>
                </tc-empty-state>
            ) : (
                <>
                    <tc-metric-grid ref={metricRef} columns="3" />

                    <div className="wharf-dashboard-trend">
                        <tc-section-card title="Projects created" icon="TrendingUp">
                            <div className="wharf-section-body">
                                {createdPoints && createdPoints.length > 1 ? (
                                    <tc-line-chart ref={chartRef} height="220" show-legend="false" />
                                ) : (
                                    <p style={{ margin: 0, color: 'var(--tc-text-muted)' }}>
                                        A trend appears once projects have been created across more than one
                                        month.
                                    </p>
                                )}
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Coverage" icon="CircleCheck">
                            <div className="wharf-section-body">
                                <tc-usage-summary-panel ref={usageRef} />
                            </div>
                        </tc-section-card>
                    </div>

                    <div className="wharf-card-grid">
                        {projects.map((p) => (
                            <ProjectCard key={p.project.id} summary={p} onOpen={() => router.push(`/projects/${p.project.id}`)} />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

/** A single dashboard project tile with a composition sparkline (env vs instance
 *  counts — real fields, labelled, not a fabricated trend). */
function ProjectCard({ summary: p, onOpen }: { summary: ProjectSummary; onOpen: () => void }) {
    // Bar sparkline over [environments, instances] — a quick at-a-glance size
    // signal. Rendered only when there's something to show.
    const sparkData = useMemo(() => [p.environmentCount, p.instanceCount], [p.environmentCount, p.instanceCount])
    const sparkRef = useTc<HTMLElement>(useMemo(() => ({ data: sparkData }), [sparkData]))
    const hasShape = p.environmentCount > 0 || p.instanceCount > 0

    return (
        <div
            className="wharf-card"
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onOpen()
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}>
                <strong style={{ fontSize: '1.0625rem' }}>{p.project.name}</strong>
                <tc-badge variant={p.effectiveRole === 'developer' ? 'secondary' : 'primary'}>
                    {p.effectiveRole}
                </tc-badge>
            </div>
            <span className="wharf-mono" style={{ fontSize: '0.8125rem', color: 'var(--tc-text-muted)' }}>
                {p.project.slug}
            </span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <tc-badge variant="info">{p.environmentCount} environments</tc-badge>
                    <tc-badge variant="info">{p.instanceCount} instances</tc-badge>
                </div>
                {hasShape && (
                    <tc-sparkline
                        ref={sparkRef}
                        type="bar"
                        width="56"
                        height="24"
                        color="var(--wharf-accent)"
                        title="environments vs instances"
                    />
                )}
            </div>
        </div>
    )
}
