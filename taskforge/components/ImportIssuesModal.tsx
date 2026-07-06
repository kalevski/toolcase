'use client'

// E2 — import open GitHub issues of the project's origin repo as task files.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '@/lib/modal'
import { toast } from '@/lib/toast'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { useTcEvents } from '@/lib/tc'
import type { GithubIssue, TaskInfo } from '@/server/domain/types'
import { helpTexts } from './helpTexts'
import { LoadingState } from './states'

export interface ImportIssuesInput {
    project: string
    onImported: (tasks: TaskInfo[]) => void
}

const KEY = 'importIssues'

// Per-row checkbox component so it can own its change listener (hooks can't run
// in a .map; React 18 doesn't fire onChange on tc-check).
function IssueCheckbox({ checked, onToggle }: { checked: boolean; onToggle: (checked: boolean) => void }) {
    const ref = useTcEvents<HTMLElement>({ change: (e) => onToggle((e.target as HTMLInputElement).checked) })
    return <tc-check ref={ref} checked={checked || undefined} />
}

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
        // GitHub round-trip on the server — can outlast the default deadline.
        apiFetch<GithubIssue[]>(`/api/projects/${input.project}/git/issues`, { timeoutMs: 0 })
            .then((d) => setIssues(d))
            .catch((e) => setLoadError(describeApiError(e)))
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
            // GitHub round-trip on the server — can outlast the default deadline.
            const data = await apiFetch<{ tasks: TaskInfo[]; created: unknown[] }>(
                `/api/projects/${input.project}/tasks/import-issues`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ numbers: [...picked] }),
                    timeoutMs: 0,
                },
            )
            input.onImported(data.tasks)
            toast.success(`Imported ${data.created.length} issue(s) as tasks`)
            close(true)
        } catch (e) {
            toast.error(describeApiError(e))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal.Window size="large" title={`Import from GitHub — ${input.project}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <tc-helper-text text={helpTexts.tasks.importIssues} />
                {issues === null && !loadError && <LoadingState label="Loading issues…" />}
                {loadError && <tc-text style={{ color: 'var(--bs-danger, #c0392b)' }}>{loadError}</tc-text>}
                {issues !== null && issues.length === 0 && <tc-text variant="muted">No open issues.</tc-text>}
                {issues !== null && issues.length > 0 && (
                    <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {issues.map((i) => (
                            <label key={i.number} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', cursor: 'pointer' }}>
                                <IssueCheckbox checked={picked.has(i.number)} onToggle={(checked) => toggle(i.number, checked)} />
                                <span>
                                    <strong>#{i.number}</strong> {i.title}{' '}
                                    {i.labels.map((l) => (
                                        <tc-tag key={l} static variant="secondary">
                                            {l}
                                        </tc-tag>
                                    ))}
                                </span>
                            </label>
                        ))}
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <tc-button variant="secondary" outline onClick={() => close(false)}>
                        Cancel
                    </tc-button>
                    <tc-button
                        variant="primary"
                        loading={submitting || undefined}
                        disabled={submitting || picked.size === 0 || undefined}
                        onClick={() => void submit()}
                    >
                        Import {picked.size > 0 ? `${picked.size} issue(s)` : ''}
                    </tc-button>
                </div>
            </div>
        </Modal.Window>
    )
}

export function useImportIssuesModal() {
    const open = Modal.useModalOpen<boolean, ImportIssuesInput>(KEY, () => {})
    return useCallback((input: ImportIssuesInput) => open(input), [open])
}
