'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { toast } from '@/lib/toast'
import { useTcEvents } from '@/lib/tc'
import type { AgentKind, AgentPromptRecord } from '@/server/domain/types'
import { usePrompt } from '../ConfirmModal'

interface HistoryEntry {
    id: number
    prompt: string
    model: string
    usedAt: string
}

interface TemplateEntry {
    id: number
    name: string
    agent: AgentKind
    prompt: string
}

export interface PromptComposerProps {
    /** C1 — needed for the history / template endpoints. */
    project: string
    agentKind: AgentKind
    value: string
    onChange: (v: string) => void
    model: string
    onModelChange: (v: string) => void
    modelOptions: { value: string; label: string }[]
    lastPrompt: AgentPromptRecord | null
    /** Executor or any agent running (this one included). */
    busy: boolean
    /** THIS agent running → submit flips to Stop and the textarea locks. */
    running: boolean
    onSubmit: () => void
    onStop: () => void
    placeholder: string
    submitLabel: string
}

const MIN_ROWS = 3
const MAX_ROWS = 12

/** Compact relative time for the last-prompt strip ("2h ago"). */
function relativeTime(iso: string): string {
    const delta = Date.now() - new Date(iso).getTime()
    if (!Number.isFinite(delta) || delta < 0) return 'just now'
    const minutes = Math.floor(delta / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

/**
 * Shared prompt input for the one-shot agents (§4.2): last-prompt strip with
 * Reuse, autosizing textarea, model select, char count, Cmd/Ctrl+Enter submit,
 * Run↔Stop flip while this agent streams.
 */
export function PromptComposer({
    project,
    agentKind,
    value,
    onChange,
    model,
    onModelChange,
    modelOptions,
    lastPrompt,
    busy,
    running,
    onSubmit,
    onStop,
    placeholder,
    submitLabel,
}: PromptComposerProps) {
    const [expanded, setExpanded] = useState(false)
    const namePrompt = usePrompt()

    const modelRef = useTcEvents<HTMLElement>({ change: (e) => onModelChange((e.target as HTMLSelectElement).value) })

    // C1 — history + template panel state
    const [panel, setPanel] = useState<'history' | 'templates' | null>(null)
    const [history, setHistory] = useState<HistoryEntry[] | null>(null)
    const [templates, setTemplates] = useState<TemplateEntry[] | null>(null)

    const togglePanel = useCallback(
        async (which: 'history' | 'templates') => {
            if (panel === which) {
                setPanel(null)
                return
            }
            setPanel(which)
            try {
                if (which === 'history') {
                    const d = await fetch(`/api/projects/${project}/agents/${agentKind}/prompts`).then((r) =>
                        r.ok ? r.json() : null,
                    )
                    if (d) setHistory(d)
                } else {
                    const d = await fetch(`/api/prompt-templates?agent=${encodeURIComponent(agentKind)}`).then((r) =>
                        r.ok ? r.json() : null,
                    )
                    if (d) setTemplates(d)
                }
            } catch {
                /* transient */
            }
        },
        [panel, project, agentKind],
    )

    const saveTemplate = useCallback(async () => {
        if (!value.trim()) return
        const name = await namePrompt({
            title: 'Save as template',
            label: 'Template name (cross-project)',
            placeholder: 'thorough-bug-batch',
        })
        if (!name) return
        const res = await fetch('/api/prompt-templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, agent: agentKind, prompt: value }),
        })
        if (!res.ok) {
            toast.error('Failed to save template')
            return
        }
        toast.success(`Template “${name}” saved`)
        setTemplates(null) // refetch on next open
    }, [value, agentKind, namePrompt])

    const deleteTemplate = useCallback(async (id: number) => {
        const res = await fetch(`/api/prompt-templates/${id}`, { method: 'DELETE' })
        if (res.ok) {
            setTemplates((prev) => (prev ? prev.filter((t) => t.id !== id) : prev))
            toast.success('Template deleted')
        }
    }, [])

    // Locked while another Claude process holds the project (but not when it is
    // this agent — then the composer shows Stop instead).
    const lockedByOther = busy && !running
    const valid = value.trim().length > 0

    const rows = useMemo(() => {
        const lines = value.split('\n').length
        return Math.min(MAX_ROWS, Math.max(MIN_ROWS, lines))
    }, [value])

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && valid && !busy) {
            e.preventDefault()
            onSubmit()
        }
    }

    const reuse = () => {
        if (!lastPrompt) return
        onChange(lastPrompt.prompt)
        if (modelOptions.some((o) => o.value === lastPrompt.model)) onModelChange(lastPrompt.model)
    }

    const submitButton = running ? (
        <tc-button variant="danger" outline onClick={onStop}>
            Stop
        </tc-button>
    ) : (
        <tc-button variant="primary" disabled={lockedByOther || !valid || undefined} onClick={onSubmit}>
            {submitLabel}
        </tc-button>
    )

    return (
        <div className="tf-composer">
            {lastPrompt && (
                <div className="tf-composer__last">
                    <div className="tf-composer__last-meta">
                        <span className="tf-composer__last-label">⟲ Last prompt</span>
                        <tc-text variant="muted">{relativeTime(lastPrompt.usedAt)}</tc-text>
                        <tc-tag static variant="secondary">
                            {lastPrompt.model}
                        </tc-tag>
                        <tc-button
                            size="sm"
                            variant="secondary"
                            outline
                            disabled={running || undefined}
                            style={{ marginLeft: 'auto' }}
                            onClick={reuse}
                        >
                            Reuse
                        </tc-button>
                    </div>
                    <button
                        type="button"
                        className={`tf-composer__last-preview${expanded ? ' tf-composer__last-preview--expanded' : ''}`}
                        title={expanded ? 'Collapse' : 'Show full prompt'}
                        onClick={() => setExpanded((v) => !v)}
                    >
                        {lastPrompt.prompt}
                    </button>
                </div>
            )}

            <textarea
                className="tf-composer__input"
                rows={rows}
                placeholder={placeholder}
                value={value}
                readOnly={running}
                disabled={lockedByOther}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
            />

            <div className="tf-composer__footer">
                <div style={{ minWidth: 200 }}>
                    <tc-select ref={modelRef} label="Model" value={model} disabled={busy || undefined}>
                        {modelOptions.map((o) => (
                            <tc-option key={o.value} value={o.value}>
                                {o.label}
                            </tc-option>
                        ))}
                    </tc-select>
                </div>
                <tc-text variant="muted">{value.length.toLocaleString()} chars</tc-text>
                <span className="tf-composer__spacer" />
                <span className="tf-composer__history">
                    <tc-button size="sm" variant="secondary" outline onClick={() => void togglePanel('history')}>
                        ⟲ History
                    </tc-button>
                    {panel !== null && (
                        <div className="tf-composer__history-panel">
                            {panel === 'history' &&
                                (history === null ? (
                                    <div style={{ padding: '0.6rem' }}>
                                        <tc-text variant="muted">Loading…</tc-text>
                                    </div>
                                ) : history.length === 0 ? (
                                    <div style={{ padding: '0.6rem' }}>
                                        <tc-text variant="muted">No prompts recorded yet.</tc-text>
                                    </div>
                                ) : (
                                    history.map((h) => (
                                        <button
                                            key={h.id}
                                            type="button"
                                            className="tf-composer__history-row"
                                            onClick={() => {
                                                onChange(h.prompt)
                                                if (modelOptions.some((o) => o.value === h.model)) onModelChange(h.model)
                                                setPanel(null)
                                            }}
                                        >
                                            <span className="tf-composer__history-row-meta">
                                                {relativeTime(h.usedAt)} · {h.model}
                                            </span>
                                            <span className="tf-composer__history-row-text">{h.prompt}</span>
                                        </button>
                                    ))
                                ))}
                            {panel === 'templates' &&
                                (templates === null ? (
                                    <div style={{ padding: '0.6rem' }}>
                                        <tc-text variant="muted">Loading…</tc-text>
                                    </div>
                                ) : templates.length === 0 ? (
                                    <div style={{ padding: '0.6rem' }}>
                                        <tc-text variant="muted">No templates for this agent yet.</tc-text>
                                    </div>
                                ) : (
                                    templates.map((t) => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            className="tf-composer__history-row"
                                            onClick={() => {
                                                onChange(t.prompt)
                                                setPanel(null)
                                            }}
                                        >
                                            <span className="tf-composer__history-row-meta">
                                                <strong>{t.name}</strong>
                                                <span
                                                    role="button"
                                                    tabIndex={0}
                                                    style={{ marginLeft: 'auto', cursor: 'pointer' }}
                                                    title="Delete template"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        void deleteTemplate(t.id)
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.stopPropagation()
                                                            void deleteTemplate(t.id)
                                                        }
                                                    }}
                                                >
                                                    ✕
                                                </span>
                                            </span>
                                            <span className="tf-composer__history-row-text">{t.prompt}</span>
                                        </button>
                                    ))
                                ))}
                        </div>
                    )}
                </span>
                <tc-button size="sm" variant="secondary" outline onClick={() => void togglePanel('templates')}>
                    ☰ Templates
                </tc-button>
                <tc-button
                    size="sm"
                    variant="secondary"
                    outline
                    disabled={!valid || undefined}
                    title="Save the current prompt as a reusable cross-project template"
                    onClick={() => void saveTemplate()}
                >
                    ★ Save
                </tc-button>
                <tc-text variant="muted">⌘/Ctrl+Enter</tc-text>
                {lockedByOther ? (
                    <tc-tooltip content="Another agent or run is active for this project.">
                        <span>{submitButton}</span>
                    </tc-tooltip>
                ) : (
                    submitButton
                )}
            </div>
        </div>
    )
}
