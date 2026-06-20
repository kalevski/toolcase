'use client'

import React, { useEffect, useState } from 'react'
import { Badge, Button, StatusDot, TerminalWindow, Text, toast } from '@/components/ui'
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
    const { project, config, agentSessions, agentLines, drafts, setDraft, lastPrompts, busy, modelOptions, onStartAgent, onStopAgent, clearAgentLines } =
        useProject()

    // Custom kinds (C4) may not have a seeded record yet — degrade to idle/empty.
    const session = agentSessions[kind] ?? { status: 'idle' as const, startedAt: null, model: null }
    const lines = agentLines[kind] ?? []
    const draft = drafts[kind] ?? { prompt: '', model: config.defaultModel }
    const running = session.status === 'running'
    const label = AGENT_LABELS[kind] ?? config.agentKinds.find((k) => k.kind === kind)?.label ?? kind

    // 1s ticker for the elapsed label while this agent streams.
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        if (!running) return
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [running])

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
        <div className="tf-stack-sm">
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
                busy={busy}
                running={running}
                onSubmit={() => void onStartAgent(kind, submitOptions?.())}
                onStop={() => void onStopAgent(kind)}
                placeholder={placeholder}
                submitLabel={submitLabel}
            />

            <div className="tf-actions">
                <span className="tf-inline">
                    <StatusDot status={running ? 'busy' : 'offline'} pulse={running} />
                    <Badge variant={running ? 'info' : 'secondary'}>
                        {running ? `running · ${elapsedLabel(session.startedAt, now)}` : 'idle'}
                    </Badge>
                    {session.model && <Badge variant="secondary">{session.model}</Badge>}
                </span>
                <Text variant="muted" style={{ marginLeft: 'auto' }}>
                    {lines.length} line(s)
                </Text>
                <Button size="small" variant="secondary" outline disabled={!lines.length} onClick={onCopyLog} startIcon={<span>⧉</span>}>
                    Copy
                </Button>
                <Button size="small" variant="secondary" outline disabled={!lines.length} onClick={onDownloadLog} startIcon={<span>↓</span>}>
                    Download
                </Button>
                <Button
                    size="small"
                    variant="secondary"
                    outline
                    disabled={!lines.length || running}
                    onClick={() => clearAgentLines(kind)}
                    startIcon={<span>✕</span>}
                >
                    Clear
                </Button>
            </div>

            <TerminalWindow title={`${label.toLowerCase()} — ${project}`} lines={lines} />
        </div>
    )
}
