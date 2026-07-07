// Scheduled-job service — the `/api/jobs` policy + execution layer. Mirrors
// `services/docker-snippets.ts` (typed errors + `httpErrorFor`, audited mutations,
// validation through the pure `domain/job.ts`) and adds the executor: a job's
// shell/JS script is written to a throwaway temp file and spawned on the
// Quaykeeper HOST, output captured (bounded), killed on timeout, and the run
// recorded in `job_run`.
//
// SECURITY: a job runs arbitrary code as the Quaykeeper process user on the host.
// Every route is `authorize('owner')`-gated (the highest role) and every create /
// update / delete / run is audited. This is the same host-shell trust boundary the
// custom-domain certbot path already assumes — the owner IS the operator.

import 'server-only'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as jobRepo from '@/server/data/repositories/job-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { config } from '@/server/config'
import { ID } from '@/server/infrastructure/ids'
import { slog } from '@/server/infrastructure/server-log'
import {
    validateJobInput,
    type JobInput,
    type JobInputRaw,
    type JobRun,
    type JobRunStatus,
    type JobRunTrigger,
    type ScheduledJob,
} from '@/server/domain/job'

export class JobError extends Error {
    constructor(
        message: string,
        public code: string,
        public status: 400 | 404 | 409,
    ) {
        super(message)
        this.name = 'JobError'
    }
}

export interface HttpError {
    status: number
    code: string
    message?: string
}

export function httpErrorFor(err: unknown): HttpError {
    if (err instanceof JobError) return { status: err.status, code: err.code, message: err.message }
    return { status: 500, code: 'internal_error' }
}

interface Actor {
    githubId: number
    login: string
}

function audit(actor: Actor, action: string, detail?: string, meta?: unknown): void {
    auditRepo.append({ githubId: actor.githubId, login: actor.login, action, detail, meta })
}

function found(id: string): ScheduledJob {
    const job = jobRepo.byId(id)
    if (!job) throw new JobError('job not found', 'job_not_found', 404)
    return job
}

/** Turn a `domain/job.ts` validation failure into a route-ready 400. */
function checked(raw: JobInputRaw, defaults?: Partial<JobInput>): JobInput {
    const result = validateJobInput(raw, defaults)
    if (!result.ok) throw new JobError(result.error.message, `invalid_${result.error.field}`, 400)
    return result.input
}

// ── read ──────────────────────────────────────────────────────────────────────

export function listJobs(): ScheduledJob[] {
    return jobRepo.list()
}

export function getJob(id: string): ScheduledJob {
    return found(id)
}

export interface JobWithRuns {
    job: ScheduledJob
    runs: JobRun[]
}

/** A job plus its recent run history (the detail / runs modal payload). */
export function getJobWithRuns(id: string, runLimit = 50): JobWithRuns {
    const job = found(id)
    return { job, runs: jobRepo.listRuns(id, runLimit) }
}

export function listRuns(id: string, limit = 50): JobRun[] {
    found(id) // 404 if the job is gone
    return jobRepo.listRuns(id, limit)
}

// ── create / update / delete ───────────────────────────────────────────────────

export type CreateJobRequest = JobInputRaw
export type UpdateJobRequest = JobInputRaw

export function createJob(actor: Actor, body: CreateJobRequest): ScheduledJob {
    const input = checked(body)
    if (jobRepo.nameTaken(input.name)) throw new JobError(`"${input.name}" is already taken`, 'name_taken', 409)

    const id = ID.job()
    jobRepo.create({
        id,
        name: input.name,
        description: input.description,
        kind: input.kind,
        script: input.script,
        schedule: input.schedule,
        enabled: input.enabled,
        timeoutSec: input.timeoutSec,
        createdBy: actor.githubId,
        createdAt: new Date().toISOString(),
    })
    audit(actor, 'job.create', input.name, {
        kind: input.kind,
        schedule: input.schedule,
        enabled: input.enabled,
        timeoutSec: input.timeoutSec,
    })
    return found(id)
}

export function updateJob(actor: Actor, id: string, body: UpdateJobRequest): ScheduledJob {
    const current = found(id)
    // Validate the merged shape (request fields over the stored ones) so a partial
    // edit still satisfies every cross-field rule.
    const input = checked(body, {
        name: current.name,
        description: current.description,
        kind: current.kind,
        script: current.script,
        schedule: current.schedule,
        enabled: current.enabled,
        timeoutSec: current.timeoutSec,
    })
    if (input.name !== current.name && jobRepo.nameTaken(input.name, id)) {
        throw new JobError(`"${input.name}" is already taken`, 'name_taken', 409)
    }

    jobRepo.update(id, {
        name: input.name,
        description: input.description ?? null,
        kind: input.kind,
        script: input.script,
        schedule: input.schedule,
        enabled: input.enabled,
        timeoutSec: input.timeoutSec,
        updatedAt: new Date().toISOString(),
    })
    audit(actor, 'job.update', input.name, { kind: input.kind, schedule: input.schedule, enabled: input.enabled })
    return found(id)
}

/** Toggle only the enabled flag (the list's quick switch). */
export function setEnabled(actor: Actor, id: string, enabled: boolean): ScheduledJob {
    const job = found(id)
    jobRepo.update(id, { enabled, updatedAt: new Date().toISOString() })
    audit(actor, enabled ? 'job.enable' : 'job.disable', job.name)
    return found(id)
}

export function deleteJob(actor: Actor, id: string): void {
    const job = found(id)
    jobRepo.remove(id) // job_run rows cascade
    audit(actor, 'job.delete', job.name)
}

// ── execution ───────────────────────────────────────────────────────────────

/** Per-stream output cap. Beyond this we stop appending and flag the run truncated. */
const OUTPUT_CAP_BYTES = 256 * 1024
/** Runs kept per job; older ones are pruned after each execution. */
const KEEP_RUNS = 50

// In-process guard against overlapping runs of the SAME job (a manual run racing a
// scheduled fire, or two scheduled fires if a run overruns its minute). One job runs
// at a time; the second caller is refused (manual) or skipped (scheduler). Survives
// dev hot-reload via globalThis, like the other tickers' singletons.
declare global {
    var __quaykeeperRunningJobs: Set<string> | undefined
}
function runningJobs(): Set<string> {
    if (!globalThis.__quaykeeperRunningJobs) globalThis.__quaykeeperRunningJobs = new Set()
    return globalThis.__quaykeeperRunningJobs
}

export function isRunning(id: string): boolean {
    return runningJobs().has(id)
}

interface SpawnOutcome {
    status: JobRunStatus
    exitCode: number | null
    stdout: string
    stderr: string
    truncated: boolean
}

/** Spawn the interpreter over the script file, capping output and killing on timeout. */
function execScript(argv0: string, args: string[], cwd: string, timeoutSec: number): Promise<SpawnOutcome> {
    return new Promise((resolve) => {
        let child: ReturnType<typeof spawn>
        try {
            child = spawn(argv0, args, {
                cwd,
                env: process.env,
                stdio: ['ignore', 'pipe', 'pipe'],
                // Own process group: a timeout kill targets the WHOLE group
                // (`-pid`), not just the interpreter — otherwise a grandchild
                // (e.g. `sleep` under `sh`) keeps the stdout pipe open and the
                // 'close' event hangs until it exits on its own.
                detached: true,
            })
        } catch (err) {
            // Synchronous spawn failure (rare) — treat like the async 'error' path.
            resolve({ status: 'error', exitCode: null, stdout: '', stderr: String(err), truncated: false })
            return
        }

        // Accumulate raw Buffers (byte-accurate cap) and decode once at the end —
        // decoding per chunk splits multibyte UTF-8 sequences at chunk boundaries
        // (U+FFFD garbage), and capping on `.length` after a per-chunk `toString`
        // counts UTF-16 code units, letting non-ASCII output through well past
        // the intended byte cap.
        const outChunks: Buffer[] = []
        let outBytes = 0
        const errChunks: Buffer[] = []
        let errBytes = 0
        let truncated = false
        let timedOut = false
        let settled = false

        const cap = (chunks: Buffer[], bytes: number, d: Buffer): number => {
            if (bytes >= OUTPUT_CAP_BYTES) {
                truncated = true
                return bytes
            }
            let chunk = d
            if (bytes + chunk.length > OUTPUT_CAP_BYTES) {
                truncated = true
                chunk = chunk.subarray(0, OUTPUT_CAP_BYTES - bytes)
            }
            chunks.push(chunk)
            return bytes + chunk.length
        }
        const decode = (chunks: Buffer[]): string => Buffer.concat(chunks).toString('utf8')

        child.stdout?.on('data', (d: Buffer) => {
            outBytes = cap(outChunks, outBytes, d)
        })
        child.stderr?.on('data', (d: Buffer) => {
            errBytes = cap(errChunks, errBytes, d)
        })

        const timer = setTimeout(() => {
            timedOut = true
            // Kill the whole process group (negative pid); fall back to the direct
            // child if the group is already gone / pid is unavailable.
            try {
                if (child.pid) process.kill(-child.pid, 'SIGKILL')
                else child.kill('SIGKILL')
            } catch {
                child.kill('SIGKILL')
            }
        }, timeoutSec * 1000)
        timer.unref?.()

        const finish = (o: SpawnOutcome) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve(o)
        }

        child.on('error', (err) => {
            // Interpreter missing / not executable → the job never ran.
            const errOut = decode(errChunks)
            finish({ status: 'error', exitCode: null, stdout: decode(outChunks), stderr: errOut || String(err), truncated })
        })
        child.on('close', (code) => {
            const status: JobRunStatus = timedOut
                ? 'timeout'
                : code === 0
                  ? 'success'
                  : 'failed'
            finish({ status, exitCode: code, stdout: decode(outChunks), stderr: decode(errChunks), truncated })
        })
    })
}

/**
 * Run a job's script on the host now and record a `job_run`. `trigger` is `manual`
 * (owner clicked "run now", `actor` attributed) or `schedule` (the cron ticker, no
 * actor). Refuses (409) if the same job is already running. Returns the completed
 * run — including captured stdout/stderr — so the caller can show output.
 */
export async function runJob(id: string, trigger: JobRunTrigger, actor?: Actor): Promise<JobRun> {
    const job = found(id)
    const running = runningJobs()
    if (running.has(id)) throw new JobError('this job is already running', 'job_running', 409)
    running.add(id)

    const startedAt = new Date()
    let dir: string | null = null
    let outcome: SpawnOutcome
    try {
        dir = await mkdtemp(path.join(tmpdir(), 'qk-job-'))
        if (job.kind === 'node') {
            // `.mjs` so the script is ESM regardless of the app's module type; runs
            // under the SAME node binary serving the app.
            const file = path.join(dir, 'script.mjs')
            await writeFile(file, job.script, 'utf8')
            outcome = await execScript(process.execPath, [file], dir, job.timeoutSec)
        } else {
            const file = path.join(dir, 'script.sh')
            await writeFile(file, job.script, 'utf8')
            outcome = await execScript(config.jobShell, [file], dir, job.timeoutSec)
        }
    } catch (err) {
        // A filesystem failure before/around spawn (couldn't write the temp file).
        outcome = { status: 'error', exitCode: null, stdout: '', stderr: String(err), truncated: false }
    } finally {
        if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {})
    }

    const finishedAt = new Date()
    const run: JobRun = {
        id: ID.jobRun(),
        jobId: id,
        trigger,
        status: outcome.status,
        exitCode: outcome.exitCode,
        stdout: outcome.stdout,
        stderr: outcome.stderr,
        truncated: outcome.truncated,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        triggeredBy: actor?.githubId ?? null,
        triggeredByLogin: actor?.login,
    }

    try {
        jobRepo.insertRun(run)
        jobRepo.pruneRuns(id, KEEP_RUNS)
    } finally {
        running.delete(id)
    }

    if (actor) {
        audit(actor, 'job.run', job.name, { trigger, status: run.status, exitCode: run.exitCode, durationMs: run.durationMs })
    }
    slog(run.status === 'success' ? 'info' : 'warn', 'jobs', 'run complete', {
        job: id,
        name: job.name,
        trigger,
        status: run.status,
        exitCode: run.exitCode,
        durationMs: run.durationMs,
    })
    return run
}
