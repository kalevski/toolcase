'use client'

// A1 — manual task creation: title + markdown body + facets form.

import React, { useCallback, useRef, useState } from 'react'
import { Modal } from '@/lib/modal'
import { toast } from '@/lib/toast'
import { apiFetch, ApiError, describeApiError } from '@/lib/fetcher'
import { useTcEvents, detailValue } from '@/lib/tc'
import type { TaskInfo } from '@/server/domain/types'
import { helpTexts } from './helpTexts'

export interface NewTaskInput {
    project: string
    onCreated: (tasks: TaskInfo[]) => void
}

const KEY = 'newTask'
const MODEL_OPTIONS = ['', 'fast', 'mid', 'deep']
const DEFAULT_BODY = '## Problem\n\n\n## Task\n\n'

export function NewTaskModal() {
    const input = Modal.useModalInput<NewTaskInput>()
    const close = Modal.useModalClose<boolean>()

    const [title, setTitle] = useState('')
    const [body, setBody] = useState(DEFAULT_BODY)
    const [severity, setSeverity] = useState('')
    const [facetProject, setFacetProject] = useState('')
    const [model, setModel] = useState('')
    const [depends, setDepends] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const titleRef = useTcEvents<HTMLElement>({ input: (e) => setTitle((e.target as HTMLInputElement).value) })
    const sevRef = useTcEvents<HTMLElement>({ change: (e) => setSeverity((e.target as HTMLSelectElement).value) })
    const facetRef = useTcEvents<HTMLElement>({ input: (e) => setFacetProject((e.target as HTMLInputElement).value) })
    const modelRef = useTcEvents<HTMLElement>({ change: (e) => setModel((e.target as HTMLSelectElement).value) })
    const dependsRef = useTcEvents<HTMLElement>({ input: (e) => setDepends((e.target as HTMLInputElement).value) })
    const bodyRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => setBody(detailValue<string>(e)) })

    // Stamp form state to the open payload so a re-open starts fresh.
    const seenInput = useRef<NewTaskInput | null>(null)
    if (input && seenInput.current !== input) {
        seenInput.current = input
        if (title || body !== DEFAULT_BODY || severity || facetProject || model || depends) {
            setTitle('')
            setBody(DEFAULT_BODY)
            setSeverity('')
            setFacetProject('')
            setModel('')
            setDepends('')
        }
    }

    if (!input) return null

    const submit = async () => {
        if (!title.trim() || !body.trim()) {
            toast.error('Title and body are required.')
            return
        }
        setSubmitting(true)
        try {
            const data = await apiFetch<{ id: string; tasks: TaskInfo[] }>(`/api/projects/${input.project}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    body,
                    severity: severity || undefined,
                    project: facetProject || undefined,
                    model: model || undefined,
                    depends: depends
                        ? depends.split(',').map((s) => s.trim()).filter(Boolean)
                        : undefined,
                }),
            })
            input.onCreated(data.tasks)
            toast.success(`Created ${data.id}`)
            close(true)
        } catch (e) {
            if (e instanceof ApiError && e.status === 409) toast.error('A run is in progress.')
            else toast.error(describeApiError(e))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal.Window size="large" title={`New task — ${input.project}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <tc-helper-text text={helpTexts.tasks.newTask} />
                <tc-input ref={titleRef} label="Title" placeholder="Add /healthz endpoint" value={title} />
                <tc-stack direction="horizontal" gap="1rem" wrap align="flex-end">
                    <tc-select ref={sevRef} label="Severity" value={severity}>
                        <tc-option value="">—</tc-option>
                        <tc-option value="low">low</tc-option>
                        <tc-option value="medium">medium</tc-option>
                        <tc-option value="high">high</tc-option>
                        <tc-option value="critical">critical</tc-option>
                    </tc-select>
                    <tc-input ref={facetRef} label="Project facet" placeholder="api" value={facetProject} />
                    <tc-select ref={modelRef} label="Model pin" value={model}>
                        {MODEL_OPTIONS.map((m) => (
                            <tc-option key={m} value={m}>
                                {m || 'Run default'}
                            </tc-option>
                        ))}
                    </tc-select>
                    <tc-input ref={dependsRef} label="Depends (CSV)" placeholder="003, 007" value={depends} />
                </tc-stack>
                <tc-markdown-editor ref={bodyRef} value={body} height="280" />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <tc-button variant="secondary" outline onClick={() => close(false)}>
                        Cancel
                    </tc-button>
                    <tc-button
                        variant="primary"
                        loading={submitting || undefined}
                        disabled={submitting || !title.trim() || undefined}
                        onClick={() => void submit()}
                    >
                        Create task
                    </tc-button>
                </div>
            </div>
        </Modal.Window>
    )
}

export function useNewTaskModal() {
    const open = Modal.useModalOpen<boolean, NewTaskInput>(KEY, () => {})
    return useCallback((input: NewTaskInput) => open(input), [open])
}
