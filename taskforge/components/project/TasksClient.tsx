'use client'

import React, { useMemo, useState } from 'react'
import {
    Card,
    Heading,
    Table,
    Badge,
    StatusDot,
    Tag,
    Textarea,
    Select,
    Button,
    ChipGroup,
    type TableColumn,
    type ChipGroupItem,
} from '@toolcase/react-components'
import type { TaskInfo, TaskRuntimeStatus } from '@/server/types'
import { useProject } from '../ProjectContext'
import { TaskDrawer } from '../TaskDrawer'

const STATUS_BADGE: Record<TaskRuntimeStatus, 'secondary' | 'info' | 'success' | 'danger'> = {
    pending: 'secondary',
    running: 'info',
    done: 'success',
    error: 'danger',
}

type Filter = 'all' | TaskRuntimeStatus

export function TasksClient() {
    const { project, tasks, running, genPrompt, setGenPrompt, genModel, setGenModel, generating, modelOptions, onGenerate, onReRunTask } =
        useProject()
    const [openTask, setOpenTask] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState<Filter>('all')

    const counts = useMemo(() => {
        const c = { pending: 0, running: 0, done: 0, error: 0 } as Record<TaskRuntimeStatus, number>
        for (const t of tasks) c[t.status]++
        return c
    }, [tasks])

    const chips: ChipGroupItem[] = [
        { id: 'all', label: 'All', active: statusFilter === 'all', count: tasks.length },
        { id: 'pending', label: 'Pending', active: statusFilter === 'pending', count: counts.pending },
        { id: 'running', label: 'Running', active: statusFilter === 'running', count: counts.running },
        { id: 'done', label: 'Done', active: statusFilter === 'done', count: counts.done },
        { id: 'error', label: 'Error', active: statusFilter === 'error', count: counts.error },
    ]

    const shown = useMemo(
        () => (statusFilter === 'all' ? tasks : tasks.filter((t) => t.status === statusFilter)),
        [tasks, statusFilter],
    )

    const openTaskInfo = openTask ? tasks.find((t) => t.id === openTask) : undefined

    const columns: TableColumn<TaskInfo>[] = [
        { key: 'id', header: '#', width: '30%', render: (t) => <code>{t.id}</code> },
        { key: 'title', header: 'Title', render: (t) => t.title },
        {
            key: 'facets',
            header: 'Facets',
            render: (t) => (
                <span style={{ display: 'inline-flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {t.severity && <Tag variant="warning">{t.severity}</Tag>}
                    {t.project && <Tag variant="info">{t.project}</Tag>}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (t) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <StatusDot
                        status={
                            t.status === 'done'
                                ? 'online'
                                : t.status === 'running'
                                  ? 'busy'
                                  : t.status === 'error'
                                    ? 'offline'
                                    : 'away'
                        }
                        pulse={t.status === 'running'}
                    />
                    <Badge variant={STATUS_BADGE[t.status]}>{t.status}</Badge>
                </span>
            ),
        },
    ]

    return (
        <div className="tf-stack">
            <ChipGroup items={chips} onToggle={(id) => setStatusFilter(id as Filter)} />

            <Table
                columns={columns}
                data={shown}
                rowKey={(t) => t.id}
                hoverable
                emptyMessage={
                    statusFilter === 'all'
                        ? 'No tasks yet — use the task creator below.'
                        : `No ${statusFilter} tasks.`
                }
                onRowClick={(t) => setOpenTask(t.id)}
            />

            <Card header={<Heading as="h3">Task creator</Heading>}>
                <div className="tf-card-body tf-stack-sm">
                    <Textarea
                        label="Describe the work — Claude will split it into numbered task files."
                        rows={4}
                        placeholder="e.g. Add health checks and structured logging across the API service."
                        value={genPrompt}
                        disabled={generating || running}
                        onChange={(e) => setGenPrompt(e.target.value)}
                    />
                    <div className="tf-form-row">
                        <div style={{ minWidth: 200 }}>
                            <Select
                                label="Model"
                                options={modelOptions}
                                value={genModel}
                                disabled={generating || running}
                                onChange={(e) => setGenModel(e.target.value)}
                            />
                        </div>
                        <Button
                            variant="primary"
                            loading={generating}
                            disabled={running || !genPrompt.trim()}
                            onClick={onGenerate}
                        >
                            Generate tasks
                        </Button>
                    </div>
                </div>
            </Card>

            <TaskDrawer
                project={project}
                taskId={openTask}
                task={openTaskInfo}
                running={running}
                onReRun={onReRunTask}
                onClose={() => setOpenTask(null)}
            />
        </div>
    )
}
