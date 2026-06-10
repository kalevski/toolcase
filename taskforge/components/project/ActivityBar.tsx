'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { AnnouncementBar, IconButton } from '@toolcase/react-components'
import type { AgentKind } from '@/server/domain/types'
import { useProject, AGENT_LABELS } from '../ProjectContext'

/**
 * Global per-project activity bar (§3.8): rendered above the header on every
 * project sub-page. Shows the single Claude process currently holding the
 * project (sleep notice > executor > agent session) and deep-links to its page.
 * The whole bar is clickable (router.push keeps the SSE connection); the inline
 * controls (§5) stop/skip without leaving the current page.
 */
export function ActivityBar() {
    const router = useRouter()
    const { project, config, snapshot, wakeAt, running, agentSessions, onSkipCurrent, onForce, onStopAgent } = useProject()

    const go = (href: string) => (e: React.MouseEvent) => {
        e.preventDefault()
        router.push(href)
    }

    // 1) usage-limit sleep (moved out of RunClient so every sub-page shows it)
    if (snapshot.state === 'SLEEPING' && wakeAt) {
        const href = `/projects/${project}/run`
        return (
            <div className="tf-activity-bar" onClick={go(href)}>
                <AnnouncementBar
                    variant="warning"
                    iconName="moon"
                    message={`Usage limit — sleeping until ~${new Date(wakeAt).toLocaleTimeString()}, will resume the current task.`}
                    ctaLabel="View run"
                    ctaHref={href}
                />
            </div>
        )
    }

    // 2) the task executor
    if (running) {
        const href = `/projects/${project}/run`
        return (
            <div className="tf-activity-bar" onClick={go(href)}>
                <AnnouncementBar
                    variant="info"
                    iconName="play-circle"
                    message={
                        <span className="tf-activity-bar__message">
                            <span>
                                Task executor running — {snapshot.current ?? '…'} ({snapshot.done}/{snapshot.total}{' '}
                                done)
                            </span>
                            <span className="tf-activity-bar__controls" onClick={(e) => e.stopPropagation()}>
                                <IconButton
                                    icon="skip-forward"
                                    label="Skip current task"
                                    variant="warning"
                                    outline
                                    disabled={snapshot.state !== 'RUNNING'}
                                    onClick={() => void onSkipCurrent()}
                                />
                                <IconButton
                                    icon="stop-fill"
                                    label="Force stop run"
                                    variant="danger"
                                    outline
                                    onClick={() => void onForce()}
                                />
                            </span>
                        </span>
                    }
                    ctaLabel="View run"
                    ctaHref={href}
                />
            </div>
        )
    }

    // 3) one-shot agent sessions (bundled + custom kinds, C4)
    const kinds: AgentKind[] = Object.keys(agentSessions)
    for (const kind of kinds) {
        if (agentSessions[kind]?.status !== 'running') continue
        const label = AGENT_LABELS[kind] ?? config.agentKinds.find((k) => k.kind === kind)?.label ?? kind
        const href = `/projects/${project}/agents?tab=${kind}`
        return (
            <div className="tf-activity-bar" onClick={go(href)}>
                <AnnouncementBar
                    variant="info"
                    iconName="robot"
                    message={
                        <span className="tf-activity-bar__message">
                            <span>{label} agent running…</span>
                            <span className="tf-activity-bar__controls" onClick={(e) => e.stopPropagation()}>
                                <IconButton
                                    icon="stop-fill"
                                    label={`Kill ${label.toLowerCase()}`}
                                    variant="danger"
                                    outline
                                    onClick={() => void onStopAgent(kind)}
                                />
                            </span>
                        </span>
                    }
                    ctaLabel="View output"
                    ctaHref={href}
                />
            </div>
        )
    }

    return null
}
