'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MetricGrid, Card, Heading, Text, Button, Badge, StatusDot, EmptyState, toast } from '@toolcase/react-components'
import { useProject } from '../ProjectContext'

export function OverviewClient() {
    const router = useRouter()
    const { project, tasks, git, snapshot, wakeAt } = useProject()

    const [generating, setGenerating] = useState(false)
    const generateClaudeMd = async () => {
        setGenerating(true)
        try {
            const res = await fetch(`/api/projects/${project}/claude-md`, { method: 'POST' })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error ?? 'Failed to generate CLAUDE.md')
                return
            }
            toast.success('Generated CLAUDE.md')
        } catch {
            toast.error('Failed to generate CLAUDE.md')
        } finally {
            setGenerating(false)
        }
    }

    const total = tasks.length
    const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'running').length
    const done = tasks.filter((t) => t.status === 'done').length
    const error = tasks.filter((t) => t.status === 'error').length

    return (
        <div className="tf-stack">
            <MetricGrid
                columns={4}
                items={[
                    { key: 'total', label: 'Tasks', value: total, icon: 'list-task' },
                    { key: 'pending', label: 'Pending', value: pending, icon: 'hourglass-split' },
                    { key: 'done', label: 'Done', value: done, icon: 'check-circle' },
                    { key: 'error', label: 'Errors', value: error, icon: 'exclamation-octagon' },
                ]}
            />

            <div className="tf-grid-2">
                <Card header={<Heading as="h3">Git</Heading>}>
                    <div className="tf-card-body tf-stack-sm">
                        {git ? (
                            <>
                                <div className="tf-kv">
                                    <span>Branch</span>
                                    <Badge variant="secondary">⎇ {git.branch}</Badge>
                                </div>
                                <div className="tf-kv">
                                    <span>Working tree</span>
                                    <span className="tf-inline">
                                        <StatusDot status={git.dirty ? 'busy' : 'online'} />
                                        {git.dirty ? `dirty · ${git.dirtyFiles.length} file(s)` : 'clean'}
                                    </span>
                                </div>
                                {(git.ahead > 0 || git.behind > 0) && (
                                    <div className="tf-kv">
                                        <span>Sync</span>
                                        <Badge variant="info">
                                            ↑{git.ahead} ↓{git.behind}
                                        </Badge>
                                    </div>
                                )}
                                <Button variant="secondary" outline onClick={() => router.push(`/projects/${project}/git`)}>
                                    Manage git
                                </Button>
                            </>
                        ) : (
                            <Text variant="muted">Not a git repository, or status unavailable.</Text>
                        )}
                    </div>
                </Card>

                <Card header={<Heading as="h3">Run</Heading>}>
                    <div className="tf-card-body tf-stack-sm">
                        <div className="tf-kv">
                            <span>State</span>
                            <Badge variant={snapshot.state === 'IDLE' ? 'secondary' : 'info'}>{snapshot.state}</Badge>
                        </div>
                        {snapshot.state === 'SLEEPING' && wakeAt && (
                            <Text variant="muted">Sleeping until ~{new Date(wakeAt).toLocaleTimeString()}.</Text>
                        )}
                        <div className="tf-kv">
                            <span>Last model</span>
                            <Text>{snapshot.model ?? '—'}</Text>
                        </div>
                        <div className="tf-actions">
                            <Button variant="primary" onClick={() => router.push(`/projects/${project}/run`)}>
                                Open run console
                            </Button>
                            <Button variant="secondary" outline onClick={() => router.push(`/projects/${project}/tasks`)}>
                                Manage tasks
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            <Card header={<Heading as="h3">Workspace</Heading>}>
                <div className="tf-card-body tf-stack-sm">
                    <Text variant="muted">
                        Generate a root <code>CLAUDE.md</code> that orients the agent to this project&apos;s layout
                        (<code>repo/</code>, <code>knowledge/</code>, <code>tasks/</code>). Overwrites any existing one.
                    </Text>
                    <div className="tf-actions">
                        <Button variant="secondary" outline loading={generating} disabled={generating} onClick={generateClaudeMd}>
                            Generate CLAUDE.md
                        </Button>
                    </div>
                </div>
            </Card>

            {total === 0 && (
                <EmptyState icon="inbox">
                    <h3>No tasks yet</h3>
                    <p>
                        Head to the <Link href={`/projects/${project}/tasks`}>Tasks</Link> page to describe
                        work and let Claude split it into task files.
                    </p>
                </EmptyState>
            )}
        </div>
    )
}
