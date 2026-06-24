'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from '@/lib/toast'
import { useTcProps } from '@/lib/tc'
import { toTcLines } from '@/lib/terminal'
import type { AgentKind } from '@/server/domain/types'
import { useProject, AGENT_LABELS } from '../ProjectContext'
import { PromptComposer } from './PromptComposer'

function elapsedLabel(startedAt: number | null, now: number): string {
    if (!startedAt) return ''
    const s = Math.max(0, Math.floor((now - startedAt) / 1000))
    const m = Math.floor(s / 60)
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

/**
 * One agent's full panel: PromptComposer on top, then the status row (state dot,
 * elapsed, model, copy/download/clear) and the streaming TerminalWindow fed from
 * `agentLines[kind]`. `beforeComposer` hosts extra controls (the Notes page's
 * target-note select); `submitOptions` is forwarded to `onStartAgent`.
 */
export function AgentPanel({
    kind,
    placeholder,
    submitLabel,
    beforeComposer,
    submitOptions,
}: {
    kind: AgentKind
    placeholder: string
    submitLabel: string
    beforeComposer?: React.ReactNode
    submitOptions?: () => { targetNote?: string }
}) {
    const { project, config, agentSessions, agentLines, drafts, setDraft, lastPrompts, running: executorRunning, modelOptions, onStartAgent, onStopAgent, clearAgentLines } =
        useProject()

    // Custom kinds (C4) may not have a seeded record yet — degrade to idle/empty.
    const session = agentSessions[kind] ?? { status: 'idle' as const, startedAt: null, model: null }
    // Stable identity so the terminal memo below only changes when this kind's
    // lines change (not on the 1s elapsed-ticker re-render).
    const lines = useMemo(() => agentLines[kind] ?? [], [agentLines, kind])
    const draft = drafts[kind] ?? { prompt: '', model: config.defaultModel }
    const running = session.status === 'running'

    // What locks THIS composer: another agent session (one agent at a time), or —
    // for the task-creator only — an executing run (it writes tasks/ the executor
    // is iterating). Knowledge/notes/custom composers stay usable during a run.
    const otherAgentRunning = Object.entries(agentSessions).some(([k, s]) => k !== kind && s.status === 'running')
    const lockedByOther = otherAgentRunning || (executorRunning && kind === 'task-creator')
    const label = AGENT_LABELS[kind] ?? config.agentKinds.find((k) => k.kind === kind)?.label ?? kind

    // 1s ticker for the elapsed label while this agent streams.
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        if (!running) return
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [running])

    // tc-terminal-window takes its lines as a JS property (array, not attribute),
    // in its own {type,text} shape. Memoize: toTcLines() returns a fresh array
    // every call, and the 1s elapsed ticker re-renders this panel each second —
    // without memoization the terminal would rebuild + reset scroll every tick.
    const tcLines = useMemo(() => toTcLines(lines), [lines])
    const termRef = useTcProps<HTMLElement>({ lines: tcLines })

    // Pin the streaming output to the bottom as new lines arrive.
    useEffect(() => {
        const body = termRef.current?.querySelector('.tc-terminal-window-body')
        if (body) body.scrollTop = body.scrollHeight
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tcLines])

    const logText = () => lines.map((l) => l.text).join('\n')

    const onCopyLog = async () => {
        try {
            await navigator.clipboard.writeText(logText())
            toast.success('Log copied to clipboard')
        } catch {
            toast.error('Clipboard unavailable')
        }
    }

    const onDownloadLog = () => {
        const blob = new Blob([logText()], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${project}-${kind}.log`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <tc-stack gap="0.75rem">
            {beforeComposer}
            <PromptComposer
                project={project}
                agentKind={kind}
                value={draft.prompt}
                onChange={(v) => setDraft(kind, { prompt: v })}
                model={draft.model}
                onModelChange={(v) => setDraft(kind, { model: v })}
                modelOptions={modelOptions}
                lastPrompt={lastPrompts[kind] ?? null}
                lockedByOther={lockedByOther}
                running={running}
                onSubmit={() => void onStartAgent(kind, submitOptions?.())}
                onStop={() => void onStopAgent(kind)}
                placeholder={placeholder}
                submitLabel={submitLabel}
            />

            <tc-stack direction="horizontal" gap="0.75rem" wrap align="center">
                <tc-stack inline direction="horizontal" gap="0.4rem" align="center">
                    <tc-status-dot status={running ? 'busy' : 'offline'} pulse={running || undefined} />
                    <tc-badge variant={running ? 'info' : 'secondary'}>
                        {running ? `running · ${elapsedLabel(session.startedAt, now)}` : 'idle'}
                    </tc-badge>
                    {session.model && <tc-badge variant="secondary">{session.model}</tc-badge>}
                </tc-stack>
                <tc-text variant="muted" style={{ marginLeft: 'auto' }}>
                    {lines.length} line(s)
                </tc-text>
                <tc-button size="sm" variant="secondary" outline disabled={!lines.length || undefined} onClick={onCopyLog}>
                    <tc-icon name="Copy" /> Copy
                </tc-button>
                <tc-button size="sm" variant="secondary" outline disabled={!lines.length || undefined} onClick={onDownloadLog}>
                    <tc-icon name="Download" /> Download
                </tc-button>
                <tc-button
                    size="sm"
                    variant="secondary"
                    outline
                    disabled={!lines.length || running || undefined}
                    onClick={() => clearAgentLines(kind)}
                >
                    <tc-icon name="X" /> Clear
                </tc-button>
            </tc-stack>

            <tc-terminal-window ref={termRef} title={`${label.toLowerCase()} — ${project}`} />
        </tc-stack>
    )
}
