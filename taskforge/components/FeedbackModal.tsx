'use client'

// B6 — "Redo with feedback": tell the agent what was wrong, reset the task to
// pending, optionally run it immediately.

import React, { useCallback, useRef, useState } from 'react'
import { Modal, Button, Heading, Text, Switch, Textarea, HelperText, toast } from '@toolcase/react-components'
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
            const res = await fetch(`/api/projects/${input.project}/tasks/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: input.taskId, text, rerun }),
            })
            const data = await res.json().catch(() => ({}))
            if (res.status === 409) {
                toast.error('A run or agent is in progress.')
                return
            }
            if (res.status === 412) {
                if (data.tasks) input.onDone(data.tasks)
                toast.error('Feedback saved, but the re-run needs a clean working tree.')
                close(true)
                return
            }
            if (!res.ok) {
                toast.error(data.error ?? 'Failed to save feedback')
                return
            }
            input.onDone(data.tasks)
            toast.success(data.started ? 'Feedback saved — task running now' : 'Feedback saved — task is pending again')
            close(true)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal.Window size="medium" title="Redo with feedback">
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <Heading as="h3">Redo {input.taskId}</Heading>
                <HelperText text={helpTexts.tasks.feedback} />
                {input.lastError && (
                    <Text variant="mono" style={{ color: 'var(--rc-danger, #c0392b)', fontSize: '0.8rem' }}>
                        Last error: {input.lastError}
                    </Text>
                )}
                <Textarea
                    label="What was wrong / what to do differently"
                    rows={6}
                    placeholder="The endpoint was added but returns 500 because…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                />
                <Switch label="Run this task again immediately" checked={rerun} onChange={(e) => setRerun(e.target.checked)} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <Button variant="secondary" outline onClick={() => close(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" loading={submitting} disabled={submitting || !text.trim()} onClick={() => void submit()}>
                        {rerun ? 'Save & re-run' : 'Save feedback'}
                    </Button>
                </div>
            </div>
        </Modal.Window>
    )
}

export function useFeedbackModal() {
    const open = Modal.useModalOpen<boolean, FeedbackInput>(KEY, () => {})
    return useCallback((input: FeedbackInput) => open(input), [open])
}
