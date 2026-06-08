'use client'

import React, { useEffect, useState } from 'react'
import { Drawer, Spinner, Badge, Button, Text, Divider } from '@toolcase/react-components'
import type { TaskInfo, TaskRuntimeStatus } from '@/server/types'

const STATUS_BADGE: Record<TaskRuntimeStatus, 'secondary' | 'info' | 'success' | 'danger'> = {
    pending: 'secondary',
    running: 'info',
    done: 'success',
    error: 'danger',
}

export function TaskDrawer({
    project,
    taskId,
    task,
    running,
    onReRun,
    onClose,
}: {
    project: string
    taskId: string | null
    task?: TaskInfo
    running?: boolean
    onReRun?: (id: string) => void | Promise<void>
    onClose: () => void
}) {
    // Result is stamped with the task it belongs to, so `content` derives its own
    // staleness: when `taskId` changes, content falls back to null (and an in-flight
    // response can never render under the wrong task) — no prop-change reset effect.
    const [result, setResult] = useState<{ id: string; content: string } | null>(null)
    const content = result?.id === taskId ? result.content : null
    const loading = taskId !== null && content === null

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

    return (
        <Drawer open={taskId !== null} onClose={onClose} side="right" size="large" title={taskId ?? ''}>
            <div style={{ padding: '1.25rem' }}>
                <div className="tf-actions" style={{ marginBottom: '0.75rem' }}>
                    <Badge variant="secondary">{taskId}</Badge>
                    {task && <Badge variant={STATUS_BADGE[task.status]}>{task.status}</Badge>}
                    {onReRun && taskId && (
                        <Button
                            size="small"
                            variant="primary"
                            outline
                            disabled={running || task?.status === 'running'}
                            title={running ? 'Stop the active run first.' : ''}
                            style={{ marginLeft: 'auto' }}
                            onClick={() => onReRun(taskId)}
                        >
                            ▶ Re-run task
                        </Button>
                    )}
                </div>

                {task && (task.lastModel || task.lastElapsed != null || task.lastCommit || task.lastError) && (
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
                        {task.lastCommit && (
                            <div className="tf-kv">
                                <span>Commit</span>
                                <code>{task.lastCommit.slice(0, 8)}</code>
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
                {content !== null && (
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
                )}
            </div>
        </Drawer>
    )
}
