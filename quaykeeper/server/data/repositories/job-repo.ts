// Scheduled-job repository — all SQL for the `scheduled_job` + `job_run` tables
// (the Scheduled tasks page). `scheduled_job` is the definition; `job_run` is the
// append-only execution history. A job's `lastRunAt`/`lastStatus` are NOT stored
// columns — they're derived by joining the most recent run, so there's one source
// of truth for a run's outcome.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { JobKind, JobRun, JobRunStatus, JobRunTrigger, ScheduledJob } from '@/server/domain/job'

// ── scheduled_job ─────────────────────────────────────────────────────────────

interface JobRaw {
    id: string
    name: string
    description: string | null
    kind: string
    script: string
    schedule: string | null
    enabled: number
    timeout_sec: number
    created_by: number
    created_at: string
    updated_at: string
    last_run_at: string | null
    last_status: string | null
}

// The list/read shape derives each job's most recent run via correlated subqueries.
// Ids are random (not monotonic), so recency is `rowid DESC` — insertion order,
// which is chronological because runs are only ever inserted, never updated.
const SELECT = `
    SELECT j.*,
        (SELECT jr.finished_at FROM job_run jr WHERE jr.job_id = j.id ORDER BY jr.rowid DESC LIMIT 1) AS last_run_at,
        (SELECT jr.status      FROM job_run jr WHERE jr.job_id = j.id ORDER BY jr.rowid DESC LIMIT 1) AS last_status
    FROM scheduled_job j
`

function mapJob(r: JobRaw): ScheduledJob {
    return {
        id: r.id,
        name: r.name,
        description: r.description ?? undefined,
        kind: r.kind as JobKind,
        script: r.script,
        schedule: r.schedule,
        enabled: r.enabled === 1,
        timeoutSec: r.timeout_sec,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        lastRunAt: r.last_run_at ?? undefined,
        lastStatus: (r.last_status as JobRunStatus | null) ?? undefined,
    }
}

export function create(row: {
    id: string
    name: string
    description?: string
    kind: JobKind
    script: string
    schedule: string | null
    enabled: boolean
    timeoutSec: number
    createdBy: number
    createdAt: string
}): void {
    prep(
        `INSERT INTO scheduled_job
            (id, name, description, kind, script, schedule, enabled, timeout_sec, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        row.id,
        row.name,
        row.description ?? null,
        row.kind,
        row.script,
        row.schedule,
        row.enabled ? 1 : 0,
        row.timeoutSec,
        row.createdBy,
        row.createdAt,
        row.createdAt,
    )
}

export function byId(id: string): ScheduledJob | undefined {
    const r = getRow<JobRaw>(`${SELECT} WHERE j.id = ?`, id)
    return r ? mapJob(r) : undefined
}

export function list(): ScheduledJob[] {
    return allRows<JobRaw>(`${SELECT} ORDER BY j.name`).map(mapJob)
}

/** Enabled jobs that carry a schedule — the set the cron ticker evaluates each minute. */
export function listSchedulable(): ScheduledJob[] {
    return allRows<JobRaw>(`${SELECT} WHERE j.enabled = 1 AND j.schedule IS NOT NULL ORDER BY j.name`).map(mapJob)
}

export function nameTaken(name: string, excludeId?: string): boolean {
    const r = excludeId
        ? getRow<{ n: number }>('SELECT COUNT(*) AS n FROM scheduled_job WHERE name = ? AND id != ?', name, excludeId)
        : getRow<{ n: number }>('SELECT COUNT(*) AS n FROM scheduled_job WHERE name = ?', name)
    return (r?.n ?? 0) > 0
}

export function update(
    id: string,
    fields: {
        name?: string
        description?: string | null
        kind?: JobKind
        script?: string
        schedule?: string | null
        enabled?: boolean
        timeoutSec?: number
        updatedAt: string
    },
): void {
    const sets: string[] = []
    const params: (string | number | null)[] = []
    if (fields.name !== undefined) {
        sets.push('name = ?')
        params.push(fields.name)
    }
    if (fields.description !== undefined) {
        sets.push('description = ?')
        params.push(fields.description)
    }
    if (fields.kind !== undefined) {
        sets.push('kind = ?')
        params.push(fields.kind)
    }
    if (fields.script !== undefined) {
        sets.push('script = ?')
        params.push(fields.script)
    }
    if (fields.schedule !== undefined) {
        sets.push('schedule = ?')
        params.push(fields.schedule)
    }
    if (fields.enabled !== undefined) {
        sets.push('enabled = ?')
        params.push(fields.enabled ? 1 : 0)
    }
    if (fields.timeoutSec !== undefined) {
        sets.push('timeout_sec = ?')
        params.push(fields.timeoutSec)
    }
    sets.push('updated_at = ?')
    params.push(fields.updatedAt)
    params.push(id)
    prep(`UPDATE scheduled_job SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function remove(id: string): void {
    prep('DELETE FROM scheduled_job WHERE id = ?').run(id)
}

// ── job_run ───────────────────────────────────────────────────────────────────

interface RunRaw {
    id: string
    job_id: string
    trigger: string
    status: string
    exit_code: number | null
    stdout: string
    stderr: string
    truncated: number
    started_at: string
    finished_at: string
    duration_ms: number
    triggered_by: number | null
    triggered_by_login: string | null
}

function mapRun(r: RunRaw): JobRun {
    return {
        id: r.id,
        jobId: r.job_id,
        trigger: r.trigger as JobRunTrigger,
        status: r.status as JobRunStatus,
        exitCode: r.exit_code,
        stdout: r.stdout,
        stderr: r.stderr,
        truncated: r.truncated === 1,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
        durationMs: r.duration_ms,
        triggeredBy: r.triggered_by,
        triggeredByLogin: r.triggered_by_login ?? undefined,
    }
}

export function insertRun(run: JobRun): void {
    prep(
        `INSERT INTO job_run
            (id, job_id, trigger, status, exit_code, stdout, stderr, truncated,
             started_at, finished_at, duration_ms, triggered_by, triggered_by_login)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        run.id,
        run.jobId,
        run.trigger,
        run.status,
        run.exitCode,
        run.stdout,
        run.stderr,
        run.truncated ? 1 : 0,
        run.startedAt,
        run.finishedAt,
        run.durationMs,
        run.triggeredBy,
        run.triggeredByLogin ?? null,
    )
}

export function runById(id: string): JobRun | undefined {
    const r = getRow<RunRaw>('SELECT * FROM job_run WHERE id = ?', id)
    return r ? mapRun(r) : undefined
}

export function listRuns(jobId: string, limit = 50): JobRun[] {
    return allRows<RunRaw>('SELECT * FROM job_run WHERE job_id = ? ORDER BY rowid DESC LIMIT ?', jobId, limit).map(
        mapRun,
    )
}

/**
 * Drop all but the newest `keep` runs of a job (called after each run so history
 * can't grow unbounded). `id` sorts chronologically (base36 random but insert
 * order is preserved by rowid; we order by the DESC index and keep the top N).
 */
export function pruneRuns(jobId: string, keep: number): void {
    prep(
        `DELETE FROM job_run
         WHERE job_id = ?
           AND id NOT IN (SELECT id FROM job_run WHERE job_id = ? ORDER BY rowid DESC LIMIT ?)`,
    ).run(jobId, jobId, keep)
}
