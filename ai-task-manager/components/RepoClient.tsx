'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Heading,
    Breadcrumb,
    Badge,
    StatusDot,
    Button,
    IconButton,
    Select,
    Switch,
    RadioGroup,
    Input,
    ProgressBar,
    Banner,
    AnnouncementBar,
    TerminalWindow,
    Table,
    Tag,
    Textarea,
    Card,
    toast,
    type TableColumn,
    type TerminalLine,
} from '@toolcase/react-components'
import type {
    CommitMessageMode,
    EngineState,
    GitStatus,
    RunSnapshot,
    SseEvent,
    TaskInfo,
    TaskRuntimeStatus,
} from '@/server/types'
import { useConfirm, usePrompt } from './ConfirmModal'
import { TaskDrawer } from './TaskDrawer'

interface RepoConfig {
    modelCatalog: string[]
    defaultModel: string
    commitAfter: boolean
    commitMessageMode: CommitMessageMode
    commitModel: string
    warmSession: boolean
    canPush: boolean
}

const TERMINAL_MAX = 1500

const STATUS_BADGE: Record<TaskRuntimeStatus, 'secondary' | 'info' | 'success' | 'danger'> = {
    pending: 'secondary',
    running: 'info',
    done: 'success',
    error: 'danger',
}

export function RepoClient({
    repo,
    initialTasks,
    initialSnapshot,
    initialGit,
    config,
}: {
    repo: string
    initialTasks: TaskInfo[]
    initialSnapshot: RunSnapshot
    initialGit: GitStatus | null
    config: RepoConfig
}) {
    const router = useRouter()
    const confirm = useConfirm()
    const prompt = usePrompt()

    const [tasks, setTasks] = useState<TaskInfo[]>(initialTasks)
    const [snapshot, setSnapshot] = useState<RunSnapshot>(initialSnapshot)
    const [git, setGit] = useState<GitStatus | null>(initialGit)
    const [lines, setLines] = useState<TerminalLine[]>([])
    const [wakeAt, setWakeAt] = useState<number | null>(initialSnapshot.wakeAt)
    const [openTask, setOpenTask] = useState<string | null>(null)

    // run config
    const [model, setModel] = useState(config.defaultModel)
    const [warmSession, setWarmSession] = useState(config.warmSession)
    const [commitAfter, setCommitAfter] = useState(config.commitAfter)
    const [commitMode, setCommitMode] = useState<CommitMessageMode>(config.commitMessageMode)
    const [commitModel, setCommitModel] = useState(config.commitModel)
    const [filter, setFilter] = useState('')
    const [severity, setSeverity] = useState('')
    const [project, setProject] = useState('')
    const [reset, setReset] = useState(false)
    const [dryRun, setDryRun] = useState(false)

    // task creator
    const [genPrompt, setGenPrompt] = useState('')
    const [generating, setGenerating] = useState(false)

    const idle = snapshot.state === 'IDLE'
    const running = !idle

    // remember last-used model client-side
    useEffect(() => {
        const saved = localStorage.getItem(`taskforge:model:${repo}`)
        if (saved && config.modelCatalog.includes(saved)) setModel(saved)
    }, [repo, config.modelCatalog])
    useEffect(() => {
        localStorage.setItem(`taskforge:model:${repo}`, model)
    }, [repo, model])

    const refresh = useCallback(async () => {
        try {
            const [s, t, g] = await Promise.all([
                fetch(`/api/repos/${repo}/status`).then((r) => r.json()),
                fetch(`/api/repos/${repo}/tasks`).then((r) => r.json()),
                fetch(`/api/repos/${repo}/git`).then((r) => (r.ok ? r.json() : null)),
            ])
            setSnapshot(s)
            setTasks(t)
            if (g) setGit(g)
        } catch {
            /* transient */
        }
    }, [repo])

    const appendLine = useCallback((line: TerminalLine) => {
        setLines((prev) => {
            const next = prev.length >= TERMINAL_MAX ? prev.slice(prev.length - TERMINAL_MAX + 1) : prev
            return [...next, line]
        })
    }, [])

    // ── SSE subscription ──────────────────────────────────────────────────────
    useEffect(() => {
        const es = new EventSource(`/api/repos/${repo}/stream`)
        es.onmessage = (ev) => {
            let event: SseEvent
            try {
                event = JSON.parse(ev.data)
            } catch {
                return
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
                    toast.success(`Committed ${event.sha.slice(0, 8)}`)
                    break
                case 'limit':
                    setWakeAt(event.wakeAt)
                    break
                case 'git':
                    fetch(`/api/repos/${repo}/git`)
                        .then((r) => (r.ok ? r.json() : null))
                        .then((g) => g && setGit(g))
                        .catch(() => {})
                    break
                case 'completed':
                    toast.success(`Run complete — ${event.done} done, ${event.error} error`)
                    setWakeAt(null)
                    void refresh()
                    break
                case 'stopped':
                    toast.info(`Run stopped: ${event.reason}`)
                    setWakeAt(null)
                    void refresh()
                    break
            }
        }
        es.onerror = () => {
            /* browser auto-reconnects; ring buffer replays */
        }
        return () => es.close()
    }, [repo, appendLine, refresh])

    // ── actions ────────────────────────────────────────────────────────────────
    const onStart = async () => {
        const res = await fetch(`/api/repos/${repo}/run/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                warmSession,
                commitAfter,
                commitMessageMode: commitMode,
                commitModel,
                filter: filter || undefined,
                severity: severity || undefined,
                project: project || undefined,
                reset,
                dryRun,
            }),
        })
        if (res.status === 412) {
            const data = await res.json()
            setGit((g) => (g ? { ...g, dirty: true, dirtyFiles: data.dirtyFiles ?? g.dirtyFiles } : g))
            toast.error('Working tree is dirty — clean it before starting.')
            return
        }
        if (res.status === 409) {
            toast.error('A run is already in progress.')
            return
        }
        if (!res.ok) {
            toast.error('Failed to start run.')
            return
        }
        setLines([])
        setSnapshot(await res.json())
        if (reset) setReset(false)
    }

    const onStop = async () => {
        setSnapshot(await fetch(`/api/repos/${repo}/run/stop`, { method: 'POST' }).then((r) => r.json()))
        toast.info('Will stop after the current task.')
    }

    const onForce = async () => {
        const ok = await confirm({
            title: 'Force stop run?',
            body: 'The current task will be killed and left pending. Partial edits remain in the working tree.',
            confirmLabel: 'Force stop',
            confirmVariant: 'danger',
        })
        if (!ok) return
        setSnapshot(await fetch(`/api/repos/${repo}/run/force`, { method: 'POST' }).then((r) => r.json()))
    }

    const onNewBranch = async () => {
        const name = await prompt({ title: 'New branch', label: 'Branch name', placeholder: 'feature/my-work' })
        if (!name) return
        const res = await fetch(`/api/repos/${repo}/git/branch`, {
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
    }

    const onPush = async () => {
        const res = await fetch(`/api/repos/${repo}/git/push`, { method: 'POST' })
        if (res.ok) {
            setGit(await res.json())
            toast.success('Pushed to origin')
        } else {
            toast.error((await res.json()).error ?? 'Push failed')
        }
    }

    const onResetToggle = async (checked: boolean) => {
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
    }

    const onGenerate = async () => {
        if (!genPrompt.trim()) return
        setGenerating(true)
        try {
            const res = await fetch(`/api/repos/${repo}/tasks/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: genPrompt }),
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
    }

    // ── derived ──────────────────────────────────────────────────────────────
    const progressPct = snapshot.total > 0 ? Math.round((snapshot.done / snapshot.total) * 100) : 0
    const dirty = git?.dirty ?? false
    const startDisabled = running || (dirty && !dryRun)

    const modelOptions = config.modelCatalog.map((m) => ({ value: m, label: m }))

    const columns: TableColumn<TaskInfo>[] = [
        { key: 'id', header: '#', width: '30%', render: (t) => <code>{t.id}</code> },
        { key: 'title', header: 'Title', render: (t) => t.title },
        {
            key: 'facets',
            header: 'Facets',
            render: (t) => (
                <span style={{ display: 'inline-flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {t.severity && <Tag variant="warning">{t.severity}</Tag>}
                    {t.project && <Tag variant="info">{t.project}</Tag>}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (t) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <StatusDot
                        status={
                            t.status === 'done'
                                ? 'online'
                                : t.status === 'running'
                                  ? 'busy'
                                  : t.status === 'error'
                                    ? 'offline'
                                    : 'away'
                        }
                        pulse={t.status === 'running'}
                    />
                    <Badge variant={STATUS_BADGE[t.status]}>{t.status}</Badge>
                </span>
            ),
        },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Breadcrumb
                items={[
                    { label: 'Repositories', onClick: () => router.push('/') },
                    { label: repo },
                ]}
            />
            <Heading as="h1">{repo}</Heading>

            {/* Git bar */}
            <Card>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                        padding: '0.75rem',
                    }}
                >
                    <Badge variant="secondary">⎇ {git?.branch ?? '—'}</Badge>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <StatusDot status={dirty ? 'busy' : 'online'} />
                        {dirty ? 'dirty' : 'clean'}
                    </span>
                    {git && (git.ahead > 0 || git.behind > 0) && (
                        <Badge variant="info">
                            ↑{git.ahead} ↓{git.behind}
                        </Badge>
                    )}
                    <div style={{ flex: 1 }} />
                    <Button variant="secondary" outline disabled={running} onClick={onNewBranch} startIcon={<span>＋</span>}>
                        New branch
                    </Button>
                    <Button
                        variant="primary"
                        outline
                        disabled={running || !config.canPush}
                        title={config.canPush ? '' : 'Configure GIT_REMOTE_TOKEN or an SSH key to enable push.'}
                        onClick={onPush}
                    >
                        Push
                    </Button>
                </div>
            </Card>

            {dirty && (
                <Banner variant="warning" icon="exclamation-triangle">
                    <strong>Working tree is dirty.</strong> Start is blocked until it is clean. Uncommitted:
                    <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
                        {git!.dirtyFiles.slice(0, 20).map((f) => (
                            <li key={f}>
                                <code>{f}</code>
                            </li>
                        ))}
                    </ul>
                </Banner>
            )}

            {snapshot.state === 'SLEEPING' && wakeAt && (
                <AnnouncementBar
                    variant="warning"
                    iconName="moon"
                    message={`Usage limit hit — sleeping until ~${new Date(wakeAt).toLocaleTimeString()}, will resume the current task.`}
                />
            )}

            {/* Run config */}
            <Card>
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <Heading as="h3">Run configuration</Heading>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ minWidth: 200 }}>
                            <Select
                                label="Model"
                                options={modelOptions}
                                value={model}
                                disabled={running}
                                onChange={(e) => setModel(e.target.value)}
                            />
                        </div>
                        <Switch
                            label="Warm session"
                            checked={warmSession}
                            disabled={running}
                            onChange={(e) => setWarmSession(e.target.checked)}
                        />
                        <Switch
                            label="Commit after each task"
                            checked={commitAfter}
                            disabled={running}
                            onChange={(e) => setCommitAfter(e.target.checked)}
                        />
                        {commitAfter && (
                            <>
                                <RadioGroup
                                    label="Commit message"
                                    inline
                                    value={commitMode}
                                    options={[
                                        { value: 'taskname', label: 'Task name' },
                                        { value: 'ai', label: 'AI-generated' },
                                    ]}
                                    onChange={(v) => setCommitMode(v as CommitMessageMode)}
                                />
                                {commitMode === 'ai' && (
                                    <div style={{ minWidth: 180 }}>
                                        <Select
                                            label="Commit model"
                                            options={modelOptions}
                                            value={commitModel}
                                            disabled={running}
                                            onChange={(e) => setCommitModel(e.target.value)}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <Input
                            label="Task filter"
                            placeholder="substring of path"
                            value={filter}
                            disabled={running}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                        <Input
                            label="Severity (CSV)"
                            placeholder="high,critical"
                            value={severity}
                            disabled={running}
                            onChange={(e) => setSeverity(e.target.value)}
                        />
                        <Input
                            label="Project (CSV)"
                            placeholder="api,web"
                            value={project}
                            disabled={running}
                            onChange={(e) => setProject(e.target.value)}
                        />
                        <Switch
                            label="Re-run all (reset)"
                            checked={reset}
                            disabled={running}
                            onChange={(e) => onResetToggle(e.target.checked)}
                        />
                        <Switch
                            label="Preview (dry run)"
                            checked={dryRun}
                            disabled={running}
                            onChange={(e) => setDryRun(e.target.checked)}
                        />
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <Button variant="success" onClick={onStart} disabled={startDisabled} startIcon={<span>▶</span>}>
                            Start
                        </Button>
                        {running && (
                            <>
                                <IconButton
                                    icon="pause"
                                    label="Stop after current"
                                    variant="warning"
                                    outline
                                    disabled={snapshot.state === 'STOPPING'}
                                    onClick={onStop}
                                />
                                <IconButton icon="stop-fill" label="Force stop" variant="danger" onClick={onForce} />
                            </>
                        )}
                        <div style={{ flex: 1 }}>
                            <ProgressBar
                                value={progressPct}
                                variant={snapshot.error > 0 ? 'warning' : 'success'}
                                label={`${snapshot.done} / ${snapshot.total} done${snapshot.error ? ` · ${snapshot.error} error` : ''}`}
                            />
                        </div>
                        <Badge variant={running ? 'info' : 'secondary'}>{snapshot.state}</Badge>
                    </div>
                </div>
            </Card>

            {/* Task queue */}
            <Card header={<Heading as="h3">Task queue</Heading>}>
                <Table
                    columns={columns}
                    data={tasks}
                    rowKey={(t) => t.id}
                    hoverable
                    emptyMessage="No tasks yet — use the task creator below."
                    onRowClick={(t) => setOpenTask(t.id)}
                />
            </Card>

            {/* Live terminal */}
            <TerminalWindow title={`run — ${repo}`} lines={lines} />

            {/* Task creator */}
            <Card header={<Heading as="h3">Task creator</Heading>}>
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <Textarea
                        label="Describe the work — Claude will split it into numbered task files."
                        rows={4}
                        placeholder="e.g. Add health checks and structured logging across the API service."
                        value={genPrompt}
                        disabled={generating || running}
                        onChange={(e) => setGenPrompt(e.target.value)}
                    />
                    <div>
                        <Button
                            variant="primary"
                            loading={generating}
                            disabled={running || !genPrompt.trim()}
                            onClick={onGenerate}
                        >
                            Generate tasks
                        </Button>
                    </div>
                </div>
            </Card>

            <TaskDrawer repo={repo} taskId={openTask} onClose={() => setOpenTask(null)} />
        </div>
    )
}
