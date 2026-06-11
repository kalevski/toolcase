// One-shot agent sessions (§3): task-creator / knowledge-writer / note-writer
// runs with live streaming output. Module-level singleton (globalThis-cached
// like the engine/db) that spawns the agent with `--output-format=stream-json`,
// parses NDJSON through the shared parser, keeps a per-(project, agent) ring
// buffer for SSE replay, and runs per-kind post-processing before flipping back
// to idle — so the mutual-exclusion gate covers the whole lifecycle.

import 'server-only'
import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { config } from '@/server/config'
import { spawnAgent, resolveModel } from '@/server/infrastructure/agent'
import { createAgentStreamParser } from '@/server/infrastructure/stream-json'
import {
    listTaskFiles,
    listKnowledgeFiles,
    listNoteFiles,
    reconcileTasks,
    reindexKnowledge,
    reindexNotes,
    projectPath,
} from '@/server/infrastructure/fs-workspace'
import { buildTaskCreatorPrompt } from '@/server/services/generate'
import { buildKnowledgeWriterPrompt, rebuildIndex } from '@/server/services/knowledge'
import { buildNoteWriterPrompt } from '@/server/services/notes'
import { engine } from '@/server/services/execution-manager'
import { registerAgentBusyCheck } from '@/server/services/locks'
import { dispatchProjectEvent } from '@/server/services/settings'
import * as agentPromptRepo from '@/server/data/repositories/agent-prompt-repo'
import * as promptHistoryRepo from '@/server/data/repositories/prompt-history-repo'
import * as agentDefRepo from '@/server/data/repositories/agent-def-repo'
import { slog } from '@/server/infrastructure/server-log'
import type { AgentDef, AgentKind, AgentSessionSnapshot, SseEvent, TerminalKind } from '@/server/domain/types'
import { AGENT_KINDS } from '@/server/domain/types'

const RING_MAX = 500

export class AgentBusyError extends Error {}
export class UnknownAgentError extends Error {}

export interface StartAgentOptions {
    /** note-writer only: edit this existing note instead of creating a new one. */
    targetNote?: string
}

interface Session {
    status: 'idle' | 'running'
    startedAt: number | null
    model: string | null
    prompt: string | null
    child: ChildProcess | null
    ring: SseEvent[]
    stopRequested: boolean
    timedOut: boolean
}

function freshSession(): Session {
    return {
        status: 'idle',
        startedAt: null,
        model: null,
        prompt: null,
        child: null,
        ring: [],
        stopRequested: false,
        timedOut: false,
    }
}

const TIMEOUTS: Record<string, () => number> = {
    'task-creator': () => config.generateTimeoutMs,
    'knowledge-writer': () => config.knowledgeTimeoutMs,
    'note-writer': () => config.knowledgeTimeoutMs,
}

const STREAM_ARGS = '--print --output-format=stream-json --verbose --permission-mode acceptEdits'

/** C4 — every agent kind available for a project: bundled three + agent_def rows. */
export function listAgentKinds(): { kind: AgentKind; label: string; custom: boolean; def?: AgentDef }[] {
    const bundled = [
        { kind: 'task-creator', label: 'Task creator', custom: false },
        { kind: 'knowledge-writer', label: 'Knowledge analyzer', custom: false },
        { kind: 'note-writer', label: 'Notes agent', custom: false },
    ]
    let defs: AgentDef[] = []
    try {
        defs = agentDefRepo.list()
    } catch {
        /* DB unavailable — bundled only */
    }
    return [...bundled, ...defs.map((d) => ({ kind: d.kind, label: d.label, custom: true, def: d }))]
}

/** C4 — assemble the prompt spec for a custom (agent_def) kind. */
function buildCustomPrompt(project: string, def: AgentDef, userPrompt: string): { cwd: string; prompt: string } {
    // The agent always runs at the project root (its sandbox); the target
    // directory contract is expressed in the prompt, not the cwd.
    const cwd = projectPath(project)
    const targetLine =
        def.target === 'project'
            ? 'You may work across the project directories (repo/, tasks/, knowledge/, notes/).'
            : `Write your output into the \`${def.target}/\` directory at the project root. Do not touch other directories.`
    const prompt = [def.promptPreamble.trim(), '', targetLine, '', '--- REQUEST ---', userPrompt].join('\n')
    return { cwd, prompt }
}

class AgentSessionManager extends EventEmitter {
    private sessions = new Map<string, Map<AgentKind, Session>>()

    private get(project: string, agent: AgentKind): Session {
        let perProject = this.sessions.get(project)
        if (!perProject) {
            perProject = new Map()
            this.sessions.set(project, perProject)
        }
        let s = perProject.get(agent)
        if (!s) {
            s = freshSession()
            perProject.set(agent, s)
        }
        return s
    }

    /** True when any agent session for the project is running. */
    isBusy(project: string): boolean {
        const perProject = this.sessions.get(project)
        if (!perProject) return false
        for (const s of perProject.values()) {
            if (s.status === 'running') return true
        }
        return false
    }

    /** The currently running agent kind for the project, if any. */
    runningKind(project: string): AgentKind | null {
        const perProject = this.sessions.get(project)
        if (!perProject) return null
        for (const [kind, s] of perProject.entries()) {
            if (s.status === 'running') return kind
        }
        return null
    }

    snapshot(project: string, agent: AgentKind): AgentSessionSnapshot {
        const s = this.get(project, agent)
        return {
            project,
            agent,
            status: s.status,
            startedAt: s.startedAt,
            model: s.model,
            prompt: s.prompt,
        }
    }

    snapshots(project: string): AgentSessionSnapshot[] {
        // Bundled kinds always; custom kinds when defined (C4). Sessions that ran
        // under a since-deleted kind still appear until the process restarts.
        const kinds = new Set<string>(AGENT_KINDS)
        for (const k of listAgentKinds()) kinds.add(k.kind)
        for (const k of this.sessions.get(project)?.keys() ?? []) kinds.add(k)
        return [...kinds].map((kind) => this.snapshot(project, kind))
    }

    /** Replay buffer for late SSE subscribers (agent:log frames). */
    ring(project: string, agent: AgentKind): SseEvent[] {
        return [...this.get(project, agent).ring]
    }

    // ── event emission (same shape the engine uses, so sse.ts is uniform) ────

    private emitEvent(project: string, event: SseEvent): void {
        if (event.type === 'agent:log') {
            const s = this.get(project, event.agent)
            s.ring.push(event)
            if (s.ring.length > RING_MAX) s.ring.splice(0, s.ring.length - RING_MAX)
        }
        this.emit('event', project, event)
    }

    private log(project: string, agent: AgentKind, kind: TerminalKind, text: string): void {
        for (const line of text.split('\n')) {
            if (line.length === 0) continue
            this.emitEvent(project, { type: 'agent:log', agent, kind, text: line })
        }
    }

    private emitState(project: string, agent: AgentKind): void {
        const s = this.get(project, agent)
        this.emitEvent(project, {
            type: 'agent:state',
            agent,
            status: s.status,
            startedAt: s.startedAt,
            model: s.model,
        })
    }

    // ── controls ──────────────────────────────────────────────────────────────

    /**
     * Start a session. Throws AgentBusyError when the executor or another agent
     * session holds the project. Returns immediately after the spawn; output
     * arrives via SSE and post-processing runs before the session flips idle.
     */
    async start(
        project: string,
        agent: AgentKind,
        prompt: string,
        model: string,
        opts: StartAgentOptions = {},
    ): Promise<AgentSessionSnapshot> {
        // C4 — bundled kinds are static; custom kinds resolve from agent_def.
        const customDef = (AGENT_KINDS as string[]).includes(agent) ? null : agentDefRepo.get(agent)
        if (!(AGENT_KINDS as string[]).includes(agent) && !customDef) {
            throw new UnknownAgentError(`unknown agent: ${agent}`)
        }
        // §mutual exclusion — one Claude process per project across
        // {executor, every agent kind}.
        if (engine.isLocked(project)) throw new AgentBusyError('A run is in progress for this project')
        if (this.isBusy(project)) throw new AgentBusyError('Another agent session is running for this project')

        // Claim the session SYNCHRONOUSLY (before any await) so two concurrent
        // start requests can't both pass the gates and double-spawn.
        const s = this.get(project, agent)
        s.status = 'running'
        s.startedAt = Date.now()
        s.model = resolveModel(model)
        s.prompt = prompt
        s.ring = []
        s.stopRequested = false
        s.timedOut = false

        let spec: { cwd: string; prompt: string }
        let before: Set<string>
        try {
            spec = customDef
                ? buildCustomPrompt(project, customDef, prompt)
                : agent === 'task-creator'
                  ? await buildTaskCreatorPrompt(project, prompt)
                  : agent === 'knowledge-writer'
                    ? await buildKnowledgeWriterPrompt(project, prompt)
                    : await buildNoteWriterPrompt(project, prompt, opts.targetNote)
            // Before-snapshot for the created-files diff (per kind).
            before = new Set(await this.listFiles(project, agent, customDef))
        } catch (err) {
            s.status = 'idle'
            this.emitState(project, agent)
            throw err
        }

        // Persist the prompt on accepted start so the composer's "last prompt"
        // strip always reflects the last real run (survives restarts). C1 also
        // appends to the full history (the UPSERT stays the fast "latest").
        try {
            agentPromptRepo.saveLatest(project, agent, prompt, model)
            promptHistoryRepo.append(project, agent, prompt, model)
        } catch {
            /* persistence is best-effort */
        }

        slog('info', 'agent-session', `${agent} started`, { project, model: s.model })
        this.emitState(project, agent)

        const child = spawnAgent({
            cwd: spec.cwd,
            model,
            prompt: spec.prompt,
            // --add-dir grants read/write across the whole project root regardless
            // of cwd, so every agent kind (incl. the tasks/-sandboxed task-creator)
            // can read repo/, knowledge/, notes/ and tasks/.
            extraArgs: `${STREAM_ARGS} --add-dir ${projectPath(project)}`,
        })
        s.child = child

        let resultIsError = false
        let exitCode: number | null = null

        const parser = createAgentStreamParser({
            onText: (text) => this.log(project, agent, 'output', text),
            onToolUse: (name) => this.log(project, agent, 'comment', `⚙ ${name}`),
            onRaw: (line) => this.log(project, agent, 'output', line),
            onResult: (result) => {
                resultIsError = result.isError
            },
            onSessionId: () => {},
        })

<<<<<<< HEAD
        // timeoutMs <= 0 means no timeout (a zero-delay timer would kill the
        // agent on the next tick).
=======
        // A non-positive timeout disables the watchdog entirely (run unbounded).
>>>>>>> origin/main
        const timeoutMs = (TIMEOUTS[agent] ?? (() => config.knowledgeTimeoutMs))()
        const timer =
            timeoutMs > 0
                ? setTimeout(() => {
                      s.timedOut = true
                      this.killGroup(child)
                  }, timeoutMs)
                : null

        void new Promise<void>((resolve) => {
            child.stdout?.on('data', (chunk: Buffer) => parser.feed(chunk.toString()))
            child.stderr?.on('data', (chunk: Buffer) => this.log(project, agent, 'error', chunk.toString()))
            child.on('close', (code) => {
                parser.flush()
                exitCode = code
                resolve()
            })
            child.on('error', (err) => {
                this.log(project, agent, 'error', err.message)
                resolve()
            })
        }).then(async () => {
            if (timer) clearTimeout(timer)
            s.child = null
            // Post-processing runs INSIDE the running window so the 409 gates
            // cover reconcile/index-rebuild too; only then flip idle + done.
            let created: string[] = []
            try {
                created = await this.postProcess(project, agent, before, customDef)
            } catch (err: any) {
                this.log(project, agent, 'error', `post-processing failed: ${err?.message ?? err}`)
            }
            const ok = !s.stopRequested && !s.timedOut && exitCode === 0 && !resultIsError
            const startedAt = s.startedAt
            s.status = 'idle'
            slog(ok ? 'info' : 'warn', 'agent-session', `${agent} finished`, {
                project,
                ok,
                created: created.length,
                timedOut: s.timedOut,
                stopped: s.stopRequested,
                exitCode,
            })
            this.emitState(project, agent)
            this.emitEvent(project, {
                type: 'agent:done',
                agent,
                ok,
                created,
                timedOut: s.timedOut,
                stopped: s.stopRequested || undefined,
                startedAt,
            })
            // D2 — per-event notification
            dispatchProjectEvent(
                project,
                'agent:done',
                `${agent} ${ok ? 'finished' : s.timedOut ? 'timed out' : 'failed'}${created.length ? ` — created ${created.length} file(s)` : ''}`,
                { agent, ok, created },
            )
        })

        return this.snapshot(project, agent)
    }

    /** SIGTERM the session's process group; SIGKILL after the grace period. */
    stop(project: string, agent: AgentKind): AgentSessionSnapshot {
        const s = this.get(project, agent)
        if (s.status === 'running') {
            s.stopRequested = true
            slog('info', 'agent-session', `${agent} stop requested`, { project, pid: s.child?.pid })
            if (s.child) this.killGroup(s.child)
        }
        return this.snapshot(project, agent)
    }

    private killGroup(child: ChildProcess): void {
        if (!child.pid) return
        const pid = child.pid
        try {
            process.kill(-pid, 'SIGTERM')
        } catch {
            child.kill('SIGTERM')
        }
        setTimeout(() => {
            try {
                process.kill(-pid, 'SIGKILL')
            } catch {
                /* already gone */
            }
        }, config.forceKillGraceMs)
    }

    // ── per-kind helpers ──────────────────────────────────────────────────────

    /** Which file list the created-files diff watches (custom kinds: by `post`). */
    private listFiles(project: string, agent: AgentKind, customDef: AgentDef | null = null): Promise<string[]> {
        const mode = customDef ? customDef.post : agent
        if (mode === 'task-creator' || mode === 'tasks') return listTaskFiles(project)
        if (mode === 'knowledge-writer' || mode === 'knowledge') return listKnowledgeFiles(project)
        if (mode === 'note-writer' || mode === 'notes') return listNoteFiles(project)
        return Promise.resolve([])
    }

    /** Diff created files + sync derived state; emits the matching refresh event. */
    private async postProcess(
        project: string,
        agent: AgentKind,
        before: Set<string>,
        customDef: AgentDef | null = null,
    ): Promise<string[]> {
        const mode = customDef ? customDef.post : agent
        if (mode === 'task-creator' || mode === 'tasks') {
            await reconcileTasks(project)
            const after = await listTaskFiles(project)
            return after.filter((f) => !before.has(f))
        }
        if (mode === 'knowledge-writer' || mode === 'knowledge') {
            await rebuildIndex(project)
            await reindexKnowledge(project)
            const after = await listKnowledgeFiles(project)
            const created = after.filter((f) => f.toLowerCase() !== 'index.md' && !before.has(f))
            this.emitEvent(project, { type: 'knowledge' })
            return created
        }
        if (mode === 'note-writer' || mode === 'notes') {
            await reindexNotes(project)
            const after = await listNoteFiles(project)
            const created = after.filter((f) => !before.has(f))
            this.emitEvent(project, { type: 'notes' })
            return created
        }
        return [] // custom kind with post = none
    }
}

// ── singleton (survives Next dev hot-reload via globalThis cache) ────────────

declare global {
    var __taskforgeAgentSessions: AgentSessionManager | undefined
}

export const agentSessions: AgentSessionManager =
    globalThis.__taskforgeAgentSessions ?? new AgentSessionManager()
if (process.env.NODE_ENV !== 'production') {
    globalThis.__taskforgeAgentSessions = agentSessions
}

// The engine reads this through the locks indirection (avoids a circular import).
registerAgentBusyCheck((project) => agentSessions.isBusy(project))
