'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast, type TerminalLine } from '@toolcase/react-components'
import type {
    CommitMessageMode,
    EngineState,
    GitCommit,
    GitOp,
    GitStatus,
    KnowledgeDoc,
    RunSnapshot,
    SseEvent,
    TaskInfo,
} from '@/server/domain/types'
import { useConfirm, usePrompt } from './ConfirmModal'

export interface ProjectConfig {
    modelCatalog: string[]
    defaultModel: string
    commitAfter: boolean
    commitMessageMode: CommitMessageMode
    commitModel: string
    warmSession: boolean
    canPush: boolean
}

const TERMINAL_MAX = 1500

interface ProjectContextValue {
    project: string
    config: ProjectConfig

    // live state
    tasks: TaskInfo[]
    knowledge: KnowledgeDoc[]
    snapshot: RunSnapshot
    git: GitStatus | null
    commits: { unpushed: GitCommit[]; recent: GitCommit[] }
    lines: TerminalLine[]
    wakeAt: number | null

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

    // task creator
    genPrompt: string
    setGenPrompt: (v: string) => void
    genModel: string
    setGenModel: (v: string) => void
    generating: boolean

    // knowledge base
    knowledgePrompt: string
    setKnowledgePrompt: (v: string) => void
    knowledgeModel: string
    setKnowledgeModel: (v: string) => void
    generatingKnowledge: boolean
    onAddKnowledge: () => Promise<void>
    onRemoveKnowledge: (id: string) => Promise<void>

    // terminal
    clearLines: () => void

    // actions
    onStart: () => Promise<void>
    onReRunTask: (id: string) => Promise<void>
    onStop: () => Promise<void>
    onForce: () => Promise<void>
    onNewBranch: () => Promise<void>
    onPush: () => Promise<void>
    onGitOp: (op: GitOp) => Promise<void>
    loadCommits: () => Promise<void>
    onResetToggle: (checked: boolean) => Promise<void>
    onGenerate: () => Promise<void>
    /** Move every errored task back to pending so the next run retries them. */
    onResetErrors: () => Promise<void>
    setTasks: React.Dispatch<React.SetStateAction<TaskInfo[]>>
    setKnowledge: React.Dispatch<React.SetStateAction<KnowledgeDoc[]>>
}

const Ctx = createContext<ProjectContextValue | null>(null)

export function useProject(): ProjectContextValue {
    const ctx = useContext(Ctx)
    if (!ctx) throw new Error('useProject must be used within <ProjectProvider>')
    return ctx
}

export function ProjectProvider({
    project,
    initialTasks,
    initialKnowledge,
    initialSnapshot,
    initialGit,
    config,
    children,
}: {
    project: string
    initialTasks: TaskInfo[]
    initialKnowledge: KnowledgeDoc[]
    initialSnapshot: RunSnapshot
    initialGit: GitStatus | null
    config: ProjectConfig
    children: React.ReactNode
}) {
    const confirm = useConfirm()
    const prompt = usePrompt()

    const [tasks, setTasks] = useState<TaskInfo[]>(initialTasks)
    const [knowledge, setKnowledge] = useState<KnowledgeDoc[]>(initialKnowledge)
    const [snapshot, setSnapshot] = useState<RunSnapshot>(initialSnapshot)
    const [git, setGit] = useState<GitStatus | null>(initialGit)
    const [commits, setCommits] = useState<{ unpushed: GitCommit[]; recent: GitCommit[] }>({
        unpushed: [],
        recent: [],
    })
    const [lines, setLines] = useState<TerminalLine[]>([])
    const [wakeAt, setWakeAt] = useState<number | null>(initialSnapshot.wakeAt)
    // Keys of toasts already fired, so a reconnect/ring-replay never re-toasts the
    // same commit / run-complete / run-stopped message.
    const toastedKeys = useRef<Set<string>>(new Set())

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
    const [filter, setFilter] = useState('')
    const [severity, setSeverity] = useState('')
    const [projectFilter, setProjectFilter] = useState('')
    const [resumeFrom, setResumeFrom] = useState('')
    const [reset, setReset] = useState(false)
    const [dryRun, setDryRun] = useState(false)

    // task creator
    const [genPrompt, setGenPrompt] = useState('')
    const [genModel, setGenModel] = useState(config.defaultModel)
    const [generating, setGenerating] = useState(false)

    // knowledge base
    const [knowledgePrompt, setKnowledgePrompt] = useState('')
    const [knowledgeModel, setKnowledgeModel] = useState(config.defaultModel)
    const [generatingKnowledge, setGeneratingKnowledge] = useState(false)

    const idle = snapshot.state === 'IDLE'
    const running = !idle

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

    const appendLine = useCallback((line: TerminalLine) => {
        setLines((prev) => {
            const next = prev.length >= TERMINAL_MAX ? prev.slice(prev.length - TERMINAL_MAX + 1) : prev
            return [...next, line]
        })
    }, [])

    const clearLines = useCallback(() => setLines([]), [])

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
                    fetch(`/api/projects/${project}/git`)
                        .then((r) => (r.ok ? r.json() : null))
                        .then((g) => g && setGit(g))
                        .catch(() => {})
                    break
                case 'knowledge':
                    void refreshKnowledge()
                    break
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
    }, [project, appendLine, refresh, refreshKnowledge])

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
                toast.error('A run is already in progress.')
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
        [project, model, warmSession, commitAfter, commitMode, commitModel, filter, resumeFrom, severity, projectFilter, reset, dryRun],
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
                filter: id,
                resumeFrom: undefined,
                severity: undefined,
                project: undefined,
                reset: false,
                dryRun: false,
                resetTasks: [id],
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
            toast.error((await res.json()).error ?? 'Branch failed')
        }
    }, [project, prompt])

    const onPush = useCallback(async () => {
        const res = await fetch(`/api/projects/${project}/git/push`, { method: 'POST' })
        if (res.ok) {
            setGit(await res.json())
            toast.success('Pushed to origin')
            void loadCommits()
        } else {
            toast.error((await res.json()).error ?? 'Push failed')
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
                const label = op === 'fetch' ? 'Fetched from remote' : op === 'pull' ? 'Pulled (fast-forward)' : 'Discarded local changes'
                toast.success(label)
                void loadCommits()
            } else {
                toast.error((await res.json()).error ?? `git ${op} failed`)
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

    const onGenerate = useCallback(async () => {
        if (!genPrompt.trim()) return
        setGenerating(true)
        try {
            const res = await fetch(`/api/projects/${project}/tasks/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: genPrompt, model: genModel }),
            })
            if (res.status === 409) {
                toast.error('Cannot generate while a run is in progress.')
                return
            }
            if (!res.ok) {
                toast.error('Task generation failed.')
                return
            }
            const data = await res.json()
            setTasks(data.tasks)
            setGenPrompt('')
            toast.success(`Created ${data.created.length} task(s)`)
        } finally {
            setGenerating(false)
        }
    }, [project, genPrompt, genModel])

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

    const onAddKnowledge = useCallback(async () => {
        if (!knowledgePrompt.trim()) return
        setGeneratingKnowledge(true)
        try {
            const res = await fetch(`/api/projects/${project}/knowledge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: knowledgePrompt, model: knowledgeModel }),
            })
            if (res.status === 409) {
                toast.error('Cannot add knowledge while a run is in progress.')
                return
            }
            if (!res.ok) {
                toast.error('Knowledge analysis failed.')
                return
            }
            const data = await res.json()
            setKnowledge(data.docs)
            setKnowledgePrompt('')
            toast.success(`Added ${data.created.length} knowledge doc(s)`)
        } finally {
            setGeneratingKnowledge(false)
        }
    }, [project, knowledgePrompt, knowledgeModel])

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
    const startDisabled = running || (dirty && !dryRun)
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
        const willRun = matches.filter((t) => reset || t.status !== 'done').length
        return { matchingCount: matches.length, willRunCount: willRun }
    }, [tasks, filter, resumeFrom, severity, projectFilter, reset])

    const value: ProjectContextValue = {
        project,
        config,
        tasks,
        knowledge,
        snapshot,
        git,
        commits,
        lines,
        wakeAt,
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
        genPrompt,
        setGenPrompt,
        genModel,
        setGenModel,
        generating,
        knowledgePrompt,
        setKnowledgePrompt,
        knowledgeModel,
        setKnowledgeModel,
        generatingKnowledge,
        onAddKnowledge,
        onRemoveKnowledge,
        clearLines,
        onStart,
        onReRunTask,
        onStop,
        onForce,
        onNewBranch,
        onPush,
        onGitOp,
        loadCommits,
        onResetToggle,
        onGenerate,
        onResetErrors,
        setTasks,
        setKnowledge,
    }

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
