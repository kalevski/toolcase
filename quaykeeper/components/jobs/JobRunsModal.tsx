'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { BadgeVariant } from '@toolcase/web-components'
import type { JobRun, JobRunStatus, ScheduledJob } from '@/server/domain/job'
import { useTc } from '@/lib/tc'
import { callApi } from '@/components/config/shared'

// Read-only modal showing a job's execution history with captured output. Used two
// ways: opened from the list's "Runs" action (browse history), and opened right
// after a "Run now" with `highlightRunId` set to the fresh run so its output is
// expanded on top. A plain `tc-modal` (info, single Close button) — not FormModal,
// which is submit-shaped.

const STATUS_VARIANT: Record<JobRunStatus, BadgeVariant> = {
    success: 'success',
    failed: 'danger',
    timeout: 'warning',
    error: 'secondary',
}

function fmtWhen(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtDuration(ms: number): string {
    if (ms < 1000) return `${ms} ms`
    return `${(ms / 1000).toFixed(1)} s`
}

/** One stream block — a labelled code snippet, or muted "(none)" when empty. */
function Stream({ label, text }: { label: string; text: string }) {
    if (!text) {
        return (
            <p className="quaykeeper-admin-hint">
                {label}: <span className="quaykeeper-admin-hint">(none)</span>
            </p>
        )
    }
    return (
        <div className="quaykeeper-job-stream">
            <div className="quaykeeper-form-group-title">{label}</div>
            <tc-code-snippet code={text} show-copy-button="" />
        </div>
    )
}

function RunItem({ run, open }: { run: JobRun; open: boolean }) {
    const variant = STATUS_VARIANT[run.status] ?? 'secondary'
    const who = run.trigger === 'manual' ? run.triggeredByLogin ?? 'manual' : 'schedule'
    return (
        <details className="quaykeeper-job-run" open={open || undefined}>
            <summary className="quaykeeper-job-run-summary">
                <tc-badge variant={variant}>{run.status}</tc-badge>
                <span className="quaykeeper-admin-mono">{who}</span>
                <span className="quaykeeper-admin-hint">{fmtWhen(run.finishedAt)}</span>
                <span className="quaykeeper-admin-hint">{fmtDuration(run.durationMs)}</span>
                <span className="quaykeeper-admin-hint">
                    exit {run.exitCode === null ? '—' : run.exitCode}
                </span>
            </summary>
            <div className="quaykeeper-job-run-body">
                {run.truncated && (
                    <tc-banner variant="warning">Output was truncated — showing the first 256 KB of each stream.</tc-banner>
                )}
                <Stream label="stdout" text={run.stdout} />
                <Stream label="stderr" text={run.stderr} />
            </div>
        </details>
    )
}

export function JobRunsModal({
    jobId,
    highlightRunId,
    onClose,
}: {
    jobId: string
    /** A run to render expanded on top (the one that just ran). */
    highlightRunId?: string
    onClose: () => void
}) {
    const ref = useTc<HTMLElement>(undefined, { 'tc-hidden': () => onClose() })
    const [state, setState] = useState<{ job: ScheduledJob; runs: JobRun[] } | 'loading' | 'error'>('loading')

    const load = useCallback(async () => {
        const res = await callApi<{ job: ScheduledJob; runs: JobRun[] }>(`/api/jobs/${encodeURIComponent(jobId)}`, 'GET')
        setState(res.ok && res.body ? res.body : 'error')
    }, [jobId])

    useEffect(() => {
        void load()
    }, [load])

    let body: ReactNode
    if (state === 'loading') {
        body = <p className="quaykeeper-admin-hint">Loading runs…</p>
    } else if (state === 'error') {
        body = <tc-banner variant="error">Couldn’t load this job’s runs.</tc-banner>
    } else if (state.runs.length === 0) {
        body = <p className="quaykeeper-admin-hint">No runs yet. Use “Run now” to execute this job.</p>
    } else {
        body = (
            <div className="quaykeeper-job-runs">
                {state.runs.map((run) => (
                    <RunItem key={run.id} run={run} open={run.id === highlightRunId} />
                ))}
            </div>
        )
    }

    const title = state !== 'loading' && state !== 'error' ? `Runs · ${state.job.name}` : 'Runs'

    return (
        <tc-modal ref={ref} open title={title} size="lg" scrollable centered>
            <div>{body}</div>
            <div slot="footer" className="quaykeeper-form-footer">
                <tc-button variant="secondary" outline onClick={onClose}>
                    Close
                </tc-button>
            </div>
        </tc-modal>
    )
}
