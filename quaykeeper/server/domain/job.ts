// Pure scheduled-job model + validation — no `server-only`, no I/O — so the
// shape rules behind `/api/jobs/**` are unit-testable in isolation AND the
// editor can reuse the exact same validator + cron preview the server enforces
// (mirrors how `domain/docker-run.ts` is shared by the snippet form and service).
//
// A job is a saved shell or JavaScript script the owner runs on the Quaykeeper
// host: on a 5-field cron schedule, on demand ("run now"), or both. Execution +
// persistence live in `services/jobs.ts`; this module owns only the decisions.

import { InvalidCronError, parseCron } from '@/server/domain/cron'

/** What interpreter runs the script. `shell` → `$QUAYKEEPER_JOB_SHELL` (bash); `node` → the app's node binary. */
export type JobKind = 'shell' | 'node'

export const JOB_KINDS: readonly JobKind[] = ['shell', 'node']

export function isJobKind(value: unknown): value is JobKind {
    return typeof value === 'string' && (JOB_KINDS as readonly string[]).includes(value)
}

/** How a run was started. */
export type JobRunTrigger = 'manual' | 'schedule'

/**
 * Terminal outcome of a run:
 *   • `success`  — process exited 0.
 *   • `failed`   — process exited non-zero.
 *   • `timeout`  — killed after exceeding the job's timeout.
 *   • `error`    — never ran (spawn failed: interpreter missing, write error, …).
 */
export type JobRunStatus = 'success' | 'failed' | 'timeout' | 'error'

export interface ScheduledJob {
    id: string
    name: string
    description?: string
    kind: JobKind
    /** The script source (shell or JS). */
    script: string
    /** 5-field cron expression, or null for a manual-only job (run-now only). */
    schedule: string | null
    enabled: boolean
    /** Hard wall-clock cap (seconds) before the run is killed. */
    timeoutSec: number
    createdBy: number
    createdAt: string
    updatedAt: string
    /** Denormalized convenience from the latest run (for the list view). */
    lastRunAt?: string
    lastStatus?: JobRunStatus
}

export interface JobRun {
    id: string
    jobId: string
    trigger: JobRunTrigger
    status: JobRunStatus
    /** Process exit code, or null when killed by signal / never spawned. */
    exitCode: number | null
    stdout: string
    stderr: string
    /** True when output was capped (the stored text is a prefix). */
    truncated: boolean
    startedAt: string
    finishedAt: string
    durationMs: number
    /** github_id that clicked "run now"; null for a scheduled run. */
    triggeredBy: number | null
    triggeredByLogin?: string
}

// ── limits ────────────────────────────────────────────────────────────────────

/** Job name: free-text human label, 1–64 chars after trimming (mirrors the snippet name cap). */
export const JOB_NAME_MAX = 64
/** Script source size cap — generous for real automation, bounded so the DB row stays sane. */
export const JOB_SCRIPT_MAX = 64 * 1024
/** Timeout bounds (seconds). A run may not be unbounded (would pin a worker forever). */
export const JOB_TIMEOUT_MIN = 1
export const JOB_TIMEOUT_MAX = 3600
export const JOB_TIMEOUT_DEFAULT = 60

// ── validation ──────────────────────────────────────────────────────────────

/** A normalized, validated job payload (what the service persists). */
export interface JobInput {
    name: string
    description?: string
    kind: JobKind
    script: string
    schedule: string | null
    enabled: boolean
    timeoutSec: number
}

/** Raw request body for a create/update (every field optional on update). */
export interface JobInputRaw {
    name?: unknown
    description?: unknown
    kind?: unknown
    script?: unknown
    schedule?: unknown
    enabled?: unknown
    timeoutSec?: unknown
}

/** Why a job payload was rejected (the service maps `field` → a 400 code). */
export interface JobValidationError {
    field: 'name' | 'kind' | 'script' | 'schedule' | 'timeoutSec'
    message: string
}

export type JobValidation = { ok: true; input: JobInput } | { ok: false; error: JobValidationError }

/**
 * Validate + normalize a full job payload (create, or an update with every field
 * present). `defaults` supplies the fallback for fields the caller may omit on an
 * update — pass the stored job for a partial edit, or nothing for a create.
 *
 * Rules: name 1–{@link JOB_NAME_MAX} chars; kind ∈ {@link JOB_KINDS}; script
 * non-empty and ≤ {@link JOB_SCRIPT_MAX} bytes; schedule empty/absent = manual-only,
 * else a parseable 5-field cron; timeout an integer in
 * [{@link JOB_TIMEOUT_MIN}, {@link JOB_TIMEOUT_MAX}].
 */
export function validateJobInput(raw: JobInputRaw, defaults?: Partial<JobInput>): JobValidation {
    // name
    const nameRaw = raw.name ?? defaults?.name
    if (typeof nameRaw !== 'string' || nameRaw.trim() === '') {
        return { ok: false, error: { field: 'name', message: 'A job needs a name.' } }
    }
    const name = nameRaw.trim()
    if (name.length > JOB_NAME_MAX) {
        return { ok: false, error: { field: 'name', message: `Name must be at most ${JOB_NAME_MAX} characters.` } }
    }

    // kind
    const kind = raw.kind ?? defaults?.kind
    if (!isJobKind(kind)) {
        return { ok: false, error: { field: 'kind', message: 'Kind must be "shell" or "node".' } }
    }

    // script
    const scriptRaw = raw.script ?? defaults?.script
    if (typeof scriptRaw !== 'string' || scriptRaw.trim() === '') {
        return { ok: false, error: { field: 'script', message: 'The script is empty.' } }
    }
    // TextEncoder (not Buffer): this module is imported client-side by the editor,
    // where the Node `Buffer` global isn't in the bundle.
    if (new TextEncoder().encode(scriptRaw).length > JOB_SCRIPT_MAX) {
        return {
            ok: false,
            error: { field: 'script', message: `Script must be at most ${JOB_SCRIPT_MAX / 1024} KB.` },
        }
    }

    // schedule (optional)
    let schedule: string | null
    const schedSource = raw.schedule !== undefined ? raw.schedule : defaults?.schedule ?? null
    if (schedSource == null || (typeof schedSource === 'string' && schedSource.trim() === '')) {
        schedule = null
    } else if (typeof schedSource !== 'string') {
        return { ok: false, error: { field: 'schedule', message: 'Schedule must be a string.' } }
    } else {
        schedule = schedSource.trim()
        try {
            parseCron(schedule)
        } catch (err) {
            const msg = err instanceof InvalidCronError ? err.message : 'Invalid cron expression.'
            return { ok: false, error: { field: 'schedule', message: msg } }
        }
    }

    // enabled (default true)
    const enabledSource = raw.enabled !== undefined ? raw.enabled : defaults?.enabled ?? true
    const enabled = Boolean(enabledSource)

    // timeout
    const timeoutSource = raw.timeoutSec !== undefined ? raw.timeoutSec : defaults?.timeoutSec ?? JOB_TIMEOUT_DEFAULT
    const timeoutSec = Number(timeoutSource)
    if (!Number.isInteger(timeoutSec) || timeoutSec < JOB_TIMEOUT_MIN || timeoutSec > JOB_TIMEOUT_MAX) {
        return {
            ok: false,
            error: {
                field: 'timeoutSec',
                message: `Timeout must be a whole number of seconds between ${JOB_TIMEOUT_MIN} and ${JOB_TIMEOUT_MAX}.`,
            },
        }
    }

    return {
        ok: true,
        input: {
            name,
            description:
                typeof raw.description === 'string'
                    ? raw.description.trim() || undefined
                    : defaults?.description,
            kind,
            script: scriptRaw,
            schedule,
            enabled,
            timeoutSec,
        },
    }
}
