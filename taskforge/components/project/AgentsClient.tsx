'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/lib/toast'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { useTc, useTcEvents } from '@/lib/tc'
import type { TabBarItem } from '@toolcase/web-components'
import type { AgentKind } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { useConfirm } from '../ConfirmModal'
import { helpTexts } from '../helpTexts'
import { AgentPanel } from './AgentPanel'

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

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

    // T3 — agent-kind tabs render as a tc-tab-bar (was a Bootstrap nav-tabs)
    // matching the project tab-bar pattern. Selection still lives in ?tab= so the
    // activity bar can deep-link to a running agent.
    const tabItems = useMemo<TabBarItem[]>(() => tabKinds.map((k) => ({ id: k.kind, label: k.label })), [tabKinds])
    const tabBarRef = useTc<HTMLElement>(
        useMemo(() => ({ tabs: tabItems, activeId: activeTab }), [tabItems, activeTab]),
        { 'tc-change': (e: Event) => onTabChange((e as CustomEvent).detail?.id as string) },
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
        const kind = defKind.trim()
        if (!SLUG_RE.test(kind)) {
            toast.error('Use lowercase letters, digits and dashes.')
            return
        }
        setSavingDef(true)
        try {
            await apiFetch('/api/agent-defs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kind,
                    label: defLabel.trim(),
                    target: defTarget,
                    post: defPost,
                    promptPreamble: defPreamble,
                }),
            })
            toast.success(`Agent “${kind}” saved — its tab is ready`)
            router.refresh()
        } catch (e) {
            toast.error(describeApiError(e))
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
        try {
            await apiFetch(`/api/agent-defs/${kind}`, { method: 'DELETE' })
        } catch (e) {
            toast.error(describeApiError(e))
            return
        }
        toast.success(`Deleted “${kind}”`)
        router.refresh()
    }

    // The tab strip is a tc-tab-bar (T3); the active panel — which hosts live
    // React (AgentPanel) — is rendered below it (tc-tab-sections would force the
    // panel content into a managed string slot, so we drive the panel ourselves).
    const active = tabKinds.find((k) => k.kind === activeTab)

    const renderPanel = (k: (typeof tabKinds)[number]) => (
        // key by kind: switching tabs must REMOUNT the panel, not reuse it. The
        // panel's tc-* elements relocate their light-DOM children on connect, so
        // letting React mutate a reused tc-button's children (e.g. a changed submit
        // label/icon across tabs) corrupts the render. A fresh mount per tab gives
        // each tc-button a clean connectedCallback. Draft/terminal state lives in
        // ProjectContext (keyed by kind), so remounting loses nothing.
        <tc-stack
            key={k.kind}
            gap="0.75rem"
            style={{ paddingTop: '1rem' }}
            id={`agent-panel-${k.kind}`}
            role="tabpanel"
        >
            <tc-helper-text text={BUNDLED_HELP[k.kind] ?? helpTexts.agents.custom} />
            {k.custom && isAdmin && (
                <tc-stack direction="horizontal" gap="0.75rem" wrap align="center">
                    <tc-button size="sm" variant="danger" outline onClick={() => void deleteDef(k.kind)}>
                        Delete this agent kind
                    </tc-button>
                </tc-stack>
            )}
            {k.kind === 'note-writer' ? (
                <AgentPanel
                    kind="note-writer"
                    placeholder={BUNDLED_PLACEHOLDER['note-writer']}
                    submitLabel={targetNote ? 'Edit note' : 'Create note'}
                    submitOptions={() => ({ targetNote: targetNote || undefined })}
                    beforeComposer={
                        <tc-stack gap="0.75rem">
                            <div style={{ maxWidth: 320 }}>
                                <tc-select
                                    ref={noteTargetRef}
                                    label="Target note"
                                    value={targetNote}
                                    disabled={noteAgentRunning || undefined}
                                >
                                    <tc-option value="">Create new note</tc-option>
                                    {notes.map((n) => (
                                        <tc-option key={n.id} value={n.id}>
                                            {n.title}
                                        </tc-option>
                                    ))}
                                </tc-select>
                            </div>
                            <tc-helper-text text={helpTexts.notes.agentTarget} />
                        </tc-stack>
                    }
                />
            ) : (
                <AgentPanel
                    kind={k.kind}
                    placeholder={BUNDLED_PLACEHOLDER[k.kind] ?? `Instructions for the ${k.label} agent…`}
                    submitLabel={BUNDLED_SUBMIT[k.kind] ?? 'Run agent'}
                />
            )}
        </tc-stack>
    )

    return (
        <div className="taskforge-page">
            <div>
                <div className="tf-project-tabs">
                    <tc-tab-bar ref={tabBarRef} />
                </div>
                {active && renderPanel(active)}
            </div>

            {isAdmin && (
                <tc-card>
                    <tc-heading slot="header" as="h3">
                        Custom agents (admin)
                    </tc-heading>
                    <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                        <tc-helper-text text={helpTexts.agents.custom} />
                        <tc-stack direction="horizontal" gap="1rem" wrap align="flex-end">
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
                        </tc-stack>
                        <tc-textarea
                            ref={preambleRef}
                            label="Prompt preamble (prepended to every prompt)"
                            rows={4}
                            placeholder="You write focused unit tests for the change described below…"
                            value={defPreamble}
                        />
                        <tc-stack direction="horizontal" gap="0.75rem" wrap align="center">
                            <tc-button
                                variant="primary"
                                loading={savingDef || undefined}
                                disabled={savingDef || !defKind.trim() || !defLabel.trim() || undefined}
                                onClick={() => void saveDef()}
                            >
                                Save custom agent
                            </tc-button>
                            <tc-text variant="muted">Custom agents are global — every project gets the tab.</tc-text>
                        </tc-stack>
                    </tc-stack>
                </tc-card>
            )}
        </div>
    )
}
