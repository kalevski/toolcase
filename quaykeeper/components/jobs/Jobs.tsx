'use client'

import { useCallback, useMemo, useState } from 'react'
import type { TableColumn } from '@toolcase/web-components'
import { escapeHtml } from '@/lib/tc'
import type { JobRun, JobRunStatus, ScheduledJob } from '@/server/domain/job'
import { nextRun, parseCron } from '@/server/domain/cron'
import { iconBtnHtml } from '@/lib/action-icons'
import { ConfigPage, callApi, json, useConfigData } from '@/components/config/shared'
import { DataTable } from '@/components/DataTable'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { JobEditor } from './JobEditor'
import { JobRunsModal } from './JobRunsModal'

// Scheduled tasks (the `/jobs` page): owner-defined shell / JavaScript scripts the
// host runs on a 5-field cron schedule and/or on demand. Owner-only, because a job
// runs arbitrary code on the host (every backing /api/jobs route is
// authorize('owner')-gated; this client gate is the matching UX).

const STATUS_VARIANT: Record<JobRunStatus, string> = {
    success: 'success',
    failed: 'danger',
    timeout: 'warning',
    error: 'secondary',
}

function badge(variant: string, text: string): string {
    return `<span class="badge text-bg-${variant}">${escapeHtml(text)}</span>`
}
function muted(text: string): string {
    return `<span class="quaykeeper-admin-hint">${escapeHtml(text)}</span>`
}
function fmtDate(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Human next-run cell: — for a manual-only or disabled job, else the next fire time. */
function nextRunText(job: ScheduledJob): string {
    if (!job.schedule || !job.enabled) return '—'
    try {
        const next = nextRun(parseCron(job.schedule), new Date())
        return next ? fmtDate(next.toISOString()) : 'never'
    } catch {
        return 'invalid'
    }
}

interface JobRow extends Record<string, unknown> {
    id: string
    name: string
}

const JOB_COLUMNS: TableColumn[] = [
    {
        key: 'name',
        header: 'Name',
        render: (row: JobRow) =>
            `<button type="button" class="btn btn-link p-0 quaykeeper-admin-mono" data-action="edit" data-id="${escapeHtml(row.id)}">${escapeHtml(String(row.name))}</button>`,
    },
    { key: 'kind', header: 'Type', render: (row: JobRow) => badge('info', String(row.kind)) },
    {
        key: 'schedule',
        header: 'Schedule',
        render: (row: JobRow) =>
            row.schedule ? `<span class="quaykeeper-admin-mono">${escapeHtml(String(row.schedule))}</span>` : muted('manual'),
    },
    { key: 'nextRun', header: 'Next run', render: (row: JobRow) => escapeHtml(String(row.nextRun)) },
    { key: 'lastRun', header: 'Last run', render: (row: JobRow) => String(row.lastRun) },
    {
        key: 'enabled',
        header: 'Enabled',
        render: (row: JobRow) =>
            `<button type="button" class="btn btn-sm btn-link p-0" data-action="toggle" data-id="${escapeHtml(row.id)}">` +
            (row.enabled ? badge('success', 'on') : badge('secondary', 'off')) +
            `</button>`,
    },
    {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row: JobRow) =>
            `<span class="quaykeeper-admin-domain-controls">` +
            iconBtnHtml({ icon: 'run', label: `Run ${row.name} now`, data: { action: 'run', id: row.id } }) +
            iconBtnHtml({ icon: 'history', label: `Runs for ${row.name}`, data: { action: 'runs', id: row.id } }) +
            iconBtnHtml({ icon: 'edit', label: `Edit ${row.name}`, data: { action: 'edit', id: row.id } }) +
            iconBtnHtml({ icon: 'remove', label: `Delete ${row.name}`, danger: true, data: { action: 'delete', id: row.id, name: String(row.name) } }) +
            `</span>`,
    },
]

export function Jobs() {
    const fetcher = useCallback(async (): Promise<ScheduledJob[] | null> => {
        try {
            return await fetch('/api/jobs', { cache: 'no-store' }).then((r) => json<ScheduledJob[]>(r))
        } catch {
            return null
        }
    }, [])
    // Owner-only (the scripts run on the host) — one rank tighter than the Config pages.
    const { state, reload } = useConfigData(fetcher, 'owner')

    return (
        <ConfigPage
            title="Scheduled tasks"
            subtitle="Shell or JavaScript scripts run on the server — on a cron schedule, on demand, or both. Output is captured per run. Owner access."
            icon="clock"
            iconColor="cyan"
            state={state}
            onRetry={() => void reload()}
        >
            {(jobs) => <JobsTable jobs={jobs} onChanged={() => void reload()} />}
        </ConfigPage>
    )
}

function JobsTable({ jobs, onChanged }: { jobs: ScheduledJob[]; onChanged: () => void }) {
    const toast = useToast()
    const [editor, setEditor] = useState<{ job: ScheduledJob | null } | null>(null)
    const [runs, setRuns] = useState<{ jobId: string; highlightRunId?: string } | null>(null)
    const [pending, setPending] = useState<{ id: string; name: string } | null>(null)
    const [busy, setBusy] = useState(false)
    const [runningName, setRunningName] = useState<string | null>(null)

    const rows = useMemo<JobRow[]>(
        () =>
            jobs.map((j) => ({
                id: j.id,
                name: j.name,
                kind: j.kind === 'node' ? 'node' : 'shell',
                schedule: j.schedule ?? '',
                nextRun: nextRunText(j),
                lastRun: j.lastStatus
                    ? `${badge(STATUS_VARIANT[j.lastStatus] ?? 'secondary', j.lastStatus)} ${muted(j.lastRunAt ? fmtDate(j.lastRunAt) : '')}`
                    : muted('—'),
                enabled: j.enabled,
            })),
        [jobs],
    )

    const runNow = useCallback(
        async (job: ScheduledJob) => {
            if (runningName) return
            setRunningName(job.name)
            const res = await callApi<JobRun>(`/api/jobs/${encodeURIComponent(job.id)}/run`, 'POST')
            setRunningName(null)
            if (!res.ok || !res.body) {
                toast.show(`Couldn’t run “${job.name}”: ${res.message}`, { variant: 'error' })
                return
            }
            const run = res.body
            const ok = run.status === 'success'
            toast.show(`“${job.name}” ${ok ? 'succeeded' : run.status} (${(run.durationMs / 1000).toFixed(1)}s).`, {
                variant: ok ? 'success' : 'error',
            })
            setRuns({ jobId: job.id, highlightRunId: run.id })
            onChanged() // refresh last-run column
        },
        [runningName, toast, onChanged],
    )

    const toggle = useCallback(
        async (job: ScheduledJob) => {
            const res = await callApi(`/api/jobs/${encodeURIComponent(job.id)}`, 'PATCH', { enabled: !job.enabled })
            if (!res.ok) {
                toast.show(`Couldn’t update “${job.name}”: ${res.message}`, { variant: 'error' })
                return
            }
            onChanged()
        },
        [toast, onChanged],
    )

    const onAction = useCallback(
        (action: string, dataset: DOMStringMap) => {
            const id = dataset.id
            if (!id) return
            const job = jobs.find((j) => j.id === id)
            if (!job) return
            if (action === 'edit') setEditor({ job })
            else if (action === 'run') void runNow(job)
            else if (action === 'runs') setRuns({ jobId: id })
            else if (action === 'toggle') void toggle(job)
            else if (action === 'delete') setPending({ id, name: dataset.name ?? job.name })
        },
        [jobs, runNow, toggle],
    )

    const doDelete = useCallback(async () => {
        if (!pending || busy) return
        const { id, name } = pending
        setPending(null)
        setBusy(true)
        const res = await callApi(`/api/jobs/${encodeURIComponent(id)}`, 'DELETE')
        setBusy(false)
        if (!res.ok) {
            toast.show(`Couldn’t delete “${name}”: ${res.message}`, { variant: 'error' })
            return
        }
        toast.show(`Deleted “${name}”.`, { variant: 'success' })
        onChanged()
    }, [pending, busy, onChanged, toast])

    return (
        <>
            <tc-section-card title="Tasks" icon="clock">
                <div className="quaykeeper-admin-section">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        {jobs.length} task{jobs.length === 1 ? '' : 's'}. Scripts run on the Quaykeeper host as the app’s
                        user — click a name to edit, the play icon to run one now.
                    </p>

                    <div className="quaykeeper-instance-toolbar">
                        <tc-button variant="primary" size="sm" onClick={() => setEditor({ job: null })}>
                            New task
                        </tc-button>
                    </div>

                    {runningName && <tc-banner variant="info">Running “{runningName}” — waiting for it to finish…</tc-banner>}

                    {rows.length === 0 ? (
                        <tc-empty-state icon="clock">No scheduled tasks yet.</tc-empty-state>
                    ) : (
                        <DataTable<JobRow> columns={JOB_COLUMNS} rows={rows} rowKey={(row) => row.id} onAction={onAction} />
                    )}
                </div>
            </tc-section-card>

            {editor && (
                <JobEditor
                    key={editor.job?.id ?? 'new'}
                    job={editor.job}
                    onClose={() => setEditor(null)}
                    onSaved={() => {
                        setEditor(null)
                        onChanged()
                    }}
                />
            )}

            {runs && (
                <JobRunsModal
                    key={`${runs.jobId}:${runs.highlightRunId ?? ''}`}
                    jobId={runs.jobId}
                    highlightRunId={runs.highlightRunId}
                    onClose={() => setRuns(null)}
                />
            )}

            <ConfirmDialog
                open={!!pending}
                title="Delete task?"
                message={pending ? `Delete “${pending.name}” and its run history. This cannot be undone.` : undefined}
                confirmLabel="Delete"
                danger
                onConfirm={() => void doDelete()}
                onCancel={() => setPending(null)}
            />
        </>
    )
}
