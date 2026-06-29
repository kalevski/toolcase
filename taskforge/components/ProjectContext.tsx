'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/lib/toast'
import type { TerminalLine } from '@/lib/terminal'
import type {
    AgentKind,
    AgentPromptRecord,
    CommitMessageMode,
    EngineState,
    GitCommit,
    GitOp,
    GitStatus,
    KnowledgeDoc,
    NoteDoc,
    RunSnapshot,
    SseEvent,
    TaskInfo,
} from '@/server/domain/types'
import { useConfirm, usePrompt } from './ConfirmModal'

export interface AgentKindInfo {
    kind: AgentKind
    label: string
    custom: boolean
}

export interface ProjectConfig {
    modelCatalog: string[]
    defaultModel: string
    commitAfter: boolean
    commitMessageMode: CommitMessageMode
    commitModel: string
    warmSession: boolean
    canPush: boolean
    /** E1 — per-project effective defaults for the new run toggles. */
    pushAfter: boolean
    branchPerRun: boolean
    review: boolean
    openPr: boolean
    /** C4 — bundled + custom agent kinds (drives Agents page tabs). */
    agentKinds: AgentKindInfo[]
}

export const AGENT_LABELS: Record<string, string> = {
    'task-creator': 'Task creator',
    'knowledge-writer': 'Knowledge analyzer',
    'note-writer': 'Notes agent',
}

const TERMINAL_MAX = 1500
const AGENT_TERMINAL_MAX = 500
// Bound the dedupe set so a long-lived dashboard session can't grow it without
// limit. Replays are gated by the `replay` flag (not this set), so evicting old
// keys can never cause a replayed toast to re-fire.
const TOAST_KEY_MAX = 500

export interface AgentSessionState {
    status: 'idle' | 'running'
    startedAt: number | null
    model: string | null
}

export interface AgentDraft {
    prompt: string
    model: string
}

interface ProjectContextValue {
    project: string
    config: ProjectConfig

    // live state
    tasks: TaskInfo[]
    knowledge: KnowledgeDoc[]
    notes: NoteDoc[]
    snapshot: RunSnapshot
    git: GitStatus | null
    commits: { unpushed: GitCommit[]; recent: GitCommit[] }
    lines: TerminalLine[]
    wakeAt: number | null

    // one-shot agent sessions (§3)
    agentSessions: Record<AgentKind, AgentSessionState>
    agentLines: Record<AgentKind, TerminalLine[]>
    drafts: Record<AgentKind, AgentDraft>
    setDraft: (kind: AgentKind, patch: Partial<AgentDraft>) => void
    lastPrompts: Record<AgentKind, AgentPromptRecord | null>
    anyAgentRunning: boolean
    /** Executor or any agent session running — drives every disabled= gate. */
    busy: boolean
    onStartAgent: (kind: AgentKind, opts?: { targetNote?: string }) => Promise<boolean>
    /** Kill the running agent session (confirm included). */
    onStopAgent: (kind: AgentKind) => Promise<void>
    clearAgentLines: (kind: AgentKind) => void

    // derived
    idle: boolean
    running: boolean
    dirty: boolean
    progressPct: number
    startDisabled: boolean
    modelOptions: { value: string; label: string }[]
    /** How many tasks satisfy the current filter/severity/project/resume-from selection. */
    matchingCount: number
    /** Of the matching tasks, how many would actually execute on Start (excludes already-done unless reset). */
    willRunCount: number

    // run-config form (persists while navigating between project sub-pages)
    model: string
    setModel: (v: string) => void
    warmSession: boolean
    setWarmSession: (v: boolean) => void
    commitAfter: boolean
    setCommitAfter: (v: boolean) => void
    commitMode: CommitMessageMode
    setCommitMode: (v: CommitMessageMode) => void
    commitModel: string
    setCommitModel: (v: string) => void
    // B4/B5/B7/B8 — run toggles
    pushAfter: boolean
    setPushAfter: (v: boolean) => void
    branchPerRun: boolean
    setBranchPerRun: (v: boolean) => void
    review: boolean
    setReview: (v: boolean) => void
    openPr: boolean
    setOpenPr: (v: boolean) => void
    filter: string
    setFilter: (v: string) => void
    severity: string
    setSeverity: (v: string) => void
    /** Task **Project:** facet filter (CSV) — distinct from the workspace project. */
    projectFilter: string
    setProjectFilter: (v: string) => void
    /** Skip every task whose id sorts before this prefix (server `resumeFrom`). */
    resumeFrom: string
    setResumeFrom: (v: string) => void
    reset: boolean
    dryRun: boolean
    setDryRun: (v: boolean) => void

    // knowledge base
    onRemoveKnowledge: (id: string) => Promise<void>
    refreshKnowledge: () => Promise<void>

    // notes
    refreshNotes: () => Promise<void>
    setNotes: React.Dispatch<React.SetStateAction<NoteDoc[]>>

    // terminal
    clearLines: () => void

    // actions
    onStart: () => Promise<void>
    onReRunTask: (id: string) => Promise<void>
    /** A3 — start a run scoped to exactly these task ids (bulk re-run). */
    onRunTasks: (ids: string[]) => Promise<void>
    onStop: () => Promise<void>
    onForce: () => Promise<void>
    /** Kill only the in-flight task; the run continues with the next (confirm included). */
    onSkipCurrent: () => Promise<void>
    onNewBranch: () => Promise<void>
    onPush: () => Promise<void>
    onGitOp: (op: GitOp) => Promise<void>
    loadCommits: () => Promise<void>
    refreshGit: () => Promise<void>
    onResetToggle: (checked: boolean) => Promise<void>
    /** Move every errored task back to pending so the next run retries them. */
    onResetErrors: () => Promise<void>
    setTasks: React.Dispatch<React.SetStateAction<TaskInfo[]>>
    setKnowledge: React.Dispatch<React.SetStateAction<KnowledgeDoc[]>>
    refresh: () => Promise<void>
}

const Ctx = createContext<ProjectContextValue | null>(null)

export function useProject(): ProjectContextValue {
    const ctx = useContext(Ctx)
    if (!ctx) throw new Error('useProject must be used within <ProjectProvider>')
    return ctx
}

function agentRecord<T>(kinds: AgentKindInfo[], make: () => T): Record<AgentKind, T> {
    const out: Record<AgentKind, T> = {}
    for (const k of kinds) out[k.kind] = make()
    // bundled three are always present even if the kinds list is stale
    for (const k of ['task-creator', 'knowledge-writer', 'note-writer']) {
        if (!(k in out)) out[k] = make()
    }
    return out
}

export function ProjectProvider({
    project,
    initialTasks,
    initialKnowledge,
    initialNotes,
    initialSnapshot,
    initialGit,
    initialAgentPrompts,
    config,
    children,
}: {
    project: string
    initialTasks: TaskInfo[]
    initialKnowledge: KnowledgeDoc[]
    initialNotes: NoteDoc[]
    initialSnapshot: RunSnapshot
    initialGit: GitStatus | null
    initialAgentPrompts: Partial<Record<AgentKind, AgentPromptRecord>>
    config: ProjectConfig
    children: React.ReactNode
}) {
    const confirm = useConfirm()
    const prompt = usePrompt()

    const [tasks, setTasks] = useState<TaskInfo[]>(initialTasks)
    const [knowledge, setKnowledge] = useState<KnowledgeDoc[]>(initialKnowledge)
    const [notes, setNotes] = useState<NoteDoc[]>(initialNotes)
    const [snapshot, setSnapshot] = useState<RunSnapshot>(initialSnapshot)
    const [git, setGit] = useState<GitStatus | null>(initialGit)
    const [commits, setCommits] = useState<{ unpushed: GitCommit[]; recent: GitCommit[] }>({
        unpushed: [],
        recent: [],
    })
    const [lines, setLines] = useState<TerminalLine[]>([])
    const [wakeAt, setWakeAt] = useState<number | null>(initialSnapshot.wakeAt)
    // Keys of toasts already fired, so a reconnect/ring-replay never re-toasts the
    // same commit / run-complete / agent-done message.
    const toastedKeys = useRef<Set<string>>(new Set())
    // Latest agentKinds reachable from the (project-scoped) SSE handler without
    // being an effect dependency — a new config object identity from the parent
    // would otherwise tear down and reconnect the EventSource on every render.
    const agentKindsRef = useRef(config.agentKinds)
    agentKindsRef.current = config.agentKinds

    // run config
    const [model, setModelState] = useState(config.defaultModel)
    const setModel = useCallback(
        (v: string) => {
            setModelState(v)
            try {
                localStorage.setItem(`taskforge:model:${project}`, v)
            } catch {
                /* storage unavailable */
            }
        },
        [project],
    )
    const [warmSession, setWarmSession] = useState(config.warmSession)
    const [commitAfter, setCommitAfter] = useState(config.commitAfter)
    const [commitMode, setCommitMode] = useState<CommitMessageMode>(config.commitMessageMode)
    const [commitModel, setCommitModel] = useState(config.commitModel)
    const [pushAfter, setPushAfter] = useState(config.pushAfter)
    const [branchPerRun, setBranchPerRun] = useState(config.branchPerRun)
    const [review, setReview] = useState(config.review)
    const [openPr, setOpenPr] = useState(config.openPr)
    const [filter, setFilter] = useState('')
    const [severity, setSeverity] = useState('')
    const [projectFilter, setProjectFilter] = useState('')
    const [resumeFrom, setResumeFrom] = useState('')
    const [reset, setReset] = useState(false)
    const [dryRun, setDryRun] = useState(false)

    // one-shot agent sessions (§3): live status + per-agent terminal + drafts
    const [agentSessions, setAgentSessions] = useState<Record<AgentKind, AgentSessionState>>(() =>
        agentRecord(config.agentKinds, () => ({ status: 'idle' as const, startedAt: null, model: null })),
    )
    const [agentLines, setAgentLines] = useState<Record<AgentKind, TerminalLine[]>>(() =>
        agentRecord(config.agentKinds, () => []),
    )
    const [drafts, setDrafts] = useState<Record<AgentKind, AgentDraft>>(() =>
        agentRecord(config.agentKinds, () => ({ prompt: '', model: config.defaultModel })),
    )
    const [lastPrompts, setLastPrompts] = useState<Record<AgentKind, AgentPromptRecord | null>>(() => {
        const out = agentRecord<AgentPromptRecord | null>(config.agentKinds, () => null)
        for (const [kind, rec] of Object.entries(initialAgentPrompts)) {
            if (rec) out[kind] = rec
        }
        return out
    })

    const setDraft = useCallback((kind: AgentKind, patch: Partial<AgentDraft>) => {
        setDrafts((prev) => ({ ...prev, [kind]: { ...prev[kind], ...patch } }))
    }, [])

    const idle = snapshot.state === 'IDLE'
    const running = !idle
    const anyAgentRunning = Object.values(agentSessions).some((s) => s.status === 'running')
    const busy = running || anyAgentRunning

    // Restore the last-used model for this project. localStorage is client-only,
    // so this runs in an effect (SSR has no localStorage); persistence on change
    // is handled by setModel above, not a mirroring effect.
    useEffect(() => {
        const saved = localStorage.getItem(`taskforge:model:${project}`)
        if (saved && config.modelCatalog.includes(saved)) setModelState(saved)
    }, [project, config.modelCatalog])

    const refresh = useCallback(async () => {
        try {
            const [s, t, g] = await Promise.all([
                fetch(`/api/projects/${project}/status`).then((r) => r.json()),
                fetch(`/api/projects/${project}/tasks`).then((r) => r.json()),
                fetch(`/api/projects/${project}/git`).then((r) => (r.ok ? r.json() : null)),
            ])
            setSnapshot(s)
            setTasks(t)
            if (g) setGit(g)
        } catch {
            /* transient */
        }
    }, [project])

    const refreshKnowledge = useCallback(async () => {
        try {
            const docs = await fetch(`/api/projects/${project}/knowledge`).then((r) => (r.ok ? r.json() : null))
            if (docs) setKnowledge(docs)
        } catch {
            /* transient */
        }
    }, [project])

    const refreshNotes = useCallback(async () => {
        try {
            const docs = await fetch(`/api/projects/${project}/notes`).then((r) => (r.ok ? r.json() : null))
            if (docs) setNotes(docs)
        } catch {
            /* transient */
        }
    }, [project])

    const refreshGit = useCallback(async () => {
        try {
            const g = await fetch(`/api/projects/${project}/git`).then((r) => (r.ok ? r.json() : null))
            if (g) setGit(g)
        } catch {
            /* transient */
        }
    }, [project])

    const appendLine = useCallback((line: TerminalLine) => {
        setLines((prev) => {
            const next = prev.length >= TERMINAL_MAX ? prev.slice(prev.length - TERMINAL_MAX + 1) : prev
            return [...next, line]
        })
    }, [])

    const appendAgentLine = useCallback((kind: AgentKind, line: TerminalLine) => {
        setAgentLines((prev) => {
            const cur = prev[kind] ?? [] // custom kind may appear mid-session
            const trimmed = cur.length >= AGENT_TERMINAL_MAX ? cur.slice(cur.length - AGENT_TERMINAL_MAX + 1) : cur
            return { ...prev, [kind]: [...trimmed, line] }
        })
    }, [])

    const clearLines = useCallback(() => setLines([]), [])
    const clearAgentLines = useCallback((kind: AgentKind) => {
        setAgentLines((prev) => ({ ...prev, [kind]: [] }))
    }, [])

    const loadCommits = useCallback(async () => {
        try {
            const data = await fetch(`/api/projects/${project}/git/commits`).then((r) => (r.ok ? r.json() : null))
            if (data) setCommits(data)
        } catch {
            /* transient */
        }
    }, [project])

    // ── SSE subscription (persists across project sub-pages) ───────────────────
    useEffect(() => {
        const es = new EventSource(`/api/projects/${project}/stream`)
        es.onmessage = (ev) => {
            let event: SseEvent & { replay?: boolean }
            try {
                event = JSON.parse(ev.data)
            } catch {
                return
            }
            // Replayed frames (sent on every (re)connect) rebuild scrollback/state
            // but must never re-fire ephemeral toasts.
            const replayed = event.replay === true
            const toastOnce = (key: string, fn: () => void) => {
                if (replayed || toastedKeys.current.has(key)) return
                toastedKeys.current.add(key)
                if (toastedKeys.current.size > TOAST_KEY_MAX) {
                    // Set preserves insertion order — drop the oldest key.
                    const oldest = toastedKeys.current.values().next().value
                    if (oldest !== undefined) toastedKeys.current.delete(oldest)
                }
                fn()
            }
            switch (event.type) {
                case 'state':
                    setSnapshot((s) => ({ ...s, state: event.state as EngineState }))
                    break
                case 'progress':
                    setSnapshot((s) => ({ ...s, done: event.done, error: event.error, total: event.total }))
                    break
                case 'log':
                    appendLine({ kind: event.kind, text: event.text })
                    break
                case 'task:begin':
                    setSnapshot((s) => ({ ...s, current: event.taskId }))
                    break
                case 'task:done':
                case 'task:error':
                    void refresh()
                    break
                case 'commit':
                    appendLine({ kind: 'comment', text: `✔ committed ${event.sha.slice(0, 8)} — ${event.message}` })
                    toastOnce(`commit:${event.sha}`, () => toast.success(`Committed ${event.sha.slice(0, 8)}`))
                    break
                case 'limit':
                    setWakeAt(event.wakeAt)
                    break
                case 'git':
                    void refreshGit()
                    break
                case 'knowledge':
                    void refreshKnowledge()
                    break
                case 'notes':
                    void refreshNotes()
                    break
                case 'agent:state':
                    setAgentSessions((prev) => ({
                        ...prev,
                        [event.agent]: { status: event.status, startedAt: event.startedAt, model: event.model },
                    }))
                    break
                case 'agent:log':
                    appendAgentLine(event.agent, { kind: event.kind, text: event.text })
                    break
                case 'agent:done': {
                    const label =
                        AGENT_LABELS[event.agent] ??
                        agentKindsRef.current.find((k) => k.kind === event.agent)?.label ??
                        event.agent
                    toastOnce(`agent:done:${event.agent}:${event.startedAt ?? 'x'}`, () => {
                        if (event.stopped) toast.info(`${label} killed`)
                        else if (event.timedOut) toast.error(`${label} timed out`)
                        else if (!event.ok) toast.error(`${label} failed`)
                        else if (event.created.length > 0)
                            toast.success(`${label}: created ${event.created.length} file(s)`)
                        else toast.success(`${label} finished`)
                    })
                    if (event.agent === 'task-creator') void refresh()
                    else if (event.agent === 'knowledge-writer') void refreshKnowledge()
                    else if (event.agent === 'note-writer') void refreshNotes()
                    else {
                        // custom kind (C4) — its post hook may touch any corpus
                        void refresh()
                        void refreshKnowledge()
                        void refreshNotes()
                    }
                    break
                }
                case 'completed':
                    toastOnce(`completed:${event.runId}`, () =>
                        toast.success(`Run complete — ${event.done} done, ${event.error} error`),
                    )
                    setWakeAt(null)
                    void refresh()
                    break
                case 'stopped':
                    toastOnce(`stopped:${event.runId}`, () => toast.info(`Run stopped: ${event.reason}`))
                    setWakeAt(null)
                    void refresh()
                    break
            }
        }
        es.onerror = () => {
            /* browser auto-reconnects; ring buffer replays */
        }
        return () => es.close()
        // config.agentKinds is read via agentKindsRef (above) so it isn't a dep —
        // the connection is rebuilt only when the project (or a stable callback)
        // changes, never on a bare parent re-render.
    }, [project, appendLine, appendAgentLine, refresh, refreshKnowledge, refreshNotes, refreshGit])

    // Open-PR only applies when both branch-per-run and push-after are on (and
    // startRun gates it the same way). Disarm it when either toggles off, so
    // re-enabling them later doesn't silently re-arm PR creation the user can no
    // longer see the toggle for.
    useEffect(() => {
        if ((!branchPerRun || !pushAfter) && openPr) setOpenPr(false)
    }, [branchPerRun, pushAfter, openPr])

    // ── actions ────────────────────────────────────────────────────────────────

    // Shared run launcher: POSTs run-options, maps the well-known error codes to
    // toasts, and resets the terminal on success. `overrides` lets a targeted
    // re-run replace the filter/reset selection without touching the form state.
    const startRun = useCallback(
        async (overrides: Record<string, unknown> = {}) => {
            const res = await fetch(`/api/projects/${project}/run/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    warmSession,
                    commitAfter,
                    commitMessageMode: commitMode,
                    commitModel,
                    filter: filter || undefined,
                    resumeFrom: resumeFrom || undefined,
                    severity: severity || undefined,
                    project: projectFilter || undefined,
                    reset,
                    dryRun,
                    pushAfter,
                    branchPerRun,
                    review,
                    openPr: openPr && branchPerRun && pushAfter ? true : undefined,
                    ...overrides,
                }),
            })
            if (res.status === 412) {
                const data = await res.json()
                setGit((g) => (g ? { ...g, dirty: true, dirtyFiles: data.dirtyFiles ?? g.dirtyFiles } : g))
                toast.error('Working tree is dirty — clean it before starting.')
                return false
            }
            if (res.status === 409) {
                toast.error('A run or agent is already in progress.')
                return false
            }
            if (!res.ok) {
                toast.error('Failed to start run.')
                return false
            }
            setLines([])
            setSnapshot(await res.json())
            return true
        },
        [project, model, warmSession, commitAfter, commitMode, commitModel, filter, resumeFrom, severity, projectFilter, reset, dryRun, pushAfter, branchPerRun, review, openPr],
    )

    const onStart = useCallback(async () => {
        const ok = await startRun()
        if (ok && reset) setReset(false)
    }, [startRun, reset])

    const onReRunTask = useCallback(
        async (id: string) => {
            const ok = await confirm({
                title: 'Re-run this task?',
                body: `Reopen ${id} and run it again now. Other tasks in the queue are left as they are.`,
                confirmLabel: 'Re-run',
                confirmVariant: 'primary',
            })
            if (!ok) return
            // Scope the run to this one task and drop just it from the ledger.
            await startRun({
                filter: undefined,
                resumeFrom: undefined,
                severity: undefined,
                project: undefined,
                reset: false,
                dryRun: false,
                onlyTasks: [id],
                resetTasks: [id],
            })
        },
        [startRun, confirm],
    )

    // A3 — bulk re-run: scope the run to exactly the selected ids.
    const onRunTasks = useCallback(
        async (ids: string[]) => {
            if (!ids.length) return
            const ok = await confirm({
                title: `Re-run ${ids.length} task(s)?`,
                body: 'The selected tasks are reopened and run now; the rest of the queue is untouched.',
                confirmLabel: 'Re-run selected',
                confirmVariant: 'primary',
            })
            if (!ok) return
            await startRun({
                filter: undefined,
                resumeFrom: undefined,
                severity: undefined,
                project: undefined,
                reset: false,
                dryRun: false,
                onlyTasks: ids,
                resetTasks: ids,
            })
        },
        [startRun, confirm],
    )

    const onStop = useCallback(async () => {
        setSnapshot(await fetch(`/api/projects/${project}/run/stop`, { method: 'POST' }).then((r) => r.json()))
        toast.info('Will stop after the current task.')
    }, [project])

    const onForce = useCallback(async () => {
        const ok = await confirm({
            title: 'Force stop run?',
            body: 'The current task will be killed and left pending. Partial edits remain in the working tree.',
            confirmLabel: 'Force stop',
            confirmVariant: 'danger',
        })
        if (!ok) return
        setSnapshot(await fetch(`/api/projects/${project}/run/force`, { method: 'POST' }).then((r) => r.json()))
    }, [project, confirm])

    const onSkipCurrent = useCallback(async () => {
        const current = snapshot.current
        const ok = await confirm({
            title: 'Skip current task?',
            body: `Skip ${current ?? 'the current task'}? It will be marked as error; the run continues with the next task.`,
            confirmLabel: 'Skip task',
            confirmVariant: 'warning',
        })
        if (!ok) return
        const res = await fetch(`/api/projects/${project}/run/skip`, { method: 'POST' })
        if (res.ok) {
            setSnapshot(await res.json())
            toast.info('Skipping current task…')
        } else {
            toast.error((await res.json().catch(() => ({}))).error ?? 'Nothing to skip.')
        }
    }, [project, snapshot, confirm])

    // ── one-shot agents ────────────────────────────────────────────────────────

    const onStartAgent = useCallback(
        async (kind: AgentKind, opts: { targetNote?: string } = {}) => {
            const draft = drafts[kind]
            if (!draft.prompt.trim()) return false
            const res = await fetch(`/api/projects/${project}/agents/${kind}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: draft.prompt,
                    model: draft.model,
                    targetNote: opts.targetNote || undefined,
                }),
            })
            if (res.status === 409) {
                toast.error('Another run or agent is active for this project.')
                return false
            }
            if (!res.ok) {
                toast.error((await res.json().catch(() => ({}))).error ?? 'Failed to start agent.')
                return false
            }
            const snap = await res.json()
            // The SSE agent:state frame will land too, but reflect it immediately.
            setAgentSessions((prev) => ({
                ...prev,
                [kind]: { status: 'running', startedAt: snap.startedAt, model: snap.model },
            }))
            setAgentLines((prev) => ({ ...prev, [kind]: [] }))
            setLastPrompts((prev) => ({
                ...prev,
                [kind]: { prompt: draft.prompt, model: draft.model, usedAt: new Date().toISOString() },
            }))
            return true
        },
        [project, drafts],
    )

    const onStopAgent = useCallback(
        async (kind: AgentKind) => {
            // COR-1 — AGENT_LABELS only covers the bundled kinds; fall back to the
            // configured label (custom kinds) then the raw kind so the kill button
            // never throws on a custom agent panel (mirrors the agent:done handler).
            const label =
                AGENT_LABELS[kind] ?? config.agentKinds.find((k) => k.kind === kind)?.label ?? kind
            const ok = await confirm({
                title: `Kill the running ${label.toLowerCase()}?`,
                body: 'The agent process is terminated immediately. Partial files it already wrote stay on disk.',
                confirmLabel: 'Kill agent',
                confirmVariant: 'danger',
            })
            if (!ok) return
            await fetch(`/api/projects/${project}/agents/${kind}/stop`, { method: 'POST' }).catch(() => {})
        },
        [project, confirm, config.agentKinds],
    )

    const onNewBranch = useCallback(async () => {
        const name = await prompt({ title: 'New branch', label: 'Branch name', placeholder: 'feature/my-work' })
        if (!name) return
        const res = await fetch(`/api/projects/${project}/git/branch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        })
        if (res.ok) {
            setGit(await res.json())
            toast.success(`Switched to ${name}`)
        } else {
            toast.error((await res.json().catch(() => ({}))).error ?? 'Branch failed')
        }
    }, [project, prompt])

    const onPush = useCallback(async () => {
        const res = await fetch(`/api/projects/${project}/git/push`, { method: 'POST' })
        if (res.ok) {
            setGit(await res.json())
            toast.success('Pushed to origin')
            void loadCommits()
        } else {
            toast.error((await res.json().catch(() => ({}))).error ?? 'Push failed')
        }
    }, [project, loadCommits])

    const onGitOp = useCallback(
        async (op: GitOp) => {
            if (op === 'discard') {
                const ok = await confirm({
                    title: 'Discard all local changes?',
                    body: 'Hard-resets the working tree to HEAD and deletes untracked files. This cannot be undone.',
                    confirmLabel: 'Discard changes',
                    confirmVariant: 'danger',
                })
                if (!ok) return
            }
            const res = await fetch(`/api/projects/${project}/git/op`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ op }),
            })
            if (res.ok) {
                setGit(await res.json())
                const label =
                    op === 'fetch'
                        ? 'Fetched from remote'
                        : op === 'pull'
                          ? 'Pulled (fast-forward)'
                          : op === 'discard'
                            ? 'Discarded local changes'
                            : op === 'stash-push'
                              ? 'Stashed working tree'
                              : op === 'stash-pop'
                                ? 'Stash popped'
                                : 'Stash dropped'
                toast.success(label)
                void loadCommits()
            } else {
                toast.error((await res.json().catch(() => ({}))).error ?? `git ${op} failed`)
            }
        },
        [project, confirm, loadCommits],
    )

    const onResetToggle = useCallback(
        async (checked: boolean) => {
            if (checked) {
                const ok = await confirm({
                    title: 'Re-run all tasks?',
                    body: 'This clears the .status ledger and resets every task to "open" at the next Start, so all tasks reprocess.',
                    confirmLabel: 'Enable re-run',
                    confirmVariant: 'warning',
                })
                if (!ok) return
            }
            setReset(checked)
        },
        [confirm],
    )

    const onResetErrors = useCallback(async () => {
        const errored = tasks.filter((t) => t.status === 'error')
        if (errored.length === 0) {
            toast.info('No errored tasks to move.')
            return
        }
        const ok = await confirm({
            title: 'Move errored tasks to pending?',
            body: `Reset ${errored.length} errored task(s) to pending so the next run retries them. Their recorded errors are cleared.`,
            confirmLabel: 'Move to pending',
            confirmVariant: 'warning',
        })
        if (!ok) return
        const res = await fetch(`/api/projects/${project}/tasks/reset-errors`, { method: 'POST' })
        if (res.status === 409) {
            toast.error('Cannot move tasks while a run is in progress.')
            return
        }
        if (!res.ok) {
            toast.error('Failed to move errored tasks.')
            return
        }
        const data = await res.json()
        setTasks(data.tasks)
        toast.success(`Moved ${data.moved.length} task(s) to pending`)
    }, [project, tasks, confirm])

    const onRemoveKnowledge = useCallback(
        async (id: string) => {
            const ok = await confirm({
                title: 'Remove knowledge doc?',
                body: `Delete knowledge/${id}? The index will be updated to drop it.`,
                confirmLabel: 'Remove',
                confirmVariant: 'danger',
            })
            if (!ok) return
            const res = await fetch(`/api/projects/${project}/knowledge/${id}`, { method: 'DELETE' })
            if (res.status === 409) {
                toast.error('Cannot remove knowledge while a run is in progress.')
                return
            }
            if (!res.ok) {
                toast.error('Failed to remove knowledge doc.')
                return
            }
            const data = await res.json()
            setKnowledge(data.docs)
            toast.success('Removed knowledge doc')
        },
        [project, confirm],
    )

    // ── derived ──────────────────────────────────────────────────────────────
    const progressPct = snapshot.total > 0 ? Math.round((snapshot.done / snapshot.total) * 100) : 0
    const dirty = git?.dirty ?? false
    const startDisabled = busy || (dirty && !dryRun)
    const modelOptions = useMemo(() => config.modelCatalog.map((m) => ({ value: m, label: m })), [config.modelCatalog])

    // Mirror the engine's static filters (see passesStaticFilters) so the form can
    // show how many tasks the current selection picks up before a run is launched.
    const { matchingCount, willRunCount } = useMemo(() => {
        const csv = (s: string) =>
            s
                .split(',')
                .map((p) => p.trim().toLowerCase())
                .filter(Boolean)
        const sevWant = csv(severity)
        const projWant = csv(projectFilter)
        const matches = tasks.filter((t) => {
            if (filter && !t.id.includes(filter)) return false
            if (resumeFrom && t.id.localeCompare(resumeFrom) < 0) return false
            if (sevWant.length && (!t.severity || !sevWant.includes(t.severity.toLowerCase()))) return false
            if (projWant.length && (!t.project || !projWant.includes(t.project.toLowerCase()))) return false
            return true
        })
        // needs-review (B8) is ledger-done — it won't re-run without reset
        const willRun = matches.filter((t) => reset || (t.status !== 'done' && t.status !== 'needs-review')).length
        return { matchingCount: matches.length, willRunCount: willRun }
    }, [tasks, filter, resumeFrom, severity, projectFilter, reset])

    const value: ProjectContextValue = {
        project,
        config,
        tasks,
        knowledge,
        notes,
        snapshot,
        git,
        commits,
        lines,
        wakeAt,
        agentSessions,
        agentLines,
        drafts,
        setDraft,
        lastPrompts,
        anyAgentRunning,
        busy,
        onStartAgent,
        onStopAgent,
        clearAgentLines,
        idle,
        running,
        dirty,
        progressPct,
        startDisabled,
        modelOptions,
        matchingCount,
        willRunCount,
        model,
        setModel,
        warmSession,
        setWarmSession,
        commitAfter,
        setCommitAfter,
        commitMode,
        setCommitMode,
        commitModel,
        setCommitModel,
        pushAfter,
        setPushAfter,
        branchPerRun,
        setBranchPerRun,
        review,
        setReview,
        openPr,
        setOpenPr,
        filter,
        setFilter,
        severity,
        setSeverity,
        projectFilter,
        setProjectFilter,
        resumeFrom,
        setResumeFrom,
        reset,
        dryRun,
        setDryRun,
        onRemoveKnowledge,
        refreshKnowledge,
        refreshNotes,
        setNotes,
        clearLines,
        onStart,
        onReRunTask,
        onRunTasks,
        onStop,
        onForce,
        onSkipCurrent,
        onNewBranch,
        onPush,
        onGitOp,
        loadCommits,
        refreshGit,
        onResetToggle,
        onResetErrors,
        setTasks,
        setKnowledge,
        refresh,
    }

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
