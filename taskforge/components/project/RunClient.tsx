'use client'

import React from 'react'
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
    AnnouncementBar,
    TerminalWindow,
    toast,
} from '@toolcase/react-components'
import type { CommitMessageMode } from '@/server/types'
import { useProject } from '../ProjectContext'

export function RunClient() {
    const {
        project,
        snapshot,
        lines,
        wakeAt,
        running,
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
        onResetToggle,
    } = useProject()

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
            {snapshot.state === 'SLEEPING' && wakeAt && (
                <AnnouncementBar
                    variant="warning"
                    iconName="moon"
                    message={`Usage limit hit — sleeping until ~${new Date(wakeAt).toLocaleTimeString()}, will resume the current task.`}
                />
            )}

            <Card>
                <div className="tf-card-body tf-stack">
                    <Heading as="h3">Run configuration</Heading>
                    <div className="tf-form-row">
                        <div style={{ minWidth: 200 }}>
                            <Select
                                label="Model"
                                options={modelOptions}
                                value={model}
                                disabled={running}
                                onChange={(e) => setModel(e.target.value)}
                            />
                        </div>
                        <Switch
                            label="Warm session"
                            checked={warmSession}
                            disabled={running}
                            onChange={(e) => setWarmSession(e.target.checked)}
                        />
                        <Switch
                            label="Commit after each task"
                            checked={commitAfter}
                            disabled={running}
                            onChange={(e) => setCommitAfter(e.target.checked)}
                        />
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
                                            disabled={running}
                                            onChange={(e) => setCommitModel(e.target.value)}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div className="tf-form-row">
                        <Input
                            label="Task filter"
                            placeholder="substring of path"
                            value={filter}
                            disabled={running}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                        <Input
                            label="Severity (CSV)"
                            placeholder="high,critical"
                            value={severity}
                            disabled={running}
                            onChange={(e) => setSeverity(e.target.value)}
                        />
                        <Input
                            label="Project (CSV)"
                            placeholder="api,web"
                            value={projectFilter}
                            disabled={running}
                            onChange={(e) => setProjectFilter(e.target.value)}
                        />
                        <Input
                            label="Resume from"
                            placeholder="003-"
                            value={resumeFrom}
                            disabled={running}
                            onChange={(e) => setResumeFrom(e.target.value)}
                        />
                        <Switch
                            label="Re-run all (reset)"
                            checked={reset}
                            disabled={running}
                            onChange={(e) => onResetToggle(e.target.checked)}
                        />
                        <Switch
                            label="Preview (dry run)"
                            checked={dryRun}
                            disabled={running}
                            onChange={(e) => setDryRun(e.target.checked)}
                        />
                    </div>

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
                    </div>
                </div>
            </Card>

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
