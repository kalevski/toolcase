'use client'

// B6 — "Redo with feedback": tell the agent what was wrong, reset the task to
// pending, optionally run it immediately.

import React, { useCallback, useRef, useState } from 'react'
import { Modal } from '@/lib/modal'
import { toast } from '@/lib/toast'
import { apiFetch, ApiError, describeApiError } from '@/lib/fetcher'
import { useTcEvents, detailValue } from '@/lib/tc'
import type { TaskInfo } from '@/server/domain/types'
import { helpTexts } from './helpTexts'

export interface FeedbackInput {
    project: string
    taskId: string
    lastError?: string
    onDone: (tasks: TaskInfo[]) => void
}

const KEY = 'taskFeedback'

export function FeedbackModal() {
    const input = Modal.useModalInput<FeedbackInput>()
    const close = Modal.useModalClose<boolean>()

    const [text, setText] = useState('')
    const [rerun, setRerun] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const textRef = useTcEvents<HTMLElement>({ input: (e) => setText((e.target as HTMLTextAreaElement).value) })
    const rerunRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => setRerun(detailValue<boolean>(e)) })
    const seen = useRef<FeedbackInput | null>(null)
    if (input && seen.current !== input) {
        seen.current = input
        if (text) setText('')
    }

    if (!input) return null

    const submit = async () => {
        if (!text.trim()) {
            toast.error('Describe what was wrong.')
            return
        }
        setSubmitting(true)
        try {
            const data = await apiFetch<{ started: boolean; tasks: TaskInfo[] }>(
                `/api/projects/${input.project}/tasks/feedback`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: input.taskId, text, rerun }),
                },
            )
            input.onDone(data.tasks)
            toast.success(data.started ? 'Feedback saved — task running now' : 'Feedback saved — task is pending again')
            close(true)
        } catch (e) {
            if (e instanceof ApiError && e.status === 409) {
                toast.error('A run or agent is in progress.')
                return
            }
            if (e instanceof ApiError && e.status === 412) {
                // Feedback WAS saved and the task reset to pending — only the
                // re-run was blocked. The 412 body's task list isn't surfaced by
                // apiFetch, so re-pull it (best-effort) to keep the board fresh.
                const tasks = await apiFetch<TaskInfo[]>(`/api/projects/${input.project}/tasks`).catch(() => null)
                if (tasks) input.onDone(tasks)
                toast.error('Feedback saved, but the re-run needs a clean working tree.')
                close(true)
                return
            }
            toast.error(describeApiError(e))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal.Window size="medium" title={`Redo ${input.taskId}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <tc-helper-text text={helpTexts.tasks.feedback} />
                {input.lastError && (
                    <tc-text variant="mono" style={{ color: 'var(--bs-danger, #c0392b)', fontSize: '0.8rem' }}>
                        Last error: {input.lastError}
                    </tc-text>
                )}
                <tc-textarea
                    ref={textRef}
                    label="What was wrong / what to do differently"
                    rows={6}
                    placeholder="The endpoint was added but returns 500 because…"
                    value={text}
                />
                <tc-switch ref={rerunRef} label="Run this task again immediately" checked={rerun || undefined} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <tc-button variant="secondary" outline onClick={() => close(false)}>
                        Cancel
                    </tc-button>
                    <tc-button
                        variant="primary"
                        loading={submitting || undefined}
                        disabled={submitting || !text.trim() || undefined}
                        onClick={() => void submit()}
                    >
                        {rerun ? 'Save & re-run' : 'Save feedback'}
                    </tc-button>
                </div>
            </div>
        </Modal.Window>
    )
}

export function useFeedbackModal() {
    const open = Modal.useModalOpen<boolean, FeedbackInput>(KEY, () => {})
    return useCallback((input: FeedbackInput) => open(input), [open])
}
