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
        <div className="tf-repo-header">
            <tc-breadcrumb>
                <tc-breadcrumb-item href="/" onClick={nav('/')}>
                    Projects
                </tc-breadcrumb-item>
                <tc-breadcrumb-item href={`/projects/${project}`} onClick={nav(`/projects/${project}`)}>
                    {project}
                </tc-breadcrumb-item>
                <tc-breadcrumb-item active>{subLabel}</tc-breadcrumb-item>
            </tc-breadcrumb>

            <div className="tf-repo-header__bar">
                <div className="tf-repo-header__title">
                    <tc-heading as="h1">{project}</tc-heading>
                    <span className="tf-repo-header__status">
                        <tc-status-dot status={STATE_DOT[snapshot.state]} pulse={snapshot.state === 'RUNNING' || undefined} />
                        <tc-badge variant={STATE_BADGE[snapshot.state]}>{snapshot.state}</tc-badge>
                    </span>
                    {git?.branch && <tc-badge variant="secondary">⎇ {git.branch}</tc-badge>}
                </div>

                {running && (
                    <div className="tf-repo-header__actions">
                        <tc-icon-button
                            icon={tcIcon('pause')}
                            label="Stop after current"
                            variant="warning"
                            outline
                            disabled={snapshot.state === 'STOPPING' || undefined}
                            onClick={onStop}
                        />
                        <tc-icon-button icon={tcIcon('stop-fill')} label="Force stop" variant="danger" onClick={onForce} />
                    </div>
                )}
            </div>

            {running && (
                <div className="tf-repo-header__progress">
                    <tc-progress-bar value={progressPct} variant={snapshot.error > 0 ? 'warning' : 'success'} />
                    <tc-text variant="muted" style={{ fontSize: '0.8rem', display: 'block', marginTop: '0.15rem' }}>
                        {snapshot.done} / {snapshot.total} done{snapshot.error ? ` · ${snapshot.error} error` : ''}
                    </tc-text>
                </div>
            )}
        </div>
    )
}
