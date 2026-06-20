'use client'

import React, { useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/lib/toast'
import { useTcEvents } from '@/lib/tc'
import type { AgentKind } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { useConfirm } from '../ConfirmModal'
import { helpTexts } from '../helpTexts'
import { AgentPanel } from './AgentPanel'

const BUNDLED_HELP: Record<string, string> = {
    'task-creator': helpTexts.agents.taskCreator,
    'knowledge-writer': helpTexts.agents.knowledgeWriter,
    'note-writer': helpTexts.notes.agent,
}

const BUNDLED_PLACEHOLDER: Record<string, string> = {
    'task-creator': 'e.g. Add health checks and structured logging across the API service.',
    'knowledge-writer': 'e.g. How does the SSE streaming pipeline deliver run logs to the client?',
    'note-writer': "e.g. Summarize today's run failures and list follow-ups.",
}

const BUNDLED_SUBMIT: Record<string, string> = {
    'task-creator': 'Generate tasks',
    'knowledge-writer': 'Analyze & add doc',
}

export function AgentsClient({ isAdmin = false }: { isAdmin?: boolean }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { config, notes, agentSessions } = useProject()
    const confirm = useConfirm()

    const tabKinds = config.agentKinds

    // note-writer tab: which note the agent should edit (empty = create new);
    // falls back to "create new" when the selected note has been deleted
    const [rawTargetNote, setTargetNote] = useState('')
    const targetNote = notes.some((n) => n.id === rawTargetNote) ? rawTargetNote : ''
    const noteAgentRunning = agentSessions['note-writer']?.status === 'running'

    // Tab selection lives in the URL (?tab=…) so the activity bar can deep-link
    // to a specific agent and refresh/share keeps the tab.
    const raw = searchParams.get('tab')
    const activeTab: AgentKind = tabKinds.some((k) => k.kind === raw) ? (raw as AgentKind) : 'task-creator'

    const onTabChange = useCallback(
        (key: string) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('tab', key)
            router.replace(`?${params.toString()}`, { scroll: false })
        },
        [router, searchParams],
    )

    // ── C4 admin: define a custom agent kind ────────────────────────────────
    const [defKind, setDefKind] = useState('')
    const [defLabel, setDefLabel] = useState('')
    const [defTarget, setDefTarget] = useState('project')
    const [defPost, setDefPost] = useState('none')
    const [defPreamble, setDefPreamble] = useState('')
    const [savingDef, setSavingDef] = useState(false)

    const kindRef = useTcEvents<HTMLElement>({ input: (e) => setDefKind((e.target as HTMLInputElement).value) })
    const labelRef = useTcEvents<HTMLElement>({ input: (e) => setDefLabel((e.target as HTMLInputElement).value) })
    const targetRef = useTcEvents<HTMLElement>({ change: (e) => setDefTarget((e.target as HTMLSelectElement).value) })
    const postRef = useTcEvents<HTMLElement>({ change: (e) => setDefPost((e.target as HTMLSelectElement).value) })
    const preambleRef = useTcEvents<HTMLElement>({ input: (e) => setDefPreamble((e.target as HTMLTextAreaElement).value) })
    const noteTargetRef = useTcEvents<HTMLElement>({ change: (e) => setTargetNote((e.target as HTMLSelectElement).value) })

    const saveDef = async () => {
        setSavingDef(true)
        try {
            const res = await fetch('/api/agent-defs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kind: defKind.trim(),
                    label: defLabel.trim(),
                    target: defTarget,
                    post: defPost,
                    promptPreamble: defPreamble,
                }),
            })
            if (!res.ok) {
                toast.error((await res.json().catch(() => ({}))).error ?? 'Failed to save agent')
                return
            }
            toast.success(`Agent “${defKind.trim()}” saved — reload to see its tab`)
            router.refresh()
        } finally {
            setSavingDef(false)
        }
    }

    const deleteDef = async (kind: string) => {
        const ok = await confirm({
            title: `Delete custom agent “${kind}”?`,
            body: 'Its prompt history stays; the tab disappears for every project.',
            confirmLabel: 'Delete agent',
            confirmVariant: 'danger',
        })
        if (!ok) return
        const res = await fetch(`/api/agent-defs/${kind}`, { method: 'DELETE' })
        if (!res.ok) {
            toast.error('Failed to delete agent')
            return
        }
        toast.success(`Deleted “${kind}”`)
        router.refresh()
    }

    // tc-tab-sections only renders string content, so the tab strip is plain
    // Bootstrap nav-tabs (web-components-styled) and the active panel — which
    // hosts live React (AgentPanel) — is rendered below it.
    const active = tabKinds.find((k) => k.kind === activeTab)

    const renderPanel = (k: (typeof tabKinds)[number]) => (
        <div className="tf-stack-sm" style={{ paddingTop: '1rem' }}>
            <tc-helper-text text={BUNDLED_HELP[k.kind] ?? helpTexts.agents.custom} />
            {k.custom && isAdmin && (
                <div className="tf-actions">
                    <tc-button size="sm" variant="danger" outline onClick={() => void deleteDef(k.kind)}>
                        Delete this agent kind
                    </tc-button>
                </div>
            )}
            {k.kind === 'note-writer' ? (
                <AgentPanel
                    kind="note-writer"
                    placeholder={BUNDLED_PLACEHOLDER['note-writer']}
                    submitLabel={targetNote ? 'Edit note' : 'Create note'}
                    submitOptions={() => ({ targetNote: targetNote || undefined })}
                    beforeComposer={
                        <div className="tf-stack-sm">
                            <div style={{ maxWidth: 320 }}>
                                <tc-select
                                    ref={noteTargetRef}
                                    label="Target note"
                                    value={targetNote}
                                    disabled={noteAgentRunning || undefined}
                                >
                                    <tc-option value="">➕ Create new note</tc-option>
                                    {notes.map((n) => (
                                        <tc-option key={n.id} value={n.id}>
                                            {n.title}
                                        </tc-option>
                                    ))}
                                </tc-select>
                            </div>
                            <tc-helper-text text={helpTexts.notes.agentTarget} />
                        </div>
                    }
                />
            ) : (
                <AgentPanel
                    kind={k.kind}
                    placeholder={BUNDLED_PLACEHOLDER[k.kind] ?? `Instructions for the ${k.label} agent…`}
                    submitLabel={BUNDLED_SUBMIT[k.kind] ?? 'Run agent'}
                />
            )}
        </div>
    )

    return (
        <div className="tf-stack">
            <div>
                <ul className="nav nav-tabs" role="tablist">
                    {tabKinds.map((k) => (
                        <li className="nav-item" key={k.kind} role="presentation">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={activeTab === k.kind}
                                className={`nav-link${activeTab === k.kind ? ' active' : ''}`}
                                onClick={() => onTabChange(k.kind)}
                            >
                                {k.label}
                            </button>
                        </li>
                    ))}
                </ul>
                {active && renderPanel(active)}
            </div>

            {isAdmin && (
                <tc-card>
                    <tc-heading slot="header" as="h3">
                        Custom agents (admin)
                    </tc-heading>
                    <div className="tf-card-body tf-stack-sm">
                        <tc-helper-text text={helpTexts.agents.custom} />
                        <div className="tf-form-row">
                            <tc-input ref={kindRef} label="Kind (kebab-case)" placeholder="test-writer" value={defKind} />
                            <tc-input ref={labelRef} label="Label" placeholder="Test writer" value={defLabel} />
                            <tc-select ref={targetRef} label="Target directory" value={defTarget}>
                                <tc-option value="project">whole project</tc-option>
                                <tc-option value="repo">repo/</tc-option>
                                <tc-option value="tasks">tasks/</tc-option>
                                <tc-option value="knowledge">knowledge/</tc-option>
                                <tc-option value="notes">notes/</tc-option>
                            </tc-select>
                            <tc-select ref={postRef} label="Post-processing" value={defPost}>
                                <tc-option value="none">none</tc-option>
                                <tc-option value="tasks">refresh tasks</tc-option>
                                <tc-option value="knowledge">refresh knowledge</tc-option>
                                <tc-option value="notes">refresh notes</tc-option>
                            </tc-select>
                        </div>
                        <tc-textarea
                            ref={preambleRef}
                            label="Prompt preamble (prepended to every prompt)"
                            rows={4}
                            placeholder="You write focused unit tests for the change described below…"
                            value={defPreamble}
                        />
                        <div className="tf-actions">
                            <tc-button
                                variant="primary"
                                loading={savingDef || undefined}
                                disabled={savingDef || !defKind.trim() || !defLabel.trim() || undefined}
                                onClick={() => void saveDef()}
                            >
                                Save custom agent
                            </tc-button>
                            <tc-text variant="muted">Custom agents are global — every project gets the tab.</tc-text>
                        </div>
                    </div>
                </tc-card>
            )}
        </div>
    )
}
