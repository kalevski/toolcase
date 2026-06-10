'use client'

// E2 — import open GitHub issues of the project's origin repo as task files.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, Button, Heading, Text, Checkbox, Spinner, Tag, HelperText, toast } from '@toolcase/react-components'
import type { GithubIssue, TaskInfo } from '@/server/domain/types'
import { helpTexts } from './helpTexts'

export interface ImportIssuesInput {
    project: string
    onImported: (tasks: TaskInfo[]) => void
}

const KEY = 'importIssues'

export function ImportIssuesModal() {
    const input = Modal.useModalInput<ImportIssuesInput>()
    const close = Modal.useModalClose<boolean>()

    const [issues, setIssues] = useState<GithubIssue[] | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [picked, setPicked] = useState<Set<number>>(() => new Set())
    const [submitting, setSubmitting] = useState(false)
    const loadedFor = useRef<ImportIssuesInput | null>(null)

    useEffect(() => {
        if (!input || loadedFor.current === input) return
        loadedFor.current = input
        setIssues(null)
        setLoadError(null)
        setPicked(new Set())
        fetch(`/api/projects/${input.project}/git/issues`)
            .then(async (r) => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`)
                return r.json()
            })
            .then((d) => setIssues(d))
            .catch((e) => setLoadError(e?.message ?? 'Failed to load issues'))
    }, [input])

    if (!input) return null

    const toggle = (n: number, checked: boolean) => {
        setPicked((prev) => {
            const next = new Set(prev)
            if (checked) next.add(n)
            else next.delete(n)
            return next
        })
    }

    const submit = async () => {
        if (!picked.size) return
        setSubmitting(true)
        try {
            const res = await fetch(`/api/projects/${input.project}/tasks/import-issues`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numbers: [...picked] }),
            })
            if (!res.ok) {
                toast.error((await res.json().catch(() => ({}))).error ?? 'Import failed')
                return
            }
            const data = await res.json()
            input.onImported(data.tasks)
            toast.success(`Imported ${data.created.length} issue(s) as tasks`)
            close(true)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal.Window size="large" title="Import GitHub issues">
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <Heading as="h3">Import from GitHub — {input.project}</Heading>
                <HelperText text={helpTexts.tasks.importIssues} />
                {issues === null && !loadError && (
                    <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                        <Spinner />
                    </div>
                )}
                {loadError && <Text style={{ color: 'var(--rc-danger, #c0392b)' }}>{loadError}</Text>}
                {issues !== null && issues.length === 0 && <Text variant="muted">No open issues.</Text>}
                {issues !== null && issues.length > 0 && (
                    <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {issues.map((i) => (
                            <label key={i.number} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', cursor: 'pointer' }}>
                                <Checkbox checked={picked.has(i.number)} onChange={(e) => toggle(i.number, e.target.checked)} />
                                <span>
                                    <strong>#{i.number}</strong> {i.title}{' '}
                                    {i.labels.map((l) => (
                                        <Tag key={l} variant="secondary">
                                            {l}
                                        </Tag>
                                    ))}
                                </span>
                            </label>
                        ))}
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <Button variant="secondary" outline onClick={() => close(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        loading={submitting}
                        disabled={submitting || picked.size === 0}
                        onClick={() => void submit()}
                    >
                        Import {picked.size > 0 ? `${picked.size} issue(s)` : ''}
                    </Button>
                </div>
            </div>
        </Modal.Window>
    )
}

export function useImportIssuesModal() {
    const open = Modal.useModalOpen<boolean, ImportIssuesInput>(KEY, () => {})
    return useCallback((input: ImportIssuesInput) => open(input), [open])
}
