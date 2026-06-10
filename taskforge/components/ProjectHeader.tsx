'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Breadcrumb, Heading, Badge, StatusDot, IconButton, ProgressBar } from '@toolcase/react-components'
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

    return (
        <div className="tf-repo-header">
            <Breadcrumb
                items={[
                    { label: 'Projects', onClick: () => router.push('/') },
                    { label: project, onClick: () => router.push(`/projects/${project}`) },
                    { label: subLabel },
                ]}
            />

            <div className="tf-repo-header__bar">
                <div className="tf-repo-header__title">
                    <Heading as="h1">{project}</Heading>
                    <span className="tf-repo-header__status">
                        <StatusDot status={STATE_DOT[snapshot.state]} pulse={snapshot.state === 'RUNNING'} />
                        <Badge variant={STATE_BADGE[snapshot.state]}>{snapshot.state}</Badge>
                    </span>
                    {git?.branch && <Badge variant="secondary">⎇ {git.branch}</Badge>}
                </div>

                {running && (
                    <div className="tf-repo-header__actions">
                        <IconButton
                            icon="pause"
                            label="Stop after current"
                            variant="warning"
                            outline
                            disabled={snapshot.state === 'STOPPING'}
                            onClick={onStop}
                        />
                        <IconButton icon="stop-fill" label="Force stop" variant="danger" onClick={onForce} />
                    </div>
                )}
            </div>

            {running && (
                <ProgressBar
                    value={progressPct}
                    variant={snapshot.error > 0 ? 'warning' : 'success'}
                    label={`${snapshot.done} / ${snapshot.total} done${snapshot.error ? ` · ${snapshot.error} error` : ''}`}
                />
            )}
        </div>
    )
}
