'use client'

import React, { useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
    Button,
    Card,
    Heading,
    HelperText,
    Input,
    Select,
    TabSections,
    Textarea,
    Text,
    toast,
} from '@toolcase/react-components'
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
    const targetOptions = [
        { value: '', label: '➕ Create new note' },
        ...notes.map((n) => ({ value: n.id, label: n.title })),
    ]

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

    return (
        <div className="tf-stack">
            <TabSections
                activeKey={activeTab}
                onChange={onTabChange}
                items={tabKinds.map((k) => ({
                    key: k.kind,
                    label: k.label,
                    content: (
                        <div className="tf-stack-sm" style={{ paddingTop: '1rem' }}>
                            <HelperText text={BUNDLED_HELP[k.kind] ?? helpTexts.agents.custom} />
                            {k.custom && isAdmin && (
                                <div className="tf-actions">
                                    <Button size="small" variant="danger" outline onClick={() => void deleteDef(k.kind)}>
                                        Delete this agent kind
                                    </Button>
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
                                                <Select
                                                    label="Target note"
                                                    options={targetOptions}
                                                    value={targetNote}
                                                    disabled={noteAgentRunning}
                                                    onChange={(e) => setTargetNote(e.target.value)}
                                                />
                                            </div>
                                            <HelperText text={helpTexts.notes.agentTarget} />
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
                    ),
                }))}
            />

            {isAdmin && (
                <Card header={<Heading as="h3">Custom agents (admin)</Heading>}>
                    <div className="tf-card-body tf-stack-sm">
                        <HelperText text={helpTexts.agents.custom} />
                        <div className="tf-form-row">
                            <Input label="Kind (kebab-case)" placeholder="test-writer" value={defKind} onChange={(e) => setDefKind(e.target.value)} />
                            <Input label="Label" placeholder="Test writer" value={defLabel} onChange={(e) => setDefLabel(e.target.value)} />
                            <Select
                                label="Target directory"
                                options={[
                                    { value: 'project', label: 'whole project' },
                                    { value: 'repo', label: 'repo/' },
                                    { value: 'tasks', label: 'tasks/' },
                                    { value: 'knowledge', label: 'knowledge/' },
                                    { value: 'notes', label: 'notes/' },
                                ]}
                                value={defTarget}
                                onChange={(e) => setDefTarget(e.target.value)}
                            />
                            <Select
                                label="Post-processing"
                                options={[
                                    { value: 'none', label: 'none' },
                                    { value: 'tasks', label: 'refresh tasks' },
                                    { value: 'knowledge', label: 'refresh knowledge' },
                                    { value: 'notes', label: 'refresh notes' },
                                ]}
                                value={defPost}
                                onChange={(e) => setDefPost(e.target.value)}
                            />
                        </div>
                        <Textarea
                            label="Prompt preamble (prepended to every prompt)"
                            rows={4}
                            placeholder="You write focused unit tests for the change described below…"
                            value={defPreamble}
                            onChange={(e) => setDefPreamble(e.target.value)}
                        />
                        <div className="tf-actions">
                            <Button
                                variant="primary"
                                loading={savingDef}
                                disabled={savingDef || !defKind.trim() || !defLabel.trim()}
                                onClick={() => void saveDef()}
                            >
                                Save custom agent
                            </Button>
                            <Text variant="muted">Custom agents are global — every project gets the tab.</Text>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    )
}
