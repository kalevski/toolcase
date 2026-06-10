'use client'

// B1 — run history: one row per run, with a drawer that replays the run's
// terminal from the persisted run_event log.

import React, { useCallback, useEffect, useState } from 'react'
import {
    Table,
    Badge,
    Drawer,
    Spinner,
    Text,
    HelperText,
    TerminalWindow,
    type TableColumn,
    type TerminalLine,
} from '@toolcase/react-components'
import type { RunRecord, SseEvent } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { helpTexts } from '../helpTexts'

const REASON_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'secondary' | 'info'> = {
    completed: 'success',
    stopped: 'warning',
    'force-stopped': 'danger',
    'usage-limit': 'warning',
}

function fmtDuration(startIso: string, endIso: string | null): string {
    if (!endIso) return '—'
    const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
    if (!Number.isFinite(ms) || ms < 0) return '—'
    const s = Math.round(ms / 1000)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ${s % 60}s`
    return `${Math.floor(m / 60)}h ${m % 60}m`
}

/** Rebuild terminal lines from persisted run_event frames. */
function eventsToLines(events: SseEvent[]): TerminalLine[] {
    const lines: TerminalLine[] = []
    for (const e of events) {
        switch (e.type) {
            case 'log':
                lines.push({ kind: e.kind, text: e.text })
                break
            case 'task:begin':
                lines.push({ kind: 'comment', text: `▶ ${e.taskId}` })
                break
            case 'task:done':
                lines.push({ kind: 'comment', text: `✔ done ${e.taskId}${e.commit ? ` (${e.commit.slice(0, 8)})` : ''}` })
                break
            case 'task:error':
                lines.push({ kind: 'error', text: `✖ error ${e.taskId}${e.error ? ` — ${e.error}` : ''}` })
                break
            case 'commit':
                lines.push({ kind: 'comment', text: `✔ committed ${e.sha.slice(0, 8)} — ${e.message}` })
                break
            case 'limit':
                lines.push({ kind: 'comment', text: `⏸ limit — wake at ${new Date(e.wakeAt).toISOString()}` })
                break
            case 'completed':
                lines.push({ kind: 'comment', text: `run completed — ${e.done} done, ${e.error} error of ${e.total}` })
                break
            case 'stopped':
                lines.push({ kind: 'comment', text: `run stopped: ${e.reason}` })
                break
            default:
                break
        }
    }
    return lines
}

export function RunsClient() {
    const { project, snapshot } = useProject()
    const [runs, setRuns] = useState<RunRecord[] | null>(null)
    const [openRun, setOpenRun] = useState<number | null>(null)
    const [detail, setDetail] = useState<{ id: number; run: RunRecord; lines: TerminalLine[] } | null>(null)

    const load = useCallback(async () => {
        try {
            const d = await fetch(`/api/projects/${project}/runs`).then((r) => (r.ok ? r.json() : null))
            if (d) setRuns(d)
        } catch {
            /* transient */
        }
    }, [project])

    useEffect(() => {
        void load()
    }, [load])

    // refresh the list when the live engine finishes a run
    useEffect(() => {
        if (snapshot.state === 'IDLE') void load()
    }, [snapshot.state, load])

    useEffect(() => {
        if (openRun === null) return
        let cancelled = false
        fetch(`/api/projects/${project}/runs/${openRun}`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((d) => {
                if (!cancelled) setDetail({ id: openRun, run: d.run, lines: eventsToLines(d.events) })
            })
            .catch(() => {
                if (!cancelled) setDetail(null)
            })
        return () => {
            cancelled = true
        }
    }, [project, openRun])

    const columns: TableColumn<RunRecord>[] = [
        { key: 'id', header: '#', width: '4rem', render: (r) => <code>{r.id}</code> },
        {
            key: 'started',
            header: 'Started',
            width: '12rem',
            render: (r) => <Text variant="muted">{new Date(r.startedAt).toLocaleString()}</Text>,
        },
        { key: 'duration', header: 'Duration', width: '7rem', render: (r) => fmtDuration(r.startedAt, r.finishedAt) },
        {
            key: 'trigger',
            header: 'Trigger',
            width: '9rem',
            render: (r) => <Badge variant={r.startedBy === 'schedule' ? 'info' : 'secondary'}>{r.startedBy ?? '—'}</Badge>,
        },
        {
            key: 'options',
            header: 'Options',
            render: (r) => (
                <Text variant="muted" style={{ fontSize: '0.8rem' }}>
                    {r.options.model ?? '—'}
                    {r.options.dryRun ? ' · dry' : ''}
                    {r.options.commitAfter ? ' · commit' : ''}
                    {r.options.pushAfter ? ' · push' : ''}
                    {r.options.review ? ' · review' : ''}
                    {r.branch ? ` · ⎇ ${r.branch}` : ''}
                </Text>
            ),
        },
        {
            key: 'outcome',
            header: 'Outcome',
            width: '9rem',
            render: (r) =>
                r.finishedAt ? (
                    <Badge variant={REASON_BADGE[r.reason ?? ''] ?? 'secondary'}>{r.reason}</Badge>
                ) : (
                    <Badge variant="info">running</Badge>
                ),
        },
        {
            key: 'counts',
            header: 'Done / Error',
            width: '8rem',
            render: (r) => (
                <span>
                    <Badge variant="success">{r.done}</Badge> <Badge variant={r.error ? 'danger' : 'secondary'}>{r.error}</Badge>
                    <Text variant="muted" style={{ marginLeft: 4 }}>
                        / {r.total}
                    </Text>
                </span>
            ),
        },
        {
            key: 'cost',
            header: 'Cost',
            width: '6rem',
            render: (r) => (r.costUsd != null && r.costUsd > 0 ? <code>${r.costUsd.toFixed(2)}</code> : <span style={{ opacity: 0.4 }}>—</span>),
        },
    ]

    const openDetail = openRun !== null ? detail : null

    return (
        <div className="tf-stack">
            <HelperText text={helpTexts.run.history} />
            {runs === null ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <Spinner />
                </div>
            ) : (
                <Table
                    columns={columns}
                    data={runs}
                    rowKey={(r) => String(r.id)}
                    hoverable
                    emptyMessage="No runs recorded yet — runs land here once started."
                    onRowClick={(r) => setOpenRun(r.id)}
                />
            )}

            <Drawer
                open={openRun !== null}
                onClose={() => {
                    setOpenRun(null)
                    setDetail(null)
                }}
                side="right"
                size="large"
                title={`Run #${openRun ?? ''}`}
            >
                <div style={{ padding: '1.25rem' }} className="tf-stack-sm">
                    {openDetail === null && (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>
                            <Spinner />
                        </div>
                    )}
                    {openDetail && (
                        <>
                            <div className="tf-kv">
                                <span>Started</span>
                                <Text>{new Date(openDetail.run.startedAt).toLocaleString()}</Text>
                            </div>
                            <div className="tf-kv">
                                <span>Outcome</span>
                                <Badge variant={REASON_BADGE[openDetail.run.reason ?? ''] ?? 'secondary'}>
                                    {openDetail.run.reason ?? 'running'}
                                </Badge>
                            </div>
                            <div className="tf-kv">
                                <span>Counts</span>
                                <Text>
                                    {openDetail.run.done} done · {openDetail.run.error} error · {openDetail.run.total} total
                                </Text>
                            </div>
                            {openDetail.run.costUsd != null && openDetail.run.costUsd > 0 && (
                                <div className="tf-kv">
                                    <span>Cost</span>
                                    <code>${openDetail.run.costUsd.toFixed(2)}</code>
                                </div>
                            )}
                            {openDetail.run.branch && (
                                <div className="tf-kv">
                                    <span>Branch</span>
                                    <Badge variant="secondary">⎇ {openDetail.run.branch}</Badge>
                                </div>
                            )}
                            {openDetail.run.prUrl && (
                                <div className="tf-kv">
                                    <span>PR</span>
                                    <a href={openDetail.run.prUrl} target="_blank" rel="noreferrer">
                                        {openDetail.run.prUrl}
                                    </a>
                                </div>
                            )}
                            <TerminalWindow title={`run #${openDetail.id} — replay`} lines={openDetail.lines} />
                        </>
                    )}
                </div>
            </Drawer>
        </div>
    )
}
