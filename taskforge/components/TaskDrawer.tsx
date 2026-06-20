'use client'

import React, { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { useTc, useTcEvents, detailValue } from '@/lib/tc'
import type { TaskInfo, TaskRuntimeStatus } from '@/server/domain/types'
import { useProject } from './ProjectContext'
import { useFeedbackModal } from './FeedbackModal'
import { helpTexts } from './helpTexts'

const STATUS_BADGE: Record<TaskRuntimeStatus, 'secondary' | 'info' | 'success' | 'danger' | 'warning'> = {
    pending: 'secondary',
    running: 'info',
    done: 'success',
    error: 'danger',
    'needs-review': 'warning',
}

const MODEL_ALIASES = ['fast', 'mid', 'deep']

export function TaskDrawer({
    project,
    taskId,
    task,
    running,
    onReRun,
    onClose,
    onTasksChanged,
}: {
    project: string
    taskId: string | null
    task?: TaskInfo
    running?: boolean
    onReRun?: (id: string) => void | Promise<void>
    onClose: () => void
    onTasksChanged?: (tasks: TaskInfo[]) => void
}) {
    const { modelOptions, refresh } = useProject()
    const openFeedback = useFeedbackModal()
    // Result is stamped with the task it belongs to, so `content` derives its own
    // staleness: when `taskId` changes, content falls back to null (and an in-flight
    // response can never render under the wrong task) — no prop-change reset effect.
    const [result, setResult] = useState<{ id: string; content: string } | null>(null)
    const [savingModel, setSavingModel] = useState(false)
    // A1 — edit mode state, stamped like `result`
    const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null)
    const [saving, setSaving] = useState(false)
    const content = result?.id === taskId ? result.content : null
    const loading = taskId !== null && content === null
    const editDraft = editing?.id === taskId ? editing.draft : null

    const drawerRef = useTc<HTMLElement>({ open: taskId !== null }, { 'tc-close': () => onClose() })
    const modelRef = useTcEvents<HTMLElement>({ change: (e) => void onModelPick((e.target as HTMLSelectElement).value) })
    const editorRef = useTcEvents<HTMLElement>({
        'tc-change': (e) => taskId && setEditing({ id: taskId, draft: detailValue<string>(e) }),
    })

    useEffect(() => {
        if (!taskId) return
        let cancelled = false
        fetch(`/api/projects/${project}/tasks/${taskId}`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((d) => {
                if (!cancelled) setResult({ id: taskId, content: d.content })
            })
            .catch(() => {
                if (!cancelled) setResult({ id: taskId, content: 'Failed to load task.' })
            })
        return () => {
            cancelled = true
        }
    }, [project, taskId])

    // §9 — per-task model pin. Options: run default + aliases + catalog.
    const pinOptions = [
        { value: '', label: 'Run default' },
        ...MODEL_ALIASES.filter((a) => !modelOptions.some((o) => o.value === a)).map((a) => ({ value: a, label: a })),
        ...modelOptions,
    ]

    async function onModelPick(value: string) {
        if (!taskId) return
        setSavingModel(true)
        try {
            const res = await fetch(`/api/projects/${project}/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: value || null }),
            })
            if (res.status === 409) {
                toast.error('Task is currently running.')
                return
            }
            if (!res.ok) {
                toast.error((await res.json().catch(() => ({}))).error ?? 'Failed to set model')
                return
            }
            toast.success(value ? `Model pinned: ${value}` : 'Model cleared — run default applies')
            // refresh the file body shown in the drawer + the queue's facet tags
            void fetch(`/api/projects/${project}/tasks/${taskId}`)
                .then((r) => (r.ok ? r.json() : Promise.reject()))
                .then((d) => setResult({ id: taskId, content: d.content }))
                .catch(() => {})
            void refresh()
        } finally {
            setSavingModel(false)
        }
    }

    // A1 — save the edited body (the server re-owns the Status/Error headers)
    const onSaveEdit = async () => {
        if (!taskId || editDraft === null) return
        setSaving(true)
        try {
            const res = await fetch(`/api/projects/${project}/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editDraft }),
            })
            if (res.status === 409) {
                toast.error('Task is currently running.')
                return
            }
            if (!res.ok) {
                toast.error((await res.json().catch(() => ({}))).error ?? 'Failed to save task')
                return
            }
            const d = await res.json()
            setResult({ id: taskId, content: d.content })
            setEditing(null)
            toast.success('Task saved')
            void refresh()
        } finally {
            setSaving(false)
        }
    }

    // B6 — redo with feedback
    const onFeedback = () => {
        if (!taskId) return
        openFeedback({
            project,
            taskId,
            lastError: task?.lastError,
            onDone: (tasks) => {
                onTasksChanged?.(tasks)
                // reload the body (the feedback section was appended)
                void fetch(`/api/projects/${project}/tasks/${taskId}`)
                    .then((r) => (r.ok ? r.json() : Promise.reject()))
                    .then((d) => setResult({ id: taskId, content: d.content }))
                    .catch(() => {})
            },
        })
    }

    const canEdit = task?.status !== 'running'

    return (
        <tc-drawer ref={drawerRef} side="right" size="large" title={taskId ?? ''}>
            <div style={{ padding: '1.25rem' }}>
                <div className="tf-actions" style={{ marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <tc-badge variant="secondary">{taskId}</tc-badge>
                    {task && <tc-badge variant={STATUS_BADGE[task.status]}>{task.status}</tc-badge>}
                    <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.5rem' }}>
                        {taskId && editDraft === null && (
                            <tc-button
                                size="sm"
                                variant="secondary"
                                outline
                                disabled={!canEdit || content === null || undefined}
                                title={helpTexts.tasks.edit}
                                onClick={() => content !== null && setEditing({ id: taskId, draft: content })}
                            >
                                ✎ Edit
                            </tc-button>
                        )}
                        {taskId && (task?.status === 'error' || task?.status === 'done' || task?.status === 'needs-review') && (
                            <tc-button
                                size="sm"
                                variant="warning"
                                outline
                                disabled={running || undefined}
                                title={helpTexts.tasks.feedback}
                                onClick={onFeedback}
                            >
                                ↻ Redo with feedback
                            </tc-button>
                        )}
                        {onReRun && taskId && (
                            <tc-button
                                size="sm"
                                variant="primary"
                                outline
                                disabled={running || task?.status === 'running' || undefined}
                                title={running ? 'Stop the active run first.' : helpTexts.tasks.reRun}
                                onClick={() => onReRun(taskId)}
                            >
                                ▶ Re-run task
                            </tc-button>
                        )}
                    </span>
                </div>

                <div className="tf-stack-sm" style={{ marginBottom: '0.75rem' }}>
                    <div style={{ maxWidth: 280 }}>
                        <tc-select
                            ref={modelRef}
                            label="Preferred model"
                            value={task?.model ?? ''}
                            disabled={savingModel || task?.status === 'running' || undefined}
                        >
                            {pinOptions.map((o) => (
                                <tc-option key={o.value} value={o.value}>
                                    {o.label}
                                </tc-option>
                            ))}
                        </tc-select>
                    </div>
                    <tc-helper-text text={helpTexts.tasks.modelOverride} />
                </div>

                {task && (task.lastModel || task.lastElapsed != null || task.lastCommit || task.lastError || task.costUsd != null || task.review) && (
                    <div className="tf-stack-sm" style={{ marginBottom: '0.5rem' }}>
                        {task.lastModel && (
                            <div className="tf-kv">
                                <span>Last model</span>
                                <tc-text>{task.lastModel}</tc-text>
                            </div>
                        )}
                        {task.lastElapsed != null && (
                            <div className="tf-kv">
                                <span>Last elapsed</span>
                                <tc-text>{task.lastElapsed}s</tc-text>
                            </div>
                        )}
                        {(task.tokensIn != null || task.tokensOut != null || task.costUsd != null) && (
                            <div className="tf-kv">
                                <span>Last usage</span>
                                <tc-text>
                                    {task.tokensIn != null ? `${(task.tokensIn / 1000).toFixed(1)}k in` : '—'}
                                    {' / '}
                                    {task.tokensOut != null ? `${(task.tokensOut / 1000).toFixed(1)}k out` : '—'}
                                    {task.costUsd != null ? ` · $${task.costUsd.toFixed(2)}` : ''}
                                </tc-text>
                            </div>
                        )}
                        {task.lastCommit && (
                            <div className="tf-kv">
                                <span>Commit</span>
                                <code>{task.lastCommit.slice(0, 8)}</code>
                            </div>
                        )}
                        {task.review && (
                            <div className="tf-kv">
                                <span>Review</span>
                                <span>
                                    <tc-badge variant={task.review === 'pass' ? 'success' : 'warning'}>{task.review}</tc-badge>
                                    {task.reviewNote && (
                                        <tc-text variant="muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                                            {task.reviewNote}
                                        </tc-text>
                                    )}
                                </span>
                            </div>
                        )}
                        {task.lastError && (
                            <div className="tf-kv">
                                <span>Last error</span>
                                <tc-text variant="mono" style={{ color: 'var(--bs-danger, #c0392b)' }}>
                                    {task.lastError}
                                </tc-text>
                            </div>
                        )}
                        <tc-divider />
                    </div>
                )}

                {loading && (
                    <div style={{ padding: '2rem', textAlign: 'center' }}>
                        <tc-spinner />
                    </div>
                )}
                {editDraft !== null && taskId ? (
                    <div className="tf-stack-sm">
                        <tc-helper-text text={helpTexts.tasks.editStatusNote} />
                        <tc-markdown-editor ref={editorRef} value={editDraft} height="420" />
                        <div className="tf-actions">
                            <tc-button variant="primary" loading={saving || undefined} disabled={saving || undefined} onClick={() => void onSaveEdit()}>
                                Save
                            </tc-button>
                            <tc-button variant="secondary" outline onClick={() => setEditing(null)}>
                                Cancel
                            </tc-button>
                        </div>
                    </div>
                ) : (
                    content !== null && (
                        <pre
                            style={{
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontFamily: 'ui-monospace, monospace',
                                fontSize: '0.85rem',
                                marginTop: '1rem',
                            }}
                        >
                            {content}
                        </pre>
                    )
                )}
            </div>
        </tc-drawer>
    )
}
