'use client'

import React, { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { useTc, useTcEvents, useTcProps, detailValue } from '@/lib/tc'
import { toTcLines } from '@/lib/terminal'
import { tcIcon } from '@/lib/icons'
import type { CommitMessageMode } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { ScheduleCard } from './ScheduleCard'
import { helpTexts } from '../helpTexts'

const COMMIT_MODE_OPTIONS = [
    { value: 'taskname', label: 'Task name' },
    { value: 'ai', label: 'AI-generated' },
]

export function RunClient() {
    const {
        project, config, snapshot, lines, running, busy, progressPct, startDisabled, modelOptions,
        model, setModel, warmSession, setWarmSession, commitAfter, setCommitAfter, commitMode, setCommitMode,
        commitModel, setCommitModel, pushAfter, setPushAfter, branchPerRun, setBranchPerRun, review, setReview,
        openPr, setOpenPr, filter, setFilter, severity, setSeverity, projectFilter, setProjectFilter,
        resumeFrom, setResumeFrom, reset, dryRun, setDryRun, matchingCount, willRunCount, clearLines,
        onStart, onStop, onForce, onSkipCurrent, onResetToggle,
    } = useProject()
    const router = useRouter()

    const modelRef = useTcEvents<HTMLElement>({ change: (e) => setModel((e.target as HTMLSelectElement).value) })
    const commitModelRef = useTcEvents<HTMLElement>({ change: (e) => setCommitModel((e.target as HTMLSelectElement).value) })
    const warmRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => setWarmSession(detailValue<boolean>(e)) })
    const commitAfterRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => setCommitAfter(detailValue<boolean>(e)) })
    const branchRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => setBranchPerRun(detailValue<boolean>(e)) })
    const pushRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => setPushAfter(detailValue<boolean>(e)) })
    const openPrRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => setOpenPr(detailValue<boolean>(e)) })
    const reviewRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => setReview(detailValue<boolean>(e)) })
    const resetRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => onResetToggle(detailValue<boolean>(e)) })
    const dryRunRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => setDryRun(detailValue<boolean>(e)) })
    const commitModeRef = useTc<HTMLElement>(
        { options: COMMIT_MODE_OPTIONS },
        { 'tc-change': (e) => setCommitMode(detailValue<string>(e) as CommitMessageMode) },
    )
    const filterRef = useTcEvents<HTMLElement>({ input: (e) => setFilter((e.target as HTMLInputElement).value) })
    const severityRef = useTcEvents<HTMLElement>({ input: (e) => setSeverity((e.target as HTMLInputElement).value) })
    const projectFilterRef = useTcEvents<HTMLElement>({ input: (e) => setProjectFilter((e.target as HTMLInputElement).value) })
    const resumeRef = useTcEvents<HTMLElement>({ input: (e) => setResumeFrom((e.target as HTMLInputElement).value) })
    // Memoize so `tc-terminal-window` only re-renders when lines actually change —
    // toTcLines() returns a fresh array each call, and the terminal does a full
    // innerHTML rebuild on every `lines` property assignment.
    const tcLines = useMemo(() => toTcLines(lines), [lines])
    const termRef = useTcProps<HTMLElement>({ lines: tcLines })

    // Pin the streaming output to the bottom as new lines arrive (the component
    // does not auto-scroll itself).
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
        a.download = `${project}-run.log`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="tf-stack">
            <tc-card>
                <div className="tf-card-body tf-stack">
                    <tc-heading as="h3">Run configuration</tc-heading>
                    <div className="tf-form-row">
                        <div style={{ minWidth: 200 }}>
                            <tc-select ref={modelRef} label="Model" value={model} disabled={busy || undefined}>
                                {modelOptions.map((o) => (
                                    <tc-option key={o.value} value={o.value}>
                                        {o.label}
                                    </tc-option>
                                ))}
                            </tc-select>
                        </div>
                        <tc-tooltip content={helpTexts.run.warmSession}>
                            <span>
                                <tc-switch ref={warmRef} label="Warm session" checked={warmSession || undefined} disabled={busy || undefined} />
                            </span>
                        </tc-tooltip>
                        <tc-tooltip content={helpTexts.run.commitAfter}>
                            <span>
                                <tc-switch ref={commitAfterRef} label="Commit after each task" checked={commitAfter || undefined} disabled={busy || undefined} />
                            </span>
                        </tc-tooltip>
                        {commitAfter && (
                            <>
                                <tc-radio-group ref={commitModeRef} label="Commit message" inline value={commitMode} />
                                {commitMode === 'ai' && (
                                    <div style={{ minWidth: 180 }}>
                                        <tc-select ref={commitModelRef} label="Commit model" value={commitModel} disabled={busy || undefined}>
                                            {modelOptions.map((o) => (
                                                <tc-option key={o.value} value={o.value}>
                                                    {o.label}
                                                </tc-option>
                                            ))}
                                        </tc-select>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div className="tf-form-row">
                        <tc-tooltip content={helpTexts.run.branchPerRun}>
                            <span>
                                <tc-switch ref={branchRef} label="Branch per run" checked={branchPerRun || undefined} disabled={busy || undefined} />
                            </span>
                        </tc-tooltip>
                        <tc-tooltip content={helpTexts.run.pushAfter}>
                            <span>
                                <tc-switch ref={pushRef} label="Push after run" checked={pushAfter || undefined} disabled={busy || !config.canPush || undefined} />
                            </span>
                        </tc-tooltip>
                        {branchPerRun && pushAfter && (
                            <tc-tooltip content={helpTexts.run.openPr}>
                                <span>
                                    <tc-switch ref={openPrRef} label="Open PR" checked={openPr || undefined} disabled={busy || undefined} />
                                </span>
                            </tc-tooltip>
                        )}
                        <tc-tooltip content={helpTexts.run.review}>
                            <span>
                                <tc-switch ref={reviewRef} label="Reviewer pass" checked={review || undefined} disabled={busy || undefined} />
                            </span>
                        </tc-tooltip>
                    </div>
                    <div className="tf-form-row">
                        <tc-input ref={filterRef} label="Task filter" placeholder="substring of path" value={filter} disabled={busy || undefined} />
                        <tc-input ref={severityRef} label="Severity (CSV)" placeholder="high,critical" value={severity} disabled={busy || undefined} />
                        <tc-input ref={projectFilterRef} label="Project (CSV)" placeholder="api,web" value={projectFilter} disabled={busy || undefined} />
                        <tc-input ref={resumeRef} label="Resume from" placeholder="003-" value={resumeFrom} disabled={busy || undefined} />
                        <tc-tooltip content={helpTexts.run.reset}>
                            <span>
                                <tc-switch ref={resetRef} label="Re-run all (reset)" checked={reset || undefined} disabled={busy || undefined} />
                            </span>
                        </tc-tooltip>
                        <tc-tooltip content={helpTexts.run.dryRun}>
                            <span>
                                <tc-switch ref={dryRunRef} label="Preview (dry run)" checked={dryRun || undefined} disabled={busy || undefined} />
                            </span>
                        </tc-tooltip>
                    </div>

                    <tc-helper-text text={helpTexts.run.filter} />

                    <tc-text variant="muted">
                        {matchingCount === 0
                            ? 'No tasks match the current selection.'
                            : `${matchingCount} task(s) match · ${willRunCount} will run${reset ? ' (reset)' : ''}.`}
                    </tc-text>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <tc-button variant="success" onClick={onStart} disabled={startDisabled || undefined}>
                            <span>▶</span> Start
                        </tc-button>
                        {running && (
                            <>
                                <tc-icon-button icon={tcIcon('pause')} label="Stop after current" variant="warning" outline disabled={snapshot.state === 'STOPPING' || undefined} onClick={onStop} />
                                <tc-icon-button icon={tcIcon('skip-forward')} label="Skip current task" variant="warning" disabled={snapshot.state !== 'RUNNING' || undefined} onClick={onSkipCurrent} />
                                <tc-icon-button icon={tcIcon('stop-fill')} label="Force stop" variant="danger" onClick={onForce} />
                            </>
                        )}
                        <div style={{ flex: 1 }}>
                            <tc-progress-bar value={progressPct} variant={snapshot.error > 0 ? 'warning' : 'success'} />
                            <tc-text variant="muted" style={{ fontSize: '0.8rem', display: 'block', marginTop: '0.15rem' }}>
                                {snapshot.done} / {snapshot.total} done{snapshot.error ? ` · ${snapshot.error} error` : ''}
                            </tc-text>
                        </div>
                        <tc-badge variant={running ? 'info' : 'secondary'}>{snapshot.state}</tc-badge>
                        <tc-tooltip content={helpTexts.run.history}>
                            <tc-button size="sm" variant="secondary" outline onClick={() => router.push(`/projects/${project}/runs`)}>
                                ⏱ Run history
                            </tc-button>
                        </tc-tooltip>
                    </div>
                </div>
            </tc-card>

            <ScheduleCard />

            <div className="tf-stack-sm">
                <div className="tf-actions" style={{ justifyContent: 'flex-end' }}>
                    <tc-text variant="muted" style={{ marginRight: 'auto' }}>
                        {lines.length} line(s)
                    </tc-text>
                    <tc-button size="sm" variant="secondary" outline disabled={!lines.length || undefined} onClick={onCopyLog}>
                        <span>⧉</span> Copy
                    </tc-button>
                    <tc-button size="sm" variant="secondary" outline disabled={!lines.length || undefined} onClick={onDownloadLog}>
                        <span>↓</span> Download
                    </tc-button>
                    <tc-button size="sm" variant="secondary" outline disabled={!lines.length || running || undefined} onClick={clearLines}>
                        <span>✕</span> Clear
                    </tc-button>
                </div>
                <tc-terminal-window ref={termRef} title={`run — ${project}`} />
            </div>
        </div>
    )
}
