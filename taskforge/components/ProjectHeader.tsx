'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { tcIcon } from '@/lib/icons'
import type { EngineState } from '@/server/domain/types'
import { useProject } from './ProjectContext'

const STATE_DOT: Record<EngineState, 'online' | 'offline' | 'busy' | 'away'> = {
    RUNNING: 'busy',
    SLEEPING: 'away',
    STOPPING: 'away',
    IDLE: 'offline',
}

const STATE_BADGE: Record<EngineState, 'info' | 'success' | 'warning' | 'secondary'> = {
    RUNNING: 'info',
    SLEEPING: 'warning',
    STOPPING: 'warning',
    IDLE: 'secondary',
}

// Icon-tile tint on the rich page header, keyed off engine state.
const STATE_ICON_COLOR: Record<EngineState, 'cyan' | 'amber' | 'slate'> = {
    RUNNING: 'cyan',
    SLEEPING: 'amber',
    STOPPING: 'amber',
    IDLE: 'slate',
}

const SUB_LABEL: Record<string, string> = {
    overview: 'Overview',
    tasks: 'Tasks',
    agents: 'Agents',
    knowledge: 'Knowledge',
    notes: 'Notes',
    run: 'Run',
    runs: 'Run history',
    git: 'Git',
    settings: 'Settings',
}

export function ProjectHeader() {
    const router = useRouter()
    const pathname = usePathname()
    const { project, snapshot, git, running, progressPct, onStop, onForce } = useProject()

    const m = pathname.match(/^\/projects\/[^/]+(?:\/(tasks|knowledge|notes|runs|run|git|agents|settings))?\/?$/)
    const subKey = m?.[1] ?? 'overview'
    const subLabel = SUB_LABEL[subKey]

    const nav = (href: string) => (e: React.MouseEvent) => {
        e.preventDefault()
        router.push(href)
    }

    return (
        <tc-stack gap="0.75rem" style={{ marginBottom: '1.25rem' }}>
            <tc-breadcrumb>
                <tc-breadcrumb-item href="/" onClick={nav('/')}>
                    Projects
                </tc-breadcrumb-item>
                <tc-breadcrumb-item href={`/projects/${project}`} onClick={nav(`/projects/${project}`)}>
                    {project}
                </tc-breadcrumb-item>
                <tc-breadcrumb-item active>{subLabel}</tc-breadcrumb-item>
            </tc-breadcrumb>

            <tc-rich-page-header
                title-text={project}
                sub={subLabel}
                icon-name="FolderGit2"
                icon-color={STATE_ICON_COLOR[snapshot.state]}
            >
                <tc-stack slot="chips" inline direction="horizontal" gap="0.4rem" align="center">
                    <tc-status-dot status={STATE_DOT[snapshot.state]} pulse={snapshot.state === 'RUNNING' || undefined} />
                    <tc-badge variant={STATE_BADGE[snapshot.state]}>{snapshot.state}</tc-badge>
                </tc-stack>
                {git?.branch && (
                    <tc-badge slot="chips" variant="secondary">
                        <tc-icon name="GitBranch" /> {git.branch}
                    </tc-badge>
                )}

                {running && (
                    <tc-icon-button
                        slot="actions"
                        icon={tcIcon('pause')}
                        label="Stop after current"
                        variant="warning"
                        outline
                        disabled={snapshot.state === 'STOPPING' || undefined}
                        onClick={onStop}
                    />
                )}
                {running && (
                    <tc-icon-button slot="actions" icon={tcIcon('stop-fill')} label="Force stop" variant="danger" onClick={onForce} />
                )}
            </tc-rich-page-header>

            {running && (
                <div>
                    <tc-progress-bar value={progressPct} variant={snapshot.error > 0 ? 'warning' : 'success'} />
                    <tc-text variant="muted" style={{ fontSize: '0.8rem', display: 'block', marginTop: '0.15rem' }}>
                        {snapshot.done} / {snapshot.total} done{snapshot.error ? ` · ${snapshot.error} error` : ''}
                    </tc-text>
                </div>
            )}
        </tc-stack>
    )
}
