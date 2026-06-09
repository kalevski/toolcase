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
import { spawnAgent, runAgentOnce, resolveModel } from '@/server/infrastructure/agent'
import {
    listTaskFiles,
    readCompleted,
    appendCompleted,
    clearCompleted,
    removeCompleted,
    updateTaskStatus,
    readTaskFile,
    parseTask,
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
import * as git from '@/server/infrastructure/git'
import { isClean, dirtyFiles } from '@/server/infrastructure/git'
import { RunLogger } from '@/server/infrastructure/logs'
import { slog } from '@/server/infrastructure/server-log'
import { isLimitError, isTransientError, computeLimitSleep } from '@/server/domain/limit'
import { notifyBatch } from '@/server/infrastructure/slack'
import { refreshUsage } from '@/server/services/usage'
import { ensureImported } from '@/server/services/migrate-fs'
import * as runEventRepo from '@/server/data/repositories/run-event-repo'
import type {
    EngineState,
    RunOptions,
    RunSnapshot,
    SseEvent,
    TerminalKind,
    TelemetryRecord,
} from '@/server/domain/types'

const RING_MAX = 1000

// Milestone events persisted to the durable run-event log (best-effort). Not the
// high-frequency `log` frames — those stay in the in-memory ring only.
const PERSIST_EVENTS = new Set<SseEvent['type']>([
    'task:begin',
    'task:done',
    'task:error',
    'commit',
    'limit',
    'completed',
    'stopped',
])

interface RepoRun {
    state: EngineState
    current: string | null
    done: number
    error: number
    total: number
    wakeAt: number | null
    model: string | null
    startedAt: number | null
    // control
    stopRequested: boolean
    forceRequested: boolean
    child: ChildProcess | null
    sleepResolver: (() => void) | null
    logger: RunLogger | null
    ring: SseEvent[]
    // batch-notify accumulators
    completedThisRun: string[]
    erroredThisRun: string[]
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
        stopRequested: false,
        forceRequested: false,
        child: null,
        sleepResolver: null,
        logger: null,
        ring: [],
        completedThisRun: [],
        erroredThisRun: [],
    }
}

export class LockHeldError extends Error {}
export class DirtyTreeError extends Error {
    constructor(public files: string[]) {
        super('Working tree is not clean')
    }
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
                runEventRepo.append(repo, event)
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
        const r = this.get(repo)
        if (r.state !== 'IDLE') throw new LockHeldError('A run is already in progress for this repo')
        await fs.mkdir(projectTasksDir(repo), { recursive: true })
        // A present .lock with no in-memory run is stale (process restart) → reclaim.
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

        // §6.14 clean-repo gate (only when actually executing, not for dry runs)
        if (!opts.dryRun) {
            const clean = await isClean(repo).catch(() => true)
            if (!clean) {
                throw new DirtyTreeError(await dirtyFiles(repo))
            }
        }

        await this.acquireLock(repo)

        // reset run state
        const run = freshRun()
        run.state = 'RUNNING'
        run.model = resolveModel(opts.model)
        run.startedAt = Date.now()
        run.logger = new RunLogger(repo)
        this.runs.set(repo, run)
        this.emitEvent(repo, { type: 'state', state: 'RUNNING' })
        slog('info', 'engine', `run started`, {
            project: repo,
            model: run.model,
            dryRun: !!opts.dryRun,
            reset: !!opts.reset,
            filter: opts.filter,
            resetTasks: opts.resetTasks,
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
            setTimeout(() => {
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

    // ── the run loop (§6.2) ─────────────────────────────────────────────────────

    private async runLoop(repo: string, opts: RunOptions): Promise<void> {
        const r = this.get(repo)
        const commitAfter = opts.commitAfter ?? config.commitAfterTask
        const commitMode = opts.commitMessageMode ?? config.commitMessageMode
        const commitModel = opts.commitModel ?? config.commitModel
        const warmEnabled = opts.warmSession ?? config.warmSession

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
                    await this.usageGate(repo, rel)
                    if (r.forceRequested) {
                        reason = 'force-stopped'
                        return
                    }
                    if (r.stopRequested) {
                        reason = 'stopped'
                        return
                    }
                }

                // §6.7 DRY_RUN — list the invocation, skip execution, don't touch .status.
                // Guard runs before the task-file read so dry runs skip the IO entirely.
                if (opts.dryRun) {
                    this.log(
                        repo,
                        'comment',
                        `[dry-run] ${rel} → ${config.agentBin} --model ${resolveModel(opts.model)} (cwd=${projectPath(repo)})`,
                        rel,
                    )
                    i++
                    continue
                }

                const taskBody = await readTaskFile(repo, rel)
                const parsed = parseTask(taskBody, rel)

                this.setState(repo, 'RUNNING')
                this.emitEvent(repo, { type: 'task:begin', taskId: rel })
                await r.logger!.beginTask(rel)
                const startedAt = Date.now()
                executed = true

                const outcome = await this.runOne(repo, rel, taskBody, opts.model, preamble, warmSessionId)
                const elapsed = (Date.now() - startedAt) / 1000
                r.logger!.endTask(rel, outcome.exit, elapsed)

                if (r.forceRequested) {
                    // task left pending; record telemetry as failed
                    await r.logger!.telemetry(this.telem(rel, 'failed', elapsed, opts.model, outcome.stderr))
                    reason = 'force-stopped'
                    return
                }

                // §6.6 classify, order matters
                if (outcome.limit) {
                    if (!config.limitAutoSleep || limitRetries >= config.limitMaxRetries) {
                        reason = 'usage-limit'
                        this.log(repo, 'error', 'usage limit reached — stopping run', rel)
                        return
                    }
                    limitRetries++
                    const plan = computeLimitSleep(outcome.stderr + '\n' + outcome.resultText, Date.now())
                    r.wakeAt = plan.wakeAt
                    this.setState(repo, 'SLEEPING')
                    this.emitEvent(repo, { type: 'limit', wakeAt: plan.wakeAt, taskId: rel })
                    this.log(
                        repo,
                        'comment',
                        `usage limit hit — sleeping until ${new Date(plan.wakeAt).toISOString()} (retry ${limitRetries}/${config.limitMaxRetries})`,
                        rel,
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
                    await this.markError(repo, rel, elapsed, opts.model, outcome.stderr || `exit ${outcome.exit}`)
                    i++
                    limitRetries = 0
                    transientRetries = 0
                    continue
                }

                if (outcome.isError) {
                    await this.markError(repo, rel, elapsed, opts.model, outcome.resultText || 'is_error')
                    i++
                    limitRetries = 0
                    transientRetries = 0
                    continue
                }

                // ── success ──
                // capture warm session from the first solved task
                if (warmEnabled && !warmSessionId && outcome.sessionId) {
                    warmSessionId = outcome.sessionId
                    await writeWarmSession(repo, outcome.sessionId, Date.now())
                }

                await updateTaskStatus(repo, rel, 'done').catch(() => {})
                await appendCompleted(repo, rel)
                completed.add(rel)

                // §knowledge — keep the repo's docs in sync with the change before committing
                await this.maybeUpdateKnowledge(repo, rel, parsed.title)

                let commitSha: string | undefined
                if (commitAfter) {
                    commitSha = await this.commitTask(repo, rel, parsed.title, commitMode, commitModel)
                }

                await r.logger!.telemetry(
                    this.telem(rel, 'done', elapsed, opts.model, undefined, commitSha),
                )
                r.done++
                r.completedThisRun.push(rel)
                slog('info', 'engine', `task done: ${rel}`, {
                    project: repo,
                    elapsed,
                    commit: commitSha,
                    done: r.done,
                    total: r.total,
                })
                this.emitEvent(repo, { type: 'task:done', taskId: rel, commit: commitSha })
                this.progress(repo)
                this.emitEvent(repo, { type: 'git' })

                i++
                limitRetries = 0
                transientRetries = 0
            }

            reason = 'completed'
        } finally {
            await this.finalize(repo, reason)
        }
    }

    private async finalize(repo: string, reason: string): Promise<void> {
        const r = this.get(repo)
        r.child = null
        // Independent teardown of disjoint resources; a new run can't interleave
        // because state stays non-IDLE until below, so order doesn't matter.
        await Promise.all([
            clearWarmSession(repo).catch(() => {}),
            this.releaseLock(repo),
            r.logger?.close(),
        ])

        slog(r.error > 0 ? 'warn' : 'info', 'engine', `run finalized: ${reason}`, {
            project: repo,
            done: r.done,
            error: r.error,
            total: r.total,
        })
        const runId = r.startedAt ?? 0
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
    }

    // ── single task execution ────────────────────────────────────────────────

    private async runOne(
        repo: string,
        rel: string,
        taskBody: string,
        model: string,
        preamble: string,
        warmSessionId: string | undefined,
    ): Promise<{
        exit: number | null
        isError: boolean
        limit: boolean
        stderr: string
        resultText: string
        sessionId?: string
    }> {
        const r = this.get(repo)
        const prompt = `${preamble}\n\n# Task: ${rel}\n\n${taskBody}\n`
        const child = spawnAgent({
            cwd: projectPath(repo),
            model,
            prompt,
            resumeSessionId: warmSessionId,
        })
        r.child = child

        let stderrBuf = ''
        let resultText = ''
        let isError = false
        let sessionId: string | undefined
        let stdoutRemainder = ''

        const handleStdoutLine = (line: string) => {
            const trimmed = line.trim()
            if (!trimmed) return
            let evt: any
            try {
                evt = JSON.parse(trimmed)
            } catch {
                this.log(repo, 'output', line, rel)
                return
            }
            if (evt.session_id && !sessionId) sessionId = evt.session_id
            switch (evt.type) {
                case 'system':
                    if (evt.subtype === 'init' && evt.session_id) sessionId = evt.session_id
                    break
                case 'assistant': {
                    const content = evt.message?.content ?? []
                    for (const block of content) {
                        if (block.type === 'text' && block.text) {
                            this.log(repo, 'output', block.text, rel)
                        } else if (block.type === 'tool_use') {
                            this.log(repo, 'comment', `⚙ ${block.name ?? 'tool'}`, rel)
                        }
                    }
                    break
                }
                case 'result':
                    isError = evt.is_error === true
                    if (typeof evt.result === 'string') resultText = evt.result
                    break
                default:
                    break
            }
        }

        await new Promise<void>((resolve) => {
            child.stdout?.on('data', (chunk: Buffer) => {
                const text = stdoutRemainder + chunk.toString()
                const lines = text.split('\n')
                stdoutRemainder = lines.pop() ?? ''
                for (const line of lines) handleStdoutLine(line)
            })
            child.stderr?.on('data', (chunk: Buffer) => {
                const text = chunk.toString()
                stderrBuf += text
                this.log(repo, 'error', text, rel)
            })
            child.on('close', (code) => {
                if (stdoutRemainder.trim()) handleStdoutLine(stdoutRemainder)
                ;(child as any)._exitCode = code
                resolve()
            })
            child.on('error', (err) => {
                stderrBuf += `\n${err.message}`
                resolve()
            })
        })

        r.child = null
        const exit = (child as any)._exitCode ?? child.exitCode
        return {
            exit,
            isError,
            limit: isLimitError(stderrBuf),
            stderr: stderrBuf,
            resultText,
            sessionId,
        }
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private async passesStaticFilters(repo: string, rel: string, opts: RunOptions): Promise<boolean> {
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
        error?: string,
        commit?: string,
    ): TelemetryRecord {
        return {
            task,
            status,
            elapsed: Math.round(elapsed * 10) / 10,
            model: resolveModel(model),
            commit,
            timestamp: new Date().toISOString(),
            error: error ? error.slice(0, 500) : undefined,
        }
    }

    private async markError(
        repo: string,
        rel: string,
        elapsed: number,
        model: string,
        error: string,
    ): Promise<void> {
        const r = this.get(repo)
        await updateTaskStatus(repo, rel, 'error', error).catch(() => {})
        await r.logger!.telemetry(this.telem(rel, 'error', elapsed, model, error))
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
    }

    /**
     * After a task succeeds, update the repo's knowledge/ docs to reflect the
     * change (best-effort). Only runs when enabled and a knowledge base already
     * exists — initial generation is an explicit action from the Knowledge page.
     * Runs before the optional commit so doc edits land in the same commit.
     */
    private async maybeUpdateKnowledge(repo: string, rel: string, title: string): Promise<void> {
        if (!config.knowledgeAutoUpdate) return
        try {
            if (!(await knowledgeExists(repo))) return
            this.log(repo, 'comment', `updating knowledge docs for ${rel}…`, rel)
            const diff = await git.workingDiff(repo)
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
                const ai = await this.aiCommitMessage(repo, diff, commitModel)
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

    private async aiCommitMessage(repo: string, diff: string, commitModel: string): Promise<string | null> {
        try {
            let skillBody = ''
            try {
                const raw = await fs.readFile(
                    path.join(config.appSkillsDir, 'commit-message', 'SKILL.md'),
                    'utf8',
                )
                skillBody = raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
            } catch {
                skillBody =
                    'Write a single Conventional Commits message (subject <= 72 chars, optional short body) describing the staged diff. Output ONLY the commit message.'
            }
            const truncated = diff.length > 12000 ? diff.slice(0, 12000) + '\n…(truncated)…' : diff
            const prompt = `${skillBody}\n\nStaged diff:\n\n\`\`\`diff\n${truncated}\n\`\`\`\n\nOutput ONLY the commit message text.`
            const res = await runAgentOnce({
                cwd: projectPath(repo),
                model: commitModel,
                prompt,
                timeoutMs: 60000,
                extraArgs: '--print --output-format=text --permission-mode plan',
            })
            const msg = res.stdout.trim()
            return msg && !res.timedOut ? msg : null
        } catch {
            return null
        }
    }

    /**
     * §Initiative 2 — pre-emptive usage gate. Runs `/usage` (local, no tokens);
     * while any bucket is at/above the threshold, pause in SLEEPING and re-check
     * after a poll interval. Fail-open: any error checking usage logs and returns
     * so a parser/CLI hiccup never wedges the queue. Honors stop/force (the shared
     * `sleep` resolves early; we re-check the flags each loop).
     */
    private async usageGate(repo: string, nextRel: string): Promise<void> {
        const r = this.get(repo)
        const threshold = config.usageGateThreshold
        for (;;) {
            if (r.stopRequested || r.forceRequested) return
            let peak: number
            try {
                const snap = await refreshUsage(Date.now())
                peak = snap.entries.reduce((m, e) => Math.max(m, e.percent), 0)
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
