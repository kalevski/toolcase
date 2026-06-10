'use client'

// A1 — manual task creation: title + markdown body + facets form.

import React, { useCallback, useRef, useState } from 'react'
import { Modal, Button, Heading, Input, Select, MarkdownEditor, HelperText, toast } from '@toolcase/react-components'
import type { TaskInfo } from '@/server/domain/types'
import { helpTexts } from './helpTexts'

export interface NewTaskInput {
    project: string
    onCreated: (tasks: TaskInfo[]) => void
}

const KEY = 'newTask'
const MODEL_OPTIONS = ['', 'fast', 'mid', 'deep']

export function NewTaskModal() {
    const input = Modal.useModalInput<NewTaskInput>()
    const close = Modal.useModalClose<boolean>()

    const [title, setTitle] = useState('')
    const [body, setBody] = useState('## Problem\n\n\n## Task\n\n')
    const [severity, setSeverity] = useState('')
    const [facetProject, setFacetProject] = useState('')
    const [model, setModel] = useState('')
    const [depends, setDepends] = useState('')
    const [submitting, setSubmitting] = useState(false)
    // Stamp form state to the open payload so a re-open starts fresh.
    const seenInput = useRef<NewTaskInput | null>(null)
    if (input && seenInput.current !== input) {
        seenInput.current = input
        if (title || severity || facetProject || model || depends) {
            setTitle('')
            setBody('## Problem\n\n\n## Task\n\n')
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
            const res = await fetch(`/api/projects/${input.project}/tasks`, {
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
            if (res.status === 409) {
                toast.error('A run is in progress.')
                return
            }
            if (!res.ok) {
                toast.error((await res.json().catch(() => ({}))).error ?? 'Failed to create task')
                return
            }
            const data = await res.json()
            input.onCreated(data.tasks)
            toast.success(`Created ${data.id}`)
            close(true)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal.Window size="large" title="New task">
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <Heading as="h3">New task — {input.project}</Heading>
                <HelperText text={helpTexts.tasks.newTask} />
                <Input label="Title" placeholder="Add /healthz endpoint" value={title} onChange={(e) => setTitle(e.target.value)} />
                <div className="tf-form-row">
                    <Select
                        label="Severity"
                        options={[
                            { value: '', label: '—' },
                            { value: 'low', label: 'low' },
                            { value: 'medium', label: 'medium' },
                            { value: 'high', label: 'high' },
                            { value: 'critical', label: 'critical' },
                        ]}
                        value={severity}
                        onChange={(e) => setSeverity(e.target.value)}
                    />
                    <Input label="Project facet" placeholder="api" value={facetProject} onChange={(e) => setFacetProject(e.target.value)} />
                    <Select
                        label="Model pin"
                        options={MODEL_OPTIONS.map((m) => ({ value: m, label: m || 'Run default' }))}
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                    />
                    <Input label="Depends (CSV)" placeholder="003, 007" value={depends} onChange={(e) => setDepends(e.target.value)} />
                </div>
                <MarkdownEditor value={body} onChange={setBody} height={280} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <Button variant="secondary" outline onClick={() => close(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" loading={submitting} disabled={submitting || !title.trim()} onClick={() => void submit()}>
                        Create task
                    </Button>
                </div>
            </div>
        </Modal.Window>
    )
}

export function useNewTaskModal() {
    const open = Modal.useModalOpen<boolean, NewTaskInput>(KEY, () => {})
    return useCallback((input: NewTaskInput) => open(input), [open])
}
