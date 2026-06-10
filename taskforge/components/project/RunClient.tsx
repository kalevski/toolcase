'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
    Card,
    Heading,
    Text,
    Select,
    Switch,
    RadioGroup,
    Input,
    Button,
    IconButton,
    ProgressBar,
    Badge,
    HelperText,
    Tooltip,
    TerminalWindow,
    toast,
} from '@toolcase/react-components'
import type { CommitMessageMode } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { ScheduleCard } from './ScheduleCard'
import { helpTexts } from '../helpTexts'

export function RunClient() {
    const {
        project,
        config,
        snapshot,
        lines,
        running,
        busy,
        progressPct,
        startDisabled,
        modelOptions,
        model,
        setModel,
        warmSession,
        setWarmSession,
        commitAfter,
        setCommitAfter,
        commitMode,
        setCommitMode,
        commitModel,
        setCommitModel,
        pushAfter,
        setPushAfter,
        branchPerRun,
        setBranchPerRun,
        review,
        setReview,
        openPr,
        setOpenPr,
        filter,
        setFilter,
        severity,
        setSeverity,
        projectFilter,
        setProjectFilter,
        resumeFrom,
        setResumeFrom,
        reset,
        dryRun,
        setDryRun,
        matchingCount,
        willRunCount,
        clearLines,
        onStart,
        onStop,
        onForce,
        onSkipCurrent,
        onResetToggle,
    } = useProject()
    const router = useRouter()

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
            <Card>
                <div className="tf-card-body tf-stack">
                    <Heading as="h3">Run configuration</Heading>
                    <div className="tf-form-row">
                        <div style={{ minWidth: 200 }}>
                            <Select
                                label="Model"
                                options={modelOptions}
                                value={model}
                                disabled={busy}
                                onChange={(e) => setModel(e.target.value)}
                            />
                        </div>
                        <Tooltip content={helpTexts.run.warmSession}>
                            <span>
                                <Switch
                                    label="Warm session"
                                    checked={warmSession}
                                    disabled={busy}
                                    onChange={(e) => setWarmSession(e.target.checked)}
                                />
                            </span>
                        </Tooltip>
                        <Tooltip content={helpTexts.run.commitAfter}>
                            <span>
                                <Switch
                                    label="Commit after each task"
                                    checked={commitAfter}
                                    disabled={busy}
                                    onChange={(e) => setCommitAfter(e.target.checked)}
                                />
                            </span>
                        </Tooltip>
                        {commitAfter && (
                            <>
                                <RadioGroup
                                    label="Commit message"
                                    inline
                                    value={commitMode}
                                    options={[
                                        { value: 'taskname', label: 'Task name' },
                                        { value: 'ai', label: 'AI-generated' },
                                    ]}
                                    onChange={(v) => setCommitMode(v as CommitMessageMode)}
                                />
                                {commitMode === 'ai' && (
                                    <div style={{ minWidth: 180 }}>
                                        <Select
                                            label="Commit model"
                                            options={modelOptions}
                                            value={commitModel}
                                            disabled={busy}
                                            onChange={(e) => setCommitModel(e.target.value)}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div className="tf-form-row">
                        <Tooltip content={helpTexts.run.branchPerRun}>
                            <span>
                                <Switch
                                    label="Branch per run"
                                    checked={branchPerRun}
                                    disabled={busy}
                                    onChange={(e) => setBranchPerRun(e.target.checked)}
                                />
                            </span>
                        </Tooltip>
                        <Tooltip content={helpTexts.run.pushAfter}>
                            <span>
                                <Switch
                                    label="Push after run"
                                    checked={pushAfter}
                                    disabled={busy || !config.canPush}
                                    onChange={(e) => setPushAfter(e.target.checked)}
                                />
                            </span>
                        </Tooltip>
                        {branchPerRun && pushAfter && (
                            <Tooltip content={helpTexts.run.openPr}>
                                <span>
                                    <Switch
                                        label="Open PR"
                                        checked={openPr}
                                        disabled={busy}
                                        onChange={(e) => setOpenPr(e.target.checked)}
                                    />
                                </span>
                            </Tooltip>
                        )}
                        <Tooltip content={helpTexts.run.review}>
                            <span>
                                <Switch
                                    label="Reviewer pass"
                                    checked={review}
                                    disabled={busy}
                                    onChange={(e) => setReview(e.target.checked)}
                                />
                            </span>
                        </Tooltip>
                    </div>
                    <div className="tf-form-row">
                        <Input
                            label="Task filter"
                            placeholder="substring of path"
                            value={filter}
                            disabled={busy}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                        <Input
                            label="Severity (CSV)"
                            placeholder="high,critical"
                            value={severity}
                            disabled={busy}
                            onChange={(e) => setSeverity(e.target.value)}
                        />
                        <Input
                            label="Project (CSV)"
                            placeholder="api,web"
                            value={projectFilter}
                            disabled={busy}
                            onChange={(e) => setProjectFilter(e.target.value)}
                        />
                        <Input
                            label="Resume from"
                            placeholder="003-"
                            value={resumeFrom}
                            disabled={busy}
                            onChange={(e) => setResumeFrom(e.target.value)}
                        />
                        <Tooltip content={helpTexts.run.reset}>
                            <span>
                                <Switch
                                    label="Re-run all (reset)"
                                    checked={reset}
                                    disabled={busy}
                                    onChange={(e) => onResetToggle(e.target.checked)}
                                />
                            </span>
                        </Tooltip>
                        <Tooltip content={helpTexts.run.dryRun}>
                            <span>
                                <Switch
                                    label="Preview (dry run)"
                                    checked={dryRun}
                                    disabled={busy}
                                    onChange={(e) => setDryRun(e.target.checked)}
                                />
                            </span>
                        </Tooltip>
                    </div>

                    <HelperText text={helpTexts.run.filter} />

                    <Text variant="muted">
                        {matchingCount === 0
                            ? 'No tasks match the current selection.'
                            : `${matchingCount} task(s) match · ${willRunCount} will run${reset ? ' (reset)' : ''}.`}
                    </Text>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <Button variant="success" onClick={onStart} disabled={startDisabled} startIcon={<span>▶</span>}>
                            Start
                        </Button>
                        {running && (
                            <>
                                <IconButton
                                    icon="pause"
                                    label="Stop after current"
                                    variant="warning"
                                    outline
                                    disabled={snapshot.state === 'STOPPING'}
                                    onClick={onStop}
                                />
                                <IconButton
                                    icon="skip-forward"
                                    label="Skip current task"
                                    variant="warning"
                                    disabled={snapshot.state !== 'RUNNING'}
                                    onClick={onSkipCurrent}
                                />
                                <IconButton icon="stop-fill" label="Force stop" variant="danger" onClick={onForce} />
                            </>
                        )}
                        <div style={{ flex: 1 }}>
                            <ProgressBar
                                value={progressPct}
                                variant={snapshot.error > 0 ? 'warning' : 'success'}
                                label={`${snapshot.done} / ${snapshot.total} done${snapshot.error ? ` · ${snapshot.error} error` : ''}`}
                            />
                        </div>
                        <Badge variant={running ? 'info' : 'secondary'}>{snapshot.state}</Badge>
                        <Tooltip content={helpTexts.run.history}>
                            <Button size="small" variant="secondary" outline onClick={() => router.push(`/projects/${project}/runs`)}>
                                ⏱ Run history
                            </Button>
                        </Tooltip>
                    </div>
                </div>
            </Card>

            <ScheduleCard />

            <div className="tf-stack-sm">
                <div className="tf-actions" style={{ justifyContent: 'flex-end' }}>
                    <Text variant="muted" style={{ marginRight: 'auto' }}>
                        {lines.length} line(s)
                    </Text>
                    <Button size="small" variant="secondary" outline disabled={!lines.length} onClick={onCopyLog} startIcon={<span>⧉</span>}>
                        Copy
                    </Button>
                    <Button size="small" variant="secondary" outline disabled={!lines.length} onClick={onDownloadLog} startIcon={<span>↓</span>}>
                        Download
                    </Button>
                    <Button size="small" variant="secondary" outline disabled={!lines.length || running} onClick={clearLines} startIcon={<span>✕</span>}>
                        Clear
                    </Button>
                </div>
                <TerminalWindow title={`run — ${project}`} lines={lines} />
            </div>
        </div>
    )
}
