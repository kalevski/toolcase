'use client'

// B1 — run history: one row per run, with a drawer that replays the run's
// terminal from the persisted run_event log.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '@/lib/fetcher'
import { useTc, useTcProps, escapeHtml } from '@/lib/tc'
import { toTcLines, type TerminalLine } from '@/lib/terminal'
import type { RunRecord, SseEvent } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { LoadingState } from '../states'
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

// Read-only cells + a row click that opens the replay drawer → tc-table. Cells
// are HTML strings (the tc-table render contract); record-derived text is
// escaped. Row click / keyboard activation is handled by tc-table's onrowclick.
function optionsText(r: RunRecord): string {
    return (
        `${r.options.model ?? '—'}` +
        `${r.options.dryRun ? ' · dry' : ''}` +
        `${r.options.commitAfter ? ' · commit' : ''}` +
        `${r.options.pushAfter ? ' · push' : ''}` +
        `${r.options.review ? ' · review' : ''}` +
        `${r.branch ? ` · ⎇ ${r.branch}` : ''}`
    )
}

const COLUMNS = [
    { key: 'id', header: '#', width: '4rem', render: (r: RunRecord) => `<code>${escapeHtml(r.id)}</code>` },
    {
        key: 'started',
        header: 'Started',
        width: '12rem',
        render: (r: RunRecord) => `<tc-text variant="muted">${escapeHtml(new Date(r.startedAt).toLocaleString())}</tc-text>`,
    },
    { key: 'duration', header: 'Duration', width: '7rem', render: (r: RunRecord) => escapeHtml(fmtDuration(r.startedAt, r.finishedAt)) },
    {
        key: 'trigger',
        header: 'Trigger',
        width: '9rem',
        render: (r: RunRecord) =>
            `<tc-badge variant="${r.startedBy === 'schedule' ? 'info' : 'secondary'}">${escapeHtml(r.startedBy ?? '—')}</tc-badge>`,
    },
    {
        key: 'options',
        header: 'Options',
        render: (r: RunRecord) => `<tc-text variant="muted" style="font-size:0.8rem">${escapeHtml(optionsText(r))}</tc-text>`,
    },
    {
        key: 'outcome',
        header: 'Outcome',
        width: '9rem',
        render: (r: RunRecord) =>
            r.finishedAt
                ? `<tc-badge variant="${REASON_BADGE[r.reason ?? ''] ?? 'secondary'}">${escapeHtml(r.reason ?? '')}</tc-badge>`
                : `<tc-badge variant="info">running</tc-badge>`,
    },
    {
        key: 'counts',
        header: 'Done / Error',
        width: '8rem',
        render: (r: RunRecord) =>
            `<tc-badge variant="success">${r.done}</tc-badge> ` +
            `<tc-badge variant="${r.error ? 'danger' : 'secondary'}">${r.error}</tc-badge> ` +
            `<tc-text variant="muted" style="margin-left:4px">/ ${r.total}</tc-text>`,
    },
    {
        key: 'cost',
        header: 'Cost',
        width: '6rem',
        render: (r: RunRecord) =>
            r.costUsd != null && r.costUsd > 0 ? `<code>$${r.costUsd.toFixed(2)}</code>` : `<span style="opacity:0.4">—</span>`,
    },
]

export function RunsClient() {
    const { project, snapshot } = useProject()
    const [runs, setRuns] = useState<RunRecord[] | null>(null)
    const [openRun, setOpenRun] = useState<number | null>(null)
    const [detail, setDetail] = useState<{ id: number; run: RunRecord; lines: TerminalLine[] } | null>(null)

    const openDetail = openRun !== null ? detail : null

    const drawerRef = useTc<HTMLElement>(
        { open: openRun !== null },
        {
            'tc-close': () => {
                setOpenRun(null)
                setDetail(null)
            },
        },
    )
    const tcLines = useMemo(() => (openDetail ? toTcLines(openDetail.lines) : []), [openDetail])
    const termRef = useTcProps<HTMLElement>({ lines: tcLines })

    const load = useCallback(async () => {
        try {
            const d = await apiFetch<RunRecord[]>(`/api/projects/${project}/runs`)
            if (d) setRuns(d)
        } catch {
            /* transient */
        }
    }, [project])

    useEffect(() => {
        void load()
    }, [load])

    // Refresh the list when the engine settles (IDLE) AND when it transitions
    // into a running state (RUNNING/SLEEPING/STOPPING) — the latter so a run
    // started from another page shows up immediately, not only once it finishes.
    // Track the previous state to fire only on the edge into "running".
    const prevState = useRef(snapshot.state)
    useEffect(() => {
        const was = prevState.current
        const now = snapshot.state
        prevState.current = now
        const RUNNING = (s: typeof now) => s === 'RUNNING' || s === 'SLEEPING' || s === 'STOPPING'
        if (now === 'IDLE' || (RUNNING(now) && !RUNNING(was))) void load()
    }, [snapshot.state, load])

    useEffect(() => {
        if (openRun === null) return
        let cancelled = false
        apiFetch<{ run: RunRecord; events: SseEvent[] }>(`/api/projects/${project}/runs/${openRun}`)
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

    const openRunDetail = useCallback((row: RunRecord) => setOpenRun(row.id), [])
    const tableRef = useTc<HTMLElement>(
        useMemo(
            () => ({ columns: COLUMNS, data: runs ?? [], rowKey: (r: RunRecord) => r.id, onrowclick: openRunDetail }),
            [runs, openRunDetail],
        ),
    )

    return (
        <div className="taskforge-page">
            <tc-helper-text text={helpTexts.run.history} />
            <tc-table
                ref={tableRef}
                hoverable
                loading={runs === null ? true : undefined}
                empty-message="No runs recorded yet — runs land here once started."
            />

            <tc-drawer ref={drawerRef} side="right" size="large" title={`Run #${openRun ?? ''}`}>
                <tc-stack gap="0.75rem" style={{ padding: '1.25rem' }}>
                    {openDetail === null && <LoadingState />}
                    {openDetail && (
                        <>
                            <div className="tf-kv">
                                <span>Started</span>
                                <tc-text>{new Date(openDetail.run.startedAt).toLocaleString()}</tc-text>
                            </div>
                            <div className="tf-kv">
                                <span>Outcome</span>
                                <tc-badge variant={REASON_BADGE[openDetail.run.reason ?? ''] ?? 'secondary'}>
                                    {openDetail.run.reason ?? 'running'}
                                </tc-badge>
                            </div>
                            <div className="tf-kv">
                                <span>Counts</span>
                                <tc-text>
                                    {openDetail.run.done} done · {openDetail.run.error} error · {openDetail.run.total} total
                                </tc-text>
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
                                    <tc-badge variant="secondary"><tc-icon name="GitBranch" /> {openDetail.run.branch}</tc-badge>
                                </div>
                            )}
                            {openDetail.run.prUrl && (
                                <div className="tf-kv">
                                    <span>PR</span>
                                    <a
                                        href={openDetail.run.prUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        title={openDetail.run.prUrl}
                                        style={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                    >
                                        View PR ↗
                                    </a>
                                </div>
                            )}
                            <tc-terminal-window ref={termRef} title={`run #${openDetail.id} — replay`} />
                        </>
                    )}
                </tc-stack>
            </tc-drawer>
        </div>
    )
}
