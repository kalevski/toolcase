'use client'

import React, { useEffect, useState } from 'react'
import {
    Drawer,
    Spinner,
    Badge,
    Button,
    Text,
    Divider,
    Select,
    HelperText,
    MarkdownEditor,
    toast,
} from '@toolcase/react-components'
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
        ...MODEL_ALIASES.filter((a) => !modelOptions.some((o) => o.value === a)).map((a) => ({
            value: a,
            label: a,
        })),
        ...modelOptions,
    ]

    const onModelPick = async (value: string) => {
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
        <Drawer open={taskId !== null} onClose={onClose} side="right" size="large" title={taskId ?? ''}>
            <div style={{ padding: '1.25rem' }}>
                <div className="tf-actions" style={{ marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <Badge variant="secondary">{taskId}</Badge>
                    {task && <Badge variant={STATUS_BADGE[task.status]}>{task.status}</Badge>}
                    <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.5rem' }}>
                        {taskId && editDraft === null && (
                            <Button
                                size="small"
                                variant="secondary"
                                outline
                                disabled={!canEdit || content === null}
                                title={helpTexts.tasks.edit}
                                onClick={() => content !== null && setEditing({ id: taskId, draft: content })}
                            >
                                ✎ Edit
                            </Button>
                        )}
                        {taskId && (task?.status === 'error' || task?.status === 'done' || task?.status === 'needs-review') && (
                            <Button
                                size="small"
                                variant="warning"
                                outline
                                disabled={running}
                                title={helpTexts.tasks.feedback}
                                onClick={onFeedback}
                            >
                                ↻ Redo with feedback
                            </Button>
                        )}
                        {onReRun && taskId && (
                            <Button
                                size="small"
                                variant="primary"
                                outline
                                disabled={running || task?.status === 'running'}
                                title={running ? 'Stop the active run first.' : helpTexts.tasks.reRun}
                                onClick={() => onReRun(taskId)}
                            >
                                ▶ Re-run task
                            </Button>
                        )}
                    </span>
                </div>

                <div className="tf-stack-sm" style={{ marginBottom: '0.75rem' }}>
                    <div style={{ maxWidth: 280 }}>
                        <Select
                            label="Preferred model"
                            options={pinOptions}
                            value={task?.model ?? ''}
                            disabled={savingModel || task?.status === 'running'}
                            onChange={(e) => void onModelPick(e.target.value)}
                        />
                    </div>
                    <HelperText text={helpTexts.tasks.modelOverride} />
                </div>

                {task && (task.lastModel || task.lastElapsed != null || task.lastCommit || task.lastError || task.costUsd != null || task.review) && (
                    <div className="tf-stack-sm" style={{ marginBottom: '0.5rem' }}>
                        {task.lastModel && (
                            <div className="tf-kv">
                                <span>Last model</span>
                                <Text>{task.lastModel}</Text>
                            </div>
                        )}
                        {task.lastElapsed != null && (
                            <div className="tf-kv">
                                <span>Last elapsed</span>
                                <Text>{task.lastElapsed}s</Text>
                            </div>
                        )}
                        {(task.tokensIn != null || task.tokensOut != null || task.costUsd != null) && (
                            <div className="tf-kv">
                                <span>Last usage</span>
                                <Text>
                                    {task.tokensIn != null ? `${(task.tokensIn / 1000).toFixed(1)}k in` : '—'}
                                    {' / '}
                                    {task.tokensOut != null ? `${(task.tokensOut / 1000).toFixed(1)}k out` : '—'}
                                    {task.costUsd != null ? ` · $${task.costUsd.toFixed(2)}` : ''}
                                </Text>
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
                                    <Badge variant={task.review === 'pass' ? 'success' : 'warning'}>{task.review}</Badge>
                                    {task.reviewNote && (
                                        <Text variant="muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                                            {task.reviewNote}
                                        </Text>
                                    )}
                                </span>
                            </div>
                        )}
                        {task.lastError && (
                            <div className="tf-kv">
                                <span>Last error</span>
                                <Text variant="mono" style={{ color: 'var(--rc-danger, #c0392b)' }}>
                                    {task.lastError}
                                </Text>
                            </div>
                        )}
                        <Divider />
                    </div>
                )}

                {loading && (
                    <div style={{ padding: '2rem', textAlign: 'center' }}>
                        <Spinner />
                    </div>
                )}
                {editDraft !== null && taskId ? (
                    <div className="tf-stack-sm">
                        <HelperText text={helpTexts.tasks.editStatusNote} />
                        <MarkdownEditor value={editDraft} onChange={(v) => setEditing({ id: taskId, draft: v })} height={420} />
                        <div className="tf-actions">
                            <Button variant="primary" loading={saving} disabled={saving} onClick={() => void onSaveEdit()}>
                                Save
                            </Button>
                            <Button variant="secondary" outline onClick={() => setEditing(null)}>
                                Cancel
                            </Button>
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
        </Drawer>
    )
}
