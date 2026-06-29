// The execution engine (§6): a module-level singleton re-implementing
// executor.sh in TypeScript. Owns at most one running `claude` child per repo
// lock, streams stream-json events to SSE, and reproduces resume / limit /
// transient-retry / warm-session behavior.

import 'server-only'
import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ChildProcess } from 'node:child_process'
import { config } from '@/server/config'
import { spawnAgent, resolveModel } from '@/server/infrastructure/agent'
import { resolveAccount, pickAccount, coolDownAccount } from '@/server/services/accounts'
import { createAgentStreamParser } from '@/server/infrastructure/stream-json'
import { aiCommitMessage } from '@/server/services/commit-message'
import { agentSessionsBusy } from '@/server/services/locks'
import {
    listTaskFiles,
    readCompleted,
    appendCompleted,
    clearCompleted,
    removeCompleted,
    updateTaskStatus,
    readTaskFile,
    parseTask,
    dependencyMatches,
    projectPath,
    projectTasksDir,
    readProjectPromptOverride,
    readWarmSession,
    writeWarmSession,
    clearWarmSession,
    knowledgeExists,
    reconcileTasks,
} from '@/server/infrastructure/fs-workspace'
import { updateKnowledge } from '@/server/services/knowledge'
import { reviewTask } from '@/server/services/review'
import { effectiveSettings, dispatchProjectEvent } from '@/server/services/settings'
import * as git from '@/server/infrastructure/git'
import { isClean, dirtyFiles } from '@/server/infrastructure/git'
import { canPush } from '@/server/config'
import { parseGithubRepo, createPull, defaultBranch, commentIssue, closeIssue } from '@/server/infrastructure/github'
import * as projectRepo from '@/server/data/repositories/project-repo'
import { RunLogger } from '@/server/infrastructure/logs'
import { slog } from '@/server/infrastructure/server-log'
import { isLimitError, isTransientError, computeLimitSleep } from '@/server/domain/limit'
import { scrubSecrets } from '@/server/domain/account-secrets'
import { notifyBatch } from '@/server/infrastructure/slack'
import { refreshUsage } from '@/server/services/usage'
import { ensureImported } from '@/server/services/migrate-fs'
import * as runEventRepo from '@/server/data/repositories/run-event-repo'
import * as runRepo from '@/server/data/repositories/run-repo'
import * as taskRepo from '@/server/data/repositories/task-repo'
import type { AgentUsage } from '@/server/infrastructure/stream-json'
import type {
    EngineState,
    RunOptions,
    RunSnapshot,
    SseEvent,
    TerminalKind,
    TelemetryRecord,
} from '@/server/domain/types'

const RING_MAX = 1000

// Events persisted to the durable run-event log (best-effort). `log` frames are
// included (tagged with the run id) so the B1 run-history page can replay a
// finished run's terminal; old log rows are pruned at finalize (see RUN_LOG_KEEP).
const PERSIST_EVENTS = new Set<SseEvent['type']>([
    'log',
    'task:begin',
    'task:done',
    'task:error',
    'commit',
    'limit',
    'completed',
    'stopped',
])

/** Days of per-run `log` frames kept in run_event (milestones are kept forever). */
const RUN_LOG_KEEP_DAYS = 14

interface RepoRun {
    state: EngineState
    current: string | null
    done: number
    error: number
    total: number
    wakeAt: number | null
    model: string | null
    startedAt: number | null
    /** B1 — persistent `run` row id for this run (0 when the write failed). */
    runId: number
    /** B5 — branch created for this run, if branch-per-run was enabled. */
    branch: string | null
    // control
    stopRequested: boolean
    forceRequested: boolean
    /** Kill only the in-flight task's process; the run continues with the next task. */
    skipRequested: boolean
    child: ChildProcess | null
    /** IMP-1 — pending SIGKILL grace timer from force/skip; cleared on child exit. */
    killTimer: ReturnType<typeof setTimeout> | null
    sleepResolver: (() => void) | null
    logger: RunLogger | null
    ring: SseEvent[]
    // batch-notify accumulators
    completedThisRun: string[]
    erroredThisRun: string[]
    /** A4 — tasks left pending because a dependency was not done. */
    depSkippedThisRun: string[]
}

function freshRun(): RepoRun {
    return {
        state: 'IDLE',
        current: null,
        done: 0,
        error: 0,
        total: 0,
        wakeAt: null,
        model: null,
        startedAt: null,
        runId: 0,
        branch: null,
        stopRequested: false,
        forceRequested: false,
        skipRequested: false,
        child: null,
        killTimer: null,
        sleepResolver: null,
        logger: null,
        ring: [],
        completedThisRun: [],
        erroredThisRun: [],
        depSkippedThisRun: [],
    }
}

export class LockHeldError extends Error {}
export class DirtyTreeError extends Error {
    constructor(public files: string[]) {
        super('Working tree is not clean')
    }
}

/**
 * The model family (`opus` / `sonnet` / `haiku`) named in a string, or null if
 * none. Used to scope the usage gate: a `/usage` bucket whose label names a
 * specific model (e.g. the Sonnet-only weekly limit) only constrains tasks that
 * run that model — generic buckets ("session", "week (all models)") name no
 * family and constrain everything.
 */
export function modelFamily(s: string): string | null {
    const m = s.toLowerCase().match(/\b(opus|sonnet|haiku)\b/)
    return m ? m[1] : null
}

const DEFAULT_PREAMBLE = `You are an autonomous engineer resolving a single queued task.

- The task is provided inline below — implement it end-to-end.
- You are running at the project root. The codebase lives in the \`repo/\` subdirectory — apply ALL code changes inside \`repo/\`.
- Read the root CLAUDE.md and \`knowledge/index.md\` first to understand the project, and follow the repo's own conventions and every hard rule you find there.
- Update any specs, docs, or tests affected by your change.
- Keep the change scoped to this task; do not touch unrelated code.
- Do NOT stage, commit, or push. Leave your changes in the working tree — the runner records task status and (optionally) commits.

Task:`

class ExecutionManager extends EventEmitter {
    private runs = new Map<string, RepoRun>()

    constructor() {
        super()
        // COR-3 — every open SSE stream adds one 'event' listener; the default
        // cap of 10 would warn from the 11th concurrent client. Listeners are
        // removed on SSE cancel(), so lift the bound rather than mask a leak.
        this.setMaxListeners(0)
    }

    private get(repo: string): RepoRun {
        let r = this.runs.get(repo)
        if (!r) {
            r = freshRun()
            this.runs.set(repo, r)
        }
        return r
    }

    snapshot(repo: string): RunSnapshot {
        const r = this.get(repo)
        return {
            project: repo,
            state: r.state,
            current: r.current,
            done: r.done,
            error: r.error,
            total: r.total,
            wakeAt: r.wakeAt,
            model: r.model,
            startedAt: r.startedAt,
        }
    }

    state(repo: string): EngineState {
        return this.get(repo).state
    }

    /** D4 — every tracked project's engine state (health page). */
    states(): { project: string; state: EngineState }[] {
        return [...this.runs.entries()].map(([project, r]) => ({ project, state: r.state }))
    }

    /** Replay buffer for late SSE subscribers (recent log frames + key events). */
    ring(repo: string): SseEvent[] {
        return [...this.get(repo).ring]
    }

    // ── event emission ──────────────────────────────────────────────────────

    private emitEvent(repo: string, event: SseEvent): void {
        const r = this.get(repo)
        if (event.type === 'log' || event.type === 'task:begin' || event.type === 'commit') {
            r.ring.push(event)
            if (r.ring.length > RING_MAX) r.ring.splice(0, r.ring.length - RING_MAX)
        }
        if (PERSIST_EVENTS.has(event.type)) {
            try {
                runEventRepo.append(repo, event, r.runId || null)
            } catch {
                /* durability is best-effort; never block the run */
            }
        }
        this.emit('event', repo, event)
    }

    private log(repo: string, kind: TerminalKind, text: string, taskId: string | null): void {
        const r = this.get(repo)
        for (const line of text.split('\n')) {
            if (line.length === 0) continue
            r.logger?.write(line)
            this.emitEvent(repo, { type: 'log', taskId, kind, text: line })
        }
    }

    private setState(repo: string, state: EngineState): void {
        const r = this.get(repo)
        r.state = state
        if (state !== 'SLEEPING') r.wakeAt = null
        this.emitEvent(repo, { type: 'state', state })
    }

    private progress(repo: string): void {
        const r = this.get(repo)
        this.emitEvent(repo, { type: 'progress', done: r.done, error: r.error, total: r.total })
    }

    // ── lock ──────────────────────────────────────────────────────────────────

    private lockPath(repo: string): string {
        return path.join(projectTasksDir(repo), '.lock')
    }

    private async acquireLock(repo: string): Promise<void> {
        // The IDLE→claimed transition is owned by start() (set synchronously
        // before its first await), so no state re-check is needed here.
        await fs.mkdir(projectTasksDir(repo), { recursive: true })
        // DAT-2 — honor a foreign .lock: if it names a PID that is still alive
        // (and isn't us), another process holds the checkout — refuse instead of
        // overwriting. A .lock for a dead/absent PID is stale → reclaim.
        const existing = await fs.readFile(this.lockPath(repo), 'utf8').catch(() => null)
        if (existing) {
            const pid = Number(existing.trim())
            if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
                let alive: boolean
                try {
                    process.kill(pid, 0) // signal 0 = liveness probe, kills nothing
                    alive = true
                } catch (e) {
                    // ESRCH → no such process (dead, reclaim). EPERM → the process
                    // exists but is owned by another user (alive, foreign owner) —
                    // treat as held, never reclaim a live foreign lock.
                    alive = (e as NodeJS.ErrnoException)?.code === 'EPERM'
                }
                if (alive) {
                    throw new LockHeldError(`Lock held by live process ${pid} for ${repo}`)
                }
            }
        }
        await fs.writeFile(this.lockPath(repo), String(process.pid), 'utf8').catch(() => {})
    }

    private async releaseLock(repo: string): Promise<void> {
        await fs.unlink(this.lockPath(repo)).catch(() => {})
    }

    /** Whether branch/push are allowed (rejected while a run holds the lock). */
    isLocked(repo: string): boolean {
        return this.get(repo).state !== 'IDLE'
    }

    // ── public controls ────────────────────────────────────────────────────────

    /**
     * Start a run. Performs the clean-repo gate and lock acquisition synchronously,
     * then kicks off the loop in the background and returns the initial snapshot.
     */
    async start(repo: string, opts: RunOptions): Promise<RunSnapshot> {
        const r = this.get(repo)
        if (r.state !== 'IDLE') throw new LockHeldError('A run is already in progress for this repo')
        // §mutual exclusion — at most one Claude process per project across
        // {executor, task-creator, knowledge-writer, note-writer}.
        if (agentSessionsBusy(repo)) {
            throw new LockHeldError('An agent session is running for this project')
        }
        // Claim the slot synchronously — flip state before the first `await` so a
        // concurrent start() observes non-IDLE and is rejected. Closes a
        // double-start race across the (async) clean-tree gate + lock write that
        // would otherwise let two runs spawn for the same repo.
        r.state = 'RUNNING'

        try {
            // §6.14 clean-repo gate (only when actually executing, not for dry runs)
            if (!opts.dryRun) {
                const clean = await isClean(repo).catch(() => true)
                if (!clean) {
                    throw new DirtyTreeError(await dirtyFiles(repo))
                }
            }
            await this.acquireLock(repo)
        } catch (err) {
            // roll back the synchronous claim (unless a run object already took over)
            if (this.runs.get(repo) === r) r.state = 'IDLE'
            throw err
        }

        // reset run state
        const run = freshRun()
        run.state = 'RUNNING'
        run.model = resolveModel(opts.model)
        run.startedAt = Date.now()
        run.logger = new RunLogger(repo)

        // B1 — persistent run record (best-effort; runId 0 means "not recorded")
        if (!opts.dryRun) {
            try {
                run.runId = runRepo.start(repo, opts, opts.startedBy ?? null)
            } catch {
                run.runId = 0
            }
        }

        this.runs.set(repo, run)

        // B5 — per-run branch, after the clean-tree gate so switching is safe.
        if (opts.branchPerRun && !opts.dryRun) {
            const branch = `taskforge/run-${run.runId || Date.now()}`
            try {
                await git.createOrSwitchBranch(repo, branch)
                run.branch = branch
                if (run.runId) runRepo.setBranch(run.runId, branch)
            } catch (err: any) {
                // a failed branch creation must not leave the lock held
                await this.releaseLock(repo)
                this.runs.set(repo, freshRun())
                throw err
            }
        }

        this.emitEvent(repo, { type: 'state', state: 'RUNNING' })
        slog('info', 'engine', `run started`, {
            project: repo,
            model: run.model,
            runId: run.runId,
            branch: run.branch,
            dryRun: !!opts.dryRun,
            reset: !!opts.reset,
            filter: opts.filter,
            resetTasks: opts.resetTasks,
            startedBy: opts.startedBy,
        })

        // run the loop without blocking the request
        void this.runLoop(repo, opts).catch((err) => {
            slog('error', 'engine', `run loop crashed`, { project: repo, error: err?.message ?? String(err) })
            this.log(repo, 'error', `engine error: ${err?.message ?? err}`, null)
        })

        return this.snapshot(repo)
    }

    stopAfterCurrent(repo: string): RunSnapshot {
        const r = this.get(repo)
        if (r.state === 'RUNNING' || r.state === 'SLEEPING') {
            slog('info', 'engine', `graceful stop requested`, { project: repo, current: r.current })
            r.stopRequested = true
            this.setState(repo, 'STOPPING')
            // a graceful stop while sleeping wakes the sleep so the run can end
            if (r.sleepResolver) r.sleepResolver()
        }
        return this.snapshot(repo)
    }

    async force(repo: string): Promise<RunSnapshot> {
        const r = this.get(repo)
        slog('warn', 'engine', `force stop requested`, { project: repo, current: r.current, pid: r.child?.pid })
        r.forceRequested = true
        // kill the process group (detached:true → negative pid)
        if (r.child && r.child.pid) {
            const pid = r.child.pid
            try {
                process.kill(-pid, 'SIGTERM')
            } catch {
                r.child.kill('SIGTERM')
            }
            const grace = config.forceKillGraceMs
            // IMP-1 — track the SIGKILL timer so the child's close handler can
            // cancel it; otherwise it fires after a clean exit and may SIGKILL a
            // reused pid (an unrelated process group).
            r.killTimer = setTimeout(() => {
                try {
                    process.kill(-pid, 'SIGKILL')
                } catch {
                    /* already gone */
                }
            }, grace)
        }
        if (r.sleepResolver) r.sleepResolver()
        return this.snapshot(repo)
    }

    /**
     * §5.2 — kill only the current task's process; the loop marks it errored
     * ("skipped by user") and continues with the next task.
     */
    skipCurrent(repo: string): RunSnapshot {
        const r = this.get(repo)
        if (r.state === 'RUNNING' && r.child?.pid) {
            const pid = r.child.pid
            slog('info', 'engine', `skip current requested`, { project: repo, current: r.current, pid })
            r.skipRequested = true
            try {
                process.kill(-pid, 'SIGTERM')
            } catch {
                r.child.kill('SIGTERM')
            }
            // IMP-1 — track the SIGKILL timer so the child's close handler can
            // cancel it before it can hit a reused pid.
            r.killTimer = setTimeout(() => {
                try {
                    process.kill(-pid, 'SIGKILL')
                } catch {
                    /* already gone */
                }
            }, config.forceKillGraceMs)
        }
        return this.snapshot(repo)
    }

    // ── the run loop (§6.2) ─────────────────────────────────────────────────────

    private async runLoop(repo: string, opts: RunOptions): Promise<void> {
        const r = this.get(repo)
        // E1 — per-project settings provide the defaults the form/options didn't set
        const eff = effectiveSettings(repo)
        const commitAfter = opts.commitAfter ?? eff.commitAfter
        const commitMode = opts.commitMessageMode ?? eff.commitMessageMode
        const commitModel = opts.commitModel ?? eff.commitModel
        const warmEnabled = opts.warmSession ?? eff.warmSession
        const reviewEnabled = opts.review ?? eff.review

        let reason = 'completed'
        try {
            // Ensure legacy filesystem state is imported, then mirror the markdown
            // task files into the DB before reading/mutating their rows.
            await ensureImported()
            await reconcileTasks(repo)

            // §6.7 FORCE / reset
            if (opts.reset) {
                await clearCompleted(repo)
            } else if (opts.resetTasks?.length) {
                // Targeted re-run: drop only the named ids from the ledger and
                // reopen their headers, leaving the rest of the queue untouched.
                await removeCompleted(repo, opts.resetTasks)
                await Promise.all(
                    opts.resetTasks.map((rel) => updateTaskStatus(repo, rel, 'open').catch(() => {})),
                )
            }

            const discovered = await listTaskFiles(repo)
            const passes = await Promise.all(
                discovered.map((rel) => this.passesStaticFilters(repo, rel, opts)),
            )
            const scoped = discovered.filter((_, idx) => passes[idx])

            if (opts.reset) {
                await Promise.all(scoped.map((rel) => updateTaskStatus(repo, rel, 'open').catch(() => {})))
            }

            const completed = await readCompleted(repo)
            r.total = scoped.length
            r.done = scoped.filter((t) => completed.has(t)).length
            r.error = 0
            this.progress(repo)

            if (scoped.length === 0 || r.done === scoped.length) {
                reason = 'completed'
                return
            }

            // warm session bootstrap
            let warmSessionId: string | undefined
            if (warmEnabled) {
                const marker = await readWarmSession(repo)
                if (marker && Date.now() - marker.ts < config.warmSessionMaxAge * 1000) {
                    warmSessionId = marker.sessionId
                } else {
                    await clearWarmSession(repo)
                }
            }

            const preamble = (await readProjectPromptOverride(repo)) ?? DEFAULT_PREAMBLE

            let i = 0
            let limitRetries = 0
            let transientRetries = 0
            let executed = false
            // §account failover — when a usage-limit on the resolved account fails
            // over to another identity, `failoverAccount` pins the replacement for
            // the *next* attempt at `failoverFor` (the same task). Cleared once the
            // task advances or the engine sleeps, so canonical resolution resumes.
            let failoverAccount: string | null = null
            let failoverFor: string | null = null

            while (i < scoped.length) {
                if (r.forceRequested) {
                    reason = 'force-stopped'
                    return
                }
                // graceful stop takes effect at the task boundary
                if (r.stopRequested) {
                    reason = 'stopped'
                    return
                }
                const rel = scoped[i]
                if (completed.has(rel)) {
                    i++
                    continue
                }

                r.current = rel

                // §usage gate — after each executed task, before starting the next,
                // pause if usage is at/above the threshold (avoids limit failures).
                if (executed && config.usageGateEnabled) {
                    await this.usageGate(repo, rel, opts.model)
                    if (r.forceRequested) {
                        reason = 'force-stopped'
                        return
                    }
                    if (r.stopRequested) {
                        reason = 'stopped'
                        return
                    }
                }

                // §6.7 DRY_RUN — list the invocation, skip execution, don't touch
                // .status. Reads the file only to surface the per-task model override.
                if (opts.dryRun) {
                    let dryModel = opts.model
                    // §account precedence: task facet → project/global default
                    // (eff.defaultAccount already folds in config.defaultAccount).
                    let dryAccount = eff.defaultAccount || config.defaultAccount || undefined
                    try {
                        const dryParsed = parseTask(await readTaskFile(repo, rel), rel)
                        if (dryParsed.model && this.isKnownModel(dryParsed.model)) dryModel = dryParsed.model
                        if (dryParsed.account) dryAccount = dryParsed.account
                    } catch {
                        /* unreadable file — show the run model */
                    }
                    this.log(
                        repo,
                        'comment',
                        `[dry-run] ${rel} → ${config.agentBin} --model ${resolveModel(dryModel)}` +
                            `${dryAccount ? ` --account ${dryAccount}` : ''} (cwd=${projectPath(repo)})`,
                        rel,
                    )
                    i++
                    continue
                }

                const taskBody = await readTaskFile(repo, rel)
                const parsed = parseTask(taskBody, rel)

                // A4 — dependency gate: leave the task pending (with a logged
                // comment) until every **Depends:** target is done. An errored
                // or pending dependency skips it; the run-end summary reports it.
                if (parsed.depends?.length) {
                    const unmet = this.unmetDependencies(repo, rel, parsed.depends, completed)
                    if (unmet.length) {
                        this.log(
                            repo,
                            'comment',
                            `skipping ${rel} — unmet dependencies: ${unmet.join(', ')}`,
                            rel,
                        )
                        r.depSkippedThisRun.push(rel)
                        i++
                        continue
                    }
                }

                // §9 — a task may pin its own model; it overrides the run model
                // for this task only. Unknown values fall back with a logged note.
                let effectiveModel = opts.model
                if (parsed.model) {
                    if (this.isKnownModel(parsed.model)) {
                        effectiveModel = parsed.model
                    } else {
                        this.log(
                            repo,
                            'comment',
                            `unknown task model "${parsed.model}" — falling back to ${opts.model}`,
                            rel,
                        )
                    }
                }
                const modelOverride = resolveModel(effectiveModel) !== resolveModel(opts.model)

                // §account — pick this task's Claude identity (highest first): the
                // task's **Account:** facet → the project default → the global
                // default (eff.defaultAccount already folds in config.defaultAccount)
                // → none (inherit the ambient identity). An alias that cannot be
                // resolved (unknown / missing key env) errors the task rather than
                // silently falling back to the ambient identity.
                // A prior usage-limit on this same task may have failed over to a
                // different identity — honour that pin; otherwise drop any stale
                // failover and resolve canonically.
                let accountAlias = parsed.account || eff.defaultAccount || config.defaultAccount || undefined
                if (failoverAccount && failoverFor === rel) {
                    accountAlias = failoverAccount
                } else {
                    failoverAccount = null
                    failoverFor = null
                }
                let accountEnv: Record<string, string> | undefined
                if (accountAlias) {
                    try {
                        accountEnv = resolveAccount(accountAlias).env
                    } catch (err: any) {
                        await this.markError(
                            repo,
                            rel,
                            0,
                            effectiveModel,
                            `account "${accountAlias}" could not be resolved: ${err?.message ?? err}`,
                        )
                        i++
                        limitRetries = 0
                        transientRetries = 0
                        continue
                    }
                }

                this.setState(repo, 'RUNNING')
                this.emitEvent(repo, { type: 'task:begin', taskId: rel })
                await r.logger!.beginTask(rel)
                this.log(
                    repo,
                    'comment',
                    `▶ ${rel} → model ${resolveModel(effectiveModel)}` +
                        `${accountAlias ? `, account ${accountAlias}` : ''}`,
                    rel,
                )
                const startedAt = Date.now()
                executed = true

                // A warm session was created under the run model — never resume it
                // under a per-task override (and don't capture one from it either).
                const outcome = await this.runOne(
                    repo,
                    rel,
                    taskBody,
                    effectiveModel,
                    preamble,
                    modelOverride ? undefined : warmSessionId,
                    accountEnv,
                )
                const elapsed = (Date.now() - startedAt) / 1000
                r.logger!.endTask(rel, outcome.exit, elapsed)

                if (r.forceRequested) {
                    // task left pending; record telemetry as failed
                    await r.logger!.telemetry(
                        this.telem(rel, 'failed', elapsed, effectiveModel, {
                            error: outcome.stderr,
                            usage: outcome.usage,
                        }),
                    )
                    reason = 'force-stopped'
                    return
                }

                // §5.2 skip — classify BEFORE limit/transient: a SIGTERM'd CLI may
                // emit arbitrary stderr that would otherwise misclassify. The task is
                // marked errored ("skipped by user") and the loop continues.
                if (r.skipRequested) {
                    r.skipRequested = false
                    await this.markError(repo, rel, elapsed, effectiveModel, 'skipped by user', outcome.usage)
                    i++
                    limitRetries = 0
                    transientRetries = 0
                    continue
                }

                // §6.6 classify, order matters
                if (outcome.limit) {
                    const plan = computeLimitSleep(outcome.stderr + '\n' + outcome.resultText, Date.now())

                    // §account cool-down + failover — when this attempt ran under a
                    // resolved account, mark that account cooling down until the
                    // limit's wake/reset time (the plan already falls back to
                    // config.limitSleepFallback when no reset is parseable), then try
                    // to fail over to another eligible identity before sleeping the
                    // whole engine. Each failover removes one account from the LRU
                    // pool, so the chain is bounded by the account count.
                    if (accountAlias) {
                        const coolingUntil = new Date(plan.wakeAt).toISOString()
                        coolDownAccount(accountAlias, coolingUntil)
                        this.log(
                            repo,
                            'comment',
                            `account ${accountAlias} hit usage limit — cooling down until ${coolingUntil}`,
                            rel,
                        )
                        slog('info', 'engine', 'account cooling down', {
                            project: repo,
                            account: accountAlias,
                            coolingUntil,
                            task: rel,
                        })
                        dispatchProjectEvent(
                            repo,
                            'limit',
                            `account ${accountAlias} hit usage limit at ${rel} — cooling down until ${coolingUntil}`,
                            { task: rel, account: accountAlias, coolingUntil },
                        )

                        const next = pickAccount()
                        if (next) {
                            failoverAccount = next.alias
                            failoverFor = rel
                            this.log(
                                repo,
                                'comment',
                                `failing over to account ${next.alias} — retrying ${rel}`,
                                rel,
                            )
                            slog('info', 'engine', 'account failover', {
                                project: repo,
                                from: accountAlias,
                                to: next.alias,
                                task: rel,
                            })
                            // retry SAME task under the new identity, no engine sleep
                            continue
                        }
                        this.log(
                            repo,
                            'comment',
                            `no eligible account to fail over to — falling back to sleep`,
                            rel,
                        )
                    }

                    // No account, or no failover target: existing whole-engine sleep.
                    // Drop any stale failover pin so the post-sleep retry resolves the
                    // canonical account again.
                    failoverAccount = null
                    failoverFor = null
                    if (!config.limitAutoSleep || limitRetries >= config.limitMaxRetries) {
                        reason = 'usage-limit'
                        this.log(repo, 'error', 'usage limit reached — stopping run', rel)
                        return
                    }
                    limitRetries++
                    r.wakeAt = plan.wakeAt
                    this.setState(repo, 'SLEEPING')
                    this.emitEvent(repo, { type: 'limit', wakeAt: plan.wakeAt, taskId: rel })
                    this.log(
                        repo,
                        'comment',
                        `usage limit hit — sleeping until ${new Date(plan.wakeAt).toISOString()} (retry ${limitRetries}/${config.limitMaxRetries})`,
                        rel,
                    )
                    // D2 — "tell me when it sleeps" is the unattended-run need
                    dispatchProjectEvent(
                        repo,
                        'limit',
                        `usage limit hit at ${rel} — sleeping until ${new Date(plan.wakeAt).toISOString()}`,
                        { task: rel, wakeAt: plan.wakeAt },
                    )
                    await this.sleep(repo, plan.ms)
                    if (r.forceRequested) {
                        reason = 'force-stopped'
                        return
                    }
                    if (r.stopRequested) {
                        reason = 'stopped'
                        return
                    }
                    // retry SAME task
                    continue
                }

                if (outcome.exit !== 0 && outcome.exit !== null) {
                    if (isTransientError(outcome.stderr) && transientRetries < config.transientMaxRetries) {
                        transientRetries++
                        const delay = config.transientBaseDelay * Math.pow(2, transientRetries - 1) * 1000
                        this.emitEvent(repo, { type: 'transient', taskId: rel, attempt: transientRetries, delay })
                        this.log(
                            repo,
                            'comment',
                            `transient failure — retry ${transientRetries}/${config.transientMaxRetries} in ${delay / 1000}s`,
                            rel,
                        )
                        await this.sleep(repo, delay)
                        if (r.forceRequested) {
                            reason = 'force-stopped'
                            return
                        }
                        continue
                    }
                    await this.markError(
                        repo,
                        rel,
                        elapsed,
                        effectiveModel,
                        outcome.stderr || `exit ${outcome.exit}`,
                        outcome.usage,
                    )
                    i++
                    limitRetries = 0
                    transientRetries = 0
                    continue
                }

                if (outcome.isError) {
                    await this.markError(
                        repo,
                        rel,
                        elapsed,
                        effectiveModel,
                        outcome.resultText || 'is_error',
                        outcome.usage,
                    )
                    i++
                    limitRetries = 0
                    transientRetries = 0
                    continue
                }

                // ── success ──
                // capture warm session from the first solved task (never from a
                // task that ran under a per-task model override)
                if (warmEnabled && !modelOverride && !warmSessionId && outcome.sessionId) {
                    warmSessionId = outcome.sessionId
                    await writeWarmSession(repo, outcome.sessionId, Date.now())
                }

                await updateTaskStatus(repo, rel, 'done').catch(() => {})
                await appendCompleted(repo, rel)
                completed.add(rel)

                // The task's own diff, captured before knowledge/commit touch the
                // tree — feeds both the knowledge updater and the B8 reviewer.
                const taskDiff = await git.workingDiff(repo).catch(() => '')

                // §knowledge — keep the repo's docs in sync with the change before committing
                await this.maybeUpdateKnowledge(repo, rel, parsed.title, taskDiff)

                let commitSha: string | undefined
                if (commitAfter) {
                    commitSha = await this.commitTask(repo, rel, parsed.title, commitMode, commitModel)
                }

                // B8 — advisory reviewer pass (never blocks the queue)
                let review: { verdict: 'pass' | 'fail'; note: string } | null = null
                if (reviewEnabled && !r.forceRequested && !r.stopRequested) {
                    this.log(repo, 'comment', `reviewing ${rel}…`, rel)
                    review = await reviewTask(repo, rel, taskBody, taskDiff)
                    if (review) {
                        this.log(
                            repo,
                            review.verdict === 'pass' ? 'comment' : 'error',
                            `review ${review.verdict.toUpperCase()}: ${review.note}`,
                            rel,
                        )
                    } else {
                        this.log(repo, 'comment', `review produced no verdict — skipping`, rel)
                    }
                }

                await r.logger!.telemetry(
                    this.telem(rel, 'done', elapsed, effectiveModel, {
                        commit: commitSha,
                        usage: outcome.usage,
                        review: review ?? undefined,
                    }),
                )
                r.done++
                r.completedThisRun.push(rel)
                slog('info', 'engine', `task done: ${rel}`, {
                    project: repo,
                    elapsed,
                    commit: commitSha,
                    review: review?.verdict,
                    done: r.done,
                    total: r.total,
                })
                this.emitEvent(repo, { type: 'task:done', taskId: rel, commit: commitSha })
                this.progress(repo)
                this.emitEvent(repo, { type: 'git' })

                // E2 — close the loop on an imported GitHub issue (best-effort)
                if (parsed.source) {
                    void this.notifyIssueDone(repo, rel, parsed.source, commitSha)
                }

                i++
                limitRetries = 0
                transientRetries = 0
            }

            // A4 — a run that completes with unmet dependencies reports them
            if (r.depSkippedThisRun.length) {
                this.log(
                    repo,
                    'comment',
                    `${r.depSkippedThisRun.length} task(s) left pending with unmet dependencies: ${r.depSkippedThisRun.join(', ')}`,
                    null,
                )
            }

            reason = 'completed'
        } finally {
            await this.finalize(repo, reason, opts)
        }
    }

    private async finalize(repo: string, reason: string, opts: RunOptions): Promise<void> {
        const r = this.get(repo)
        r.child = null
        // Independent teardown of disjoint resources; a new run can't interleave
        // because state stays non-IDLE until below, so order doesn't matter.
        await Promise.all([
            clearWarmSession(repo).catch(() => {}),
            this.releaseLock(repo),
            r.logger?.close(),
        ])

        // B4 — auto-push: only a fully clean completed run with ≥1 commit-worthy
        // task qualifies; failures surface in the log, never throw.
        let pushed = false
        if (
            opts.pushAfter &&
            !opts.dryRun &&
            reason === 'completed' &&
            r.done > 0 &&
            r.error === 0 &&
            canPush()
        ) {
            try {
                await git.push(repo)
                pushed = true
                this.log(repo, 'comment', `pushed ${r.branch ?? 'branch'} to origin`, null)
                this.emitEvent(repo, { type: 'git' })
            } catch (err: any) {
                this.log(repo, 'error', `auto-push failed: ${err?.message ?? err}`, null)
            }
        }

        // B7 — auto-PR: needs a pushed per-run branch and a GitHub origin.
        if (pushed && opts.openPr && r.branch) {
            try {
                const url = await this.openRunPr(repo, r)
                if (url) {
                    this.log(repo, 'comment', `opened PR: ${url}`, null)
                    if (r.runId) runRepo.setPrUrl(r.runId, url)
                }
            } catch (err: any) {
                this.log(repo, 'error', `PR creation failed: ${err?.message ?? err}`, null)
            }
        }

        slog(r.error > 0 ? 'warn' : 'info', 'engine', `run finalized: ${reason}`, {
            project: repo,
            done: r.done,
            error: r.error,
            total: r.total,
            runId: r.runId,
        })

        // B1 — close the persistent run record + prune aged per-run log frames
        if (r.runId) {
            try {
                runRepo.finalize(r.runId, reason, r.done, r.error, r.total)
                runEventRepo.pruneOldLogs(RUN_LOG_KEEP_DAYS)
            } catch {
                /* best-effort */
            }
        }

        const runId = r.runId || (r.startedAt ?? 0)
        if (reason === 'completed') {
            this.emitEvent(repo, { type: 'completed', done: r.done, error: r.error, total: r.total, runId })
        } else {
            this.emitEvent(repo, { type: 'stopped', reason, runId })
        }
        r.state = 'IDLE'
        r.current = null
        r.wakeAt = null
        this.emitEvent(repo, { type: 'state', state: 'IDLE' })

        // optional Slack batch summary (§6.9)
        if (config.slackWebhookUrl && (r.completedThisRun.length || r.erroredThisRun.length)) {
            void notifyBatch(repo, r.completedThisRun, r.erroredThisRun).catch(() => {})
        }

        // D2 — event-level notifications (per-project matrix; fire-and-forget)
        if (!opts.dryRun) {
            const summary = `run ${reason}: ${r.done} done, ${r.error} error of ${r.total}`
            dispatchProjectEvent(repo, 'run:completed', summary, {
                reason,
                done: r.done,
                error: r.error,
                total: r.total,
                runId: r.runId,
            })
            if (r.error > 0 || (reason !== 'completed' && reason !== 'stopped')) {
                dispatchProjectEvent(repo, 'run:errored', summary, {
                    reason,
                    errored: r.erroredThisRun,
                    runId: r.runId,
                })
            }
        }
    }

    /** B7 — open a PR for the finished run's branch; returns its URL (or null). */
    private async openRunPr(repo: string, r: RepoRun): Promise<string | null> {
        const meta = projectRepo.getProject(repo)
        const gh = parseGithubRepo(meta?.gitUrl)
        if (!gh || !r.branch) return null
        const base = meta?.branch || (await defaultBranch(gh.owner, gh.repo))
        // PR body from the run's completed tasks (same extraction as Slack)
        const lines: string[] = [
            `Automated TaskForge run #${r.runId} — ${r.done} task(s) completed.`,
            '',
        ]
        for (const rel of r.completedThisRun) {
            try {
                const content = await readTaskFile(repo, rel)
                const { title } = parseTask(content, rel)
                const problem = content.match(/##\s*Problem\s*\n+\s*(.+)/i)?.[1]?.trim()
                lines.push(problem ? `- **${title}** — ${problem}` : `- **${title}**`)
            } catch {
                lines.push(`- ${rel}`)
            }
        }
        const title =
            r.completedThisRun.length === 1
                ? `taskforge: ${(r.completedThisRun[0].split('/').pop() || '').replace(/\.md$/i, '')}`
                : `taskforge: run #${r.runId} (${r.done} tasks)`
        return createPull(gh.owner, gh.repo, { title, head: r.branch, base, body: lines.join('\n') })
    }

    /** E2 — comment + close the GitHub issue an imported task came from. */
    private async notifyIssueDone(repo: string, rel: string, source: string, commit?: string): Promise<void> {
        const m = source.match(/github#(\d+)/i)
        if (!m) return
        const meta = projectRepo.getProject(repo)
        const gh = parseGithubRepo(meta?.gitUrl)
        if (!gh) return
        const number = Number(m[1])
        try {
            await commentIssue(
                gh.owner,
                gh.repo,
                number,
                `TaskForge completed task \`${rel}\`${commit ? ` in ${commit.slice(0, 10)}` : ''}.`,
            )
            await closeIssue(gh.owner, gh.repo, number)
            this.log(repo, 'comment', `closed github#${number}`, rel)
        } catch (err: any) {
            this.log(repo, 'comment', `github#${number} update skipped: ${err?.message ?? err}`, rel)
        }
    }

    /** A4 — dependencies of `rel` that are not yet done (ignores unknown targets). */
    private unmetDependencies(repo: string, rel: string, depends: string[], completed: Set<string>): string[] {
        const rows = taskRepo.listTasks(repo)
        const unmet: string[] = []
        for (const dep of depends) {
            const target = rows.find((t) => t.id !== rel && dependencyMatches(dep, t.id))
            if (!target) continue // unknown reference — warn-and-ignore per spec
            if (target.status === 'done' || completed.has(target.id)) continue
            unmet.push(dep)
        }
        return unmet
    }

    // ── single task execution ────────────────────────────────────────────────

    private async runOne(
        repo: string,
        rel: string,
        taskBody: string,
        model: string,
        preamble: string,
        warmSessionId: string | undefined,
        accountEnv: Record<string, string> | undefined,
    ): Promise<{
        exit: number | null
        isError: boolean
        limit: boolean
        stderr: string
        resultText: string
        sessionId?: string
        usage: AgentUsage | null
    }> {
        const r = this.get(repo)
        const prompt = `${preamble}\n\n# Task: ${rel}\n\n${taskBody}\n`
        const child = spawnAgent({
            cwd: projectPath(repo),
            model,
            prompt,
            resumeSessionId: warmSessionId,
            accountEnv,
        })
        r.child = child

        // The child runs under the resolved account env; its stderr/stdout could
        // echo the spawn env (CLAUDE_CONFIG_DIR / API key). Scrub those values out
        // of everything that lands in a run log, telemetry, or audit detail.
        const accountSecrets = accountEnv ? [accountEnv.ANTHROPIC_API_KEY, accountEnv.CLAUDE_CONFIG_DIR] : []
        const scrub = (s: string): string => (accountEnv ? scrubSecrets(s, accountSecrets) : s)

        let stderrBuf = ''
        let resultText = ''
        let isError = false
        let sessionId: string | undefined
        let usage: AgentUsage | null = null
        let exitCode: number | null = null

        const parser = createAgentStreamParser({
            onText: (text) => this.log(repo, 'output', text, rel),
            onToolUse: (name) => this.log(repo, 'comment', `⚙ ${name}`, rel),
            onRaw: (line) => this.log(repo, 'output', line, rel),
            onResult: (result) => {
                isError = result.isError
                resultText = result.text
                usage = result.usage
            },
            onSessionId: (id) => {
                sessionId = id
            },
        })

        await new Promise<void>((resolve) => {
            child.stdout?.on('data', (chunk: Buffer) => parser.feed(chunk.toString()))
            child.stderr?.on('data', (chunk: Buffer) => {
                const text = scrub(chunk.toString())
                stderrBuf += text
                this.log(repo, 'error', text, rel)
            })
            child.on('close', (code) => {
                // IMP-1 — child has exited; cancel any pending force/skip SIGKILL
                // timer so it can't later signal a reused pid.
                if (r.killTimer) {
                    clearTimeout(r.killTimer)
                    r.killTimer = null
                }
                parser.flush()
                exitCode = code
                resolve()
            })
            child.on('error', (err) => {
                if (r.killTimer) {
                    clearTimeout(r.killTimer)
                    r.killTimer = null
                }
                stderrBuf += `\n${scrub(err.message)}`
                resolve()
            })
        })

        r.child = null
        const exit = exitCode ?? child.exitCode
        return {
            exit,
            isError,
            limit: isLimitError(stderrBuf),
            stderr: stderrBuf,
            resultText: scrub(resultText),
            sessionId,
            usage,
        }
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /** A model the run can use: catalog member or a known alias. */
    private isKnownModel(model: string): boolean {
        return (
            config.modelCatalog.includes(model) || model === 'fast' || model === 'mid' || model === 'deep'
        )
    }

    private async passesStaticFilters(repo: string, rel: string, opts: RunOptions): Promise<boolean> {
        if (opts.onlyTasks?.length && !opts.onlyTasks.includes(rel)) return false
        if (opts.filter && !rel.includes(opts.filter)) return false
        if (opts.resumeFrom && rel.localeCompare(opts.resumeFrom) < 0) return false
        if (opts.severity || opts.project) {
            const parsed = parseTask(await readTaskFile(repo, rel), rel)
            if (opts.severity) {
                const want = opts.severity.split(',').flatMap((s) => {
                    const t = s.trim().toLowerCase()
                    return t ? [t] : []
                })
                if (want.length && (!parsed.severity || !want.includes(parsed.severity))) return false
            }
            if (opts.project) {
                const want = opts.project.split(',').flatMap((s) => {
                    const t = s.trim().toLowerCase()
                    return t ? [t] : []
                })
                if (want.length && (!parsed.project || !want.includes(parsed.project))) return false
            }
        }
        return true
    }

    private telem(
        task: string,
        status: TelemetryRecord['status'],
        elapsed: number,
        model: string,
        extra: {
            error?: string
            commit?: string
            usage?: AgentUsage | null
            review?: { verdict: 'pass' | 'fail'; note: string }
        } = {},
    ): TelemetryRecord {
        return {
            task,
            status,
            elapsed: Math.round(elapsed * 10) / 10,
            model: resolveModel(model),
            commit: extra.commit,
            timestamp: new Date().toISOString(),
            error: extra.error ? extra.error.slice(0, 500) : undefined,
            tokensIn: extra.usage?.tokensIn,
            tokensOut: extra.usage?.tokensOut,
            costUsd: extra.usage?.costUsd ?? undefined,
            review: extra.review?.verdict,
            reviewNote: extra.review?.note,
        }
    }

    private async markError(
        repo: string,
        rel: string,
        elapsed: number,
        model: string,
        error: string,
        usage: AgentUsage | null = null,
    ): Promise<void> {
        const r = this.get(repo)
        await updateTaskStatus(repo, rel, 'error', error).catch(() => {})
        await r.logger!.telemetry(this.telem(rel, 'error', elapsed, model, { error, usage }))
        r.error++
        r.erroredThisRun.push(rel)
        slog('error', 'engine', `task errored: ${rel}`, {
            project: repo,
            elapsed,
            model: resolveModel(model),
            error: error.slice(0, 300),
        })
        this.emitEvent(repo, { type: 'task:error', taskId: rel, error: error.slice(0, 200) })
        this.progress(repo)
        // D2 — per-event notification
        dispatchProjectEvent(repo, 'task:error', `task errored: ${rel} — ${error.slice(0, 150)}`, {
            task: rel,
        })
    }

    /**
     * After a task succeeds, update the repo's knowledge/ docs to reflect the
     * change (best-effort). Only runs when enabled (E1 per-project setting) and
     * a knowledge base already exists — initial generation is an explicit action
     * from the Knowledge page. Runs before the optional commit so doc edits land
     * in the same commit.
     */
    private async maybeUpdateKnowledge(repo: string, rel: string, title: string, diff: string): Promise<void> {
        if (!effectiveSettings(repo).knowledgeAutoUpdate) return
        try {
            if (!(await knowledgeExists(repo))) return
            this.log(repo, 'comment', `updating knowledge docs for ${rel}…`, rel)
            const res = await updateKnowledge(repo, rel, title, diff)
            if (res.timedOut) {
                this.log(repo, 'error', `knowledge update timed out for ${rel}`, rel)
            } else {
                this.emitEvent(repo, { type: 'knowledge' })
            }
        } catch (err: any) {
            this.log(repo, 'error', `knowledge update failed: ${err?.message ?? err}`, rel)
        }
    }

    private async commitTask(
        repo: string,
        rel: string,
        title: string,
        mode: 'taskname' | 'ai',
        commitModel: string,
    ): Promise<string | undefined> {
        try {
            await git.stageAll(repo)
            const diff = await git.stagedDiff(repo)
            if (!diff.trim()) return undefined // empty diff → skip commit

            const stem = (rel.split('/').pop() || rel).replace(/\.md$/i, '')
            const tasknameMsg = `${stem}: ${title}`
            let message = tasknameMsg

            if (mode === 'ai') {
                const ai = await aiCommitMessage(repo, diff, commitModel)
                message = ai || tasknameMsg
            }

            const sha = await git.commitAll(repo, message)
            if (sha) {
                this.emitEvent(repo, { type: 'commit', taskId: rel, sha, message: message.split('\n')[0] })
            }
            return sha ?? undefined
        } catch (err: any) {
            this.log(repo, 'error', `commit failed: ${err?.message ?? err}`, rel)
            return undefined
        }
    }

    /**
     * §Initiative 2 — pre-emptive usage gate. Runs `/usage` (local, no tokens);
     * while any bucket is at/above the threshold, pause in SLEEPING and re-check
     * after a poll interval. Fail-open: any error checking usage logs and returns
     * so a parser/CLI hiccup never wedges the queue. Honors stop/force (the shared
     * `sleep` resolves early; we re-check the flags each loop).
     */
    private async usageGate(repo: string, nextRel: string, runModel: string): Promise<void> {
        const r = this.get(repo)
        const threshold = effectiveSettings(repo).usageGateThreshold

        // Resolve the model the next task will actually run under (run model +
        // optional per-task override) so we only gate on buckets that constrain
        // it. Without this, a model-specific bucket at the threshold (e.g. the
        // Sonnet-only weekly limit) would pause an Opus/Haiku task that bucket
        // does not affect.
        let taskModel = runModel
        try {
            const parsed = parseTask(await readTaskFile(repo, nextRel), nextRel)
            if (parsed.model && this.isKnownModel(parsed.model)) taskModel = parsed.model
        } catch {
            /* unreadable file — gate on the run model */
        }
        const taskFamily = modelFamily(resolveModel(taskModel))

        for (;;) {
            if (r.stopRequested || r.forceRequested) return
            let peak: number
            try {
                const snap = await refreshUsage(Date.now())
                // Generic buckets (no model named) always apply; a model-specific
                // bucket applies only when the next task runs that model.
                peak = snap.entries.reduce((m, e) => {
                    const fam = modelFamily(e.label)
                    if (fam && fam !== taskFamily) return m
                    return Math.max(m, e.percent)
                }, 0)
            } catch (err: any) {
                this.log(repo, 'comment', `usage check skipped (${err?.message ?? err}) — continuing`, nextRel)
                return // fail-open
            }
            if (peak < threshold) return
            const pollMs = config.usageGatePollSeconds * 1000
            const wakeAt = Date.now() + pollMs
            r.wakeAt = wakeAt
            this.setState(repo, 'SLEEPING')
            this.emitEvent(repo, { type: 'limit', wakeAt, taskId: nextRel })
            this.log(
                repo,
                'comment',
                `usage ${peak}% ≥ ${threshold}% — pausing before ${nextRel}; next check ${new Date(wakeAt).toISOString()}`,
                nextRel,
            )
            slog('info', 'engine', 'usage gate pause', { project: repo, peak, threshold, wakeAt })
            await this.sleep(repo, pollMs)
            // loop: re-check stop/force + usage
        }
    }

    /** Interruptible sleep; resolves early on stop/force. */
    private sleep(repo: string, ms: number): Promise<void> {
        const r = this.get(repo)
        return new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
                r.sleepResolver = null
                resolve()
            }, ms)
            r.sleepResolver = () => {
                clearTimeout(timer)
                r.sleepResolver = null
                resolve()
            }
        })
    }
}

// ── singleton (survives Next dev hot-reload via globalThis cache) ────────────

declare global {
    var __taskforgeEngine: ExecutionManager | undefined
}

export const engine: ExecutionManager = globalThis.__taskforgeEngine ?? new ExecutionManager()
if (process.env.NODE_ENV !== 'production') {
    globalThis.__taskforgeEngine = engine
}
