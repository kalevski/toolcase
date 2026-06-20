'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
    Table,
    Badge,
    StatusDot,
    Tag,
    Button,
    Checkbox,
    ChipGroup,
    HelperText,
    Select,
    Tooltip,
    toast,
    type TableColumn,
    type ChipGroupItem,
} from '@/components/ui'
import type { TaskInfo, TaskRuntimeStatus } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { TaskDrawer } from '../TaskDrawer'
import { useConfirm } from '../ConfirmModal'
import { useNewTaskModal } from '../NewTaskModal'
import { useImportIssuesModal } from '../ImportIssuesModal'
import { helpTexts } from '../helpTexts'

const STATUS_BADGE: Record<TaskRuntimeStatus, 'secondary' | 'info' | 'success' | 'danger' | 'warning'> = {
    pending: 'secondary',
    running: 'info',
    done: 'success',
    error: 'danger',
    'needs-review': 'warning',
}

const STATUS_DOT: Record<TaskRuntimeStatus, 'online' | 'offline' | 'busy' | 'away'> = {
    pending: 'away',
    running: 'busy',
    done: 'online',
    error: 'offline',
    'needs-review': 'busy',
}

type Filter = 'all' | TaskRuntimeStatus

const MODEL_ALIASES = ['fast', 'mid', 'deep']

export function TasksClient() {
    const { project, tasks, running, busy, modelOptions, onReRunTask, onRunTasks, onResetErrors, setTasks, refresh } =
        useProject()
    const confirm = useConfirm()
    const openNewTask = useNewTaskModal()
    const openImportIssues = useImportIssuesModal()
    const searchParams = useSearchParams()

    const [openTask, setOpenTask] = useState<string | null>(null)
    // Default to the actionable view; fall back to All when nothing is pending
    // (otherwise a fully-completed project opens on an empty table). Lazy
    // initializer only — a manual chip selection must win for the session.
    const [statusFilter, setStatusFilter] = useState<Filter>(() =>
        tasks.some((t) => t.status === 'pending') ? 'pending' : 'all',
    )

    // A3 — row selection for bulk actions
    const [selected, setSelected] = useState<Set<string>>(() => new Set())
    const [pinModel, setPinModel] = useState('')
    const [bulkBusy, setBulkBusy] = useState(false)

    // A2 — reorder mode (pending tasks only)
    const [orderIds, setOrderIds] = useState<string[] | null>(null)
    const reordering = orderIds !== null

    // A5 — archived list
    const [archived, setArchived] = useState<{ id: string; title: string }[]>([])
    const [showArchived, setShowArchived] = useState(false)

    // C3 — deep link from the search palette (?open=<id>)
    useEffect(() => {
        const open = searchParams.get('open')
        if (open) setOpenTask(open)
    }, [searchParams])

    const loadArchived = useCallback(async () => {
        try {
            const d = await fetch(`/api/projects/${project}/tasks/archive`).then((r) => (r.ok ? r.json() : null))
            if (d) setArchived(d)
        } catch {
            /* transient */
        }
    }, [project])

    useEffect(() => {
        void loadArchived()
    }, [loadArchived])

    const counts = useMemo(() => {
        const c: Record<TaskRuntimeStatus, number> = { pending: 0, running: 0, done: 0, error: 0, 'needs-review': 0 }
        for (const t of tasks) c[t.status]++
        return c
    }, [tasks])

    const chips: ChipGroupItem[] = [
        { id: 'all', label: 'All', active: statusFilter === 'all', count: tasks.length },
        { id: 'pending', label: 'Pending', active: statusFilter === 'pending', count: counts.pending },
        { id: 'running', label: 'Running', active: statusFilter === 'running', count: counts.running },
        { id: 'done', label: 'Done', active: statusFilter === 'done', count: counts.done },
        ...(counts['needs-review'] > 0
            ? [{ id: 'needs-review', label: 'Needs review', active: statusFilter === 'needs-review', count: counts['needs-review'] } as ChipGroupItem]
            : []),
        { id: 'error', label: 'Error', active: statusFilter === 'error', count: counts.error },
    ]

    const shown = useMemo(() => {
        if (reordering) {
            const byId = new Map(tasks.map((t) => [t.id, t]))
            return (orderIds ?? []).map((id) => byId.get(id)).filter((t): t is TaskInfo => !!t)
        }
        return statusFilter === 'all' ? tasks : tasks.filter((t) => t.status === statusFilter)
    }, [tasks, statusFilter, reordering, orderIds])

    const openTaskInfo = openTask ? tasks.find((t) => t.id === openTask) : undefined
    const pendingIds = useMemo(() => tasks.filter((t) => t.status === 'pending').map((t) => t.id), [tasks])

    // ── A3 bulk ─────────────────────────────────────────────────────────────
    const toggleSelect = (id: string, checked: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (checked) next.add(id)
            else next.delete(id)
            return next
        })
    }

    const allShownSelected = shown.length > 0 && shown.every((t) => selected.has(t.id))

    const bulk = async (op: 'delete' | 'reset' | 'pin', model?: string) => {
        const ids = [...selected]
        if (!ids.length) return
        if (op === 'delete') {
            const ok = await confirm({
                title: `Delete ${ids.length} task(s)?`,
                body: 'The task files and their telemetry are removed permanently.',
                confirmLabel: 'Delete tasks',
                confirmVariant: 'danger',
            })
            if (!ok) return
        }
        setBulkBusy(true)
        try {
            const res = await fetch(`/api/projects/${project}/tasks/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ op, ids, model }),
            })
            if (res.status === 409) {
                toast.error('A run or agent is in progress.')
                return
            }
            if (!res.ok) {
                toast.error((await res.json().catch(() => ({}))).error ?? 'Bulk operation failed')
                return
            }
            const data = await res.json()
            setTasks(data.tasks)
            setSelected(new Set())
            const label = op === 'delete' ? 'Deleted' : op === 'reset' ? 'Moved to pending' : model ? `Pinned ${model} on` : 'Cleared model on'
            toast.success(`${label} ${ids.length} task(s)${data.failed?.length ? ` · ${data.failed.length} failed` : ''}`)
        } finally {
            setBulkBusy(false)
        }
    }

    // ── A2 reorder ──────────────────────────────────────────────────────────
    const move = (id: string, dir: -1 | 1) => {
        setOrderIds((prev) => {
            if (!prev) return prev
            const idx = prev.indexOf(id)
            const to = idx + dir
            if (idx < 0 || to < 0 || to >= prev.length) return prev
            const next = [...prev]
            next[idx] = next[to]
            next[to] = id
            return next
        })
    }

    const saveOrder = async () => {
        if (!orderIds) return
        const res = await fetch(`/api/projects/${project}/tasks/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: orderIds }),
        })
        if (res.status === 409) {
            toast.error('A run or agent is in progress.')
            return
        }
        if (!res.ok) {
            toast.error((await res.json().catch(() => ({}))).error ?? 'Reorder failed')
            return
        }
        const data = await res.json()
        setTasks(data.tasks)
        setOrderIds(null)
        toast.success('Queue order saved')
    }

    // ── A5 archive ──────────────────────────────────────────────────────────
    const archiveDone = async () => {
        const doneCount = counts.done + counts['needs-review']
        const ok = await confirm({
            title: `Archive ${doneCount} completed task(s)?`,
            body: 'Done tasks move to tasks/archive/ — out of the queue and the default view, kept on disk and in telemetry.',
            confirmLabel: 'Archive completed',
            confirmVariant: 'primary',
        })
        if (!ok) return
        const res = await fetch(`/api/projects/${project}/tasks/archive`, { method: 'POST' })
        if (res.status === 409) {
            toast.error('A run or agent is in progress.')
            return
        }
        if (!res.ok) {
            toast.error('Archive failed')
            return
        }
        const data = await res.json()
        setTasks(data.tasks)
        toast.success(`Archived ${data.moved.length} task(s)`)
        void loadArchived()
    }

    const restore = async (id: string) => {
        const res = await fetch(`/api/projects/${project}/tasks/archive`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        })
        if (!res.ok) {
            toast.error((await res.json().catch(() => ({}))).error ?? 'Restore failed')
            return
        }
        const data = await res.json()
        setTasks(data.tasks)
        toast.success(`Restored ${id}`)
        void loadArchived()
    }

    // ── columns ─────────────────────────────────────────────────────────────
    const columns: TableColumn<TaskInfo>[] = [
        ...(!reordering
            ? [
                  {
                      key: 'select',
                      header: (
                          <Checkbox
                              checked={allShownSelected}
                              onChange={(e) =>
                                  setSelected(e.target.checked ? new Set(shown.map((t) => t.id)) : new Set())
                              }
                          />
                      ),
                      width: '2.5rem',
                      render: (t: TaskInfo) => (
                          <span onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                  checked={selected.has(t.id)}
                                  onChange={(e) => toggleSelect(t.id, e.target.checked)}
                              />
                          </span>
                      ),
                  } as TableColumn<TaskInfo>,
              ]
            : [
                  {
                      key: 'move',
                      header: 'Order',
                      width: '6rem',
                      render: (t: TaskInfo) => (
                          <span style={{ display: 'inline-flex', gap: '0.25rem' }} onClick={(e) => e.stopPropagation()}>
                              <Button size="small" variant="secondary" outline onClick={() => move(t.id, -1)}>
                                  ↑
                              </Button>
                              <Button size="small" variant="secondary" outline onClick={() => move(t.id, 1)}>
                                  ↓
                              </Button>
                          </span>
                      ),
                  } as TableColumn<TaskInfo>,
              ]),
        { key: 'id', header: '#', width: '26%', render: (t) => <code>{t.id}</code> },
        { key: 'title', header: 'Title', render: (t) => t.title },
        {
            key: 'facets',
            header: 'Facets',
            render: (t) => (
                <span style={{ display: 'inline-flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {t.severity && <Tag variant="warning">{t.severity}</Tag>}
                    {t.project && <Tag variant="info">{t.project}</Tag>}
                    {t.model && <Tag variant="secondary">⚡ {t.model}</Tag>}
                    {t.depends && t.depends.length > 0 && (
                        <Tooltip content={`Depends on: ${t.depends.join(', ')}`}>
                            <Tag variant="secondary">⛓ {t.depends.join(',')}</Tag>
                        </Tooltip>
                    )}
                </span>
            ),
        },
        {
            key: 'cost',
            header: 'Last cost',
            width: '7rem',
            render: (t) =>
                t.costUsd != null ? (
                    <Tooltip content={`${(t.tokensIn ?? 0).toLocaleString()} in / ${(t.tokensOut ?? 0).toLocaleString()} out`}>
                        <code>${t.costUsd.toFixed(2)}</code>
                    </Tooltip>
                ) : (
                    <span style={{ opacity: 0.4 }}>—</span>
                ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (t) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <StatusDot status={STATUS_DOT[t.status]} pulse={t.status === 'running'} />
                    <Badge variant={STATUS_BADGE[t.status]}>{t.status}</Badge>
                </span>
            ),
        },
    ]

    const selectedCount = selected.size

    return (
        <div className="tf-stack">
            <div
                className="tf-actions"
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}
            >
                <ChipGroup items={chips} onToggle={(id) => setStatusFilter(id as Filter)} />
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Button
                        size="small"
                        variant="primary"
                        disabled={busy || reordering}
                        startIcon={<span>＋</span>}
                        onClick={() => openNewTask({ project, onCreated: (t) => setTasks(t) })}
                    >
                        New task
                    </Button>
                    <Button
                        size="small"
                        variant="secondary"
                        outline
                        disabled={busy || reordering}
                        onClick={() => openImportIssues({ project, onImported: (t) => setTasks(t) })}
                    >
                        ⇩ Import from GitHub
                    </Button>
                    {!reordering ? (
                        <Button
                            size="small"
                            variant="secondary"
                            outline
                            disabled={busy || pendingIds.length < 2}
                            title={helpTexts.tasks.reorder}
                            onClick={() => {
                                setStatusFilter('pending')
                                setSelected(new Set())
                                setOrderIds(pendingIds)
                            }}
                        >
                            ⇅ Reorder
                        </Button>
                    ) : (
                        <>
                            <Button size="small" variant="success" onClick={() => void saveOrder()}>
                                Save order
                            </Button>
                            <Button size="small" variant="secondary" outline onClick={() => setOrderIds(null)}>
                                Cancel
                            </Button>
                        </>
                    )}
                    <Button
                        size="small"
                        variant="secondary"
                        outline
                        disabled={busy || reordering || counts.done + counts['needs-review'] === 0}
                        title={helpTexts.tasks.archive}
                        onClick={() => void archiveDone()}
                    >
                        🗄 Archive completed
                    </Button>
                    <Tooltip content={helpTexts.tasks.resetErrors}>
                        <Button
                            size="small"
                            variant="warning"
                            outline
                            disabled={busy || counts.error === 0 || reordering}
                            title={running ? 'Stop the active run first.' : ''}
                            onClick={onResetErrors}
                        >
                            Move errors to pending{counts.error > 0 ? ` (${counts.error})` : ''}
                        </Button>
                    </Tooltip>
                </span>
            </div>

            {selectedCount > 0 && !reordering && (
                <div className="tf-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Badge variant="info">{selectedCount} selected</Badge>
                    <Button size="small" variant="primary" outline disabled={busy || bulkBusy} onClick={() => void onRunTasks([...selected]).then(() => setSelected(new Set()))}>
                        ▶ Re-run selected
                    </Button>
                    <Button size="small" variant="warning" outline disabled={busy || bulkBusy} onClick={() => void bulk('reset')}>
                        Reset to pending
                    </Button>
                    <span style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                        <Select
                            options={[
                                { value: '', label: 'Run default' },
                                ...MODEL_ALIASES.filter((a) => !modelOptions.some((o) => o.value === a)).map((a) => ({ value: a, label: a })),
                                ...modelOptions,
                            ]}
                            value={pinModel}
                            onChange={(e) => setPinModel(e.target.value)}
                        />
                        <Button size="small" variant="secondary" outline disabled={busy || bulkBusy} onClick={() => void bulk('pin', pinModel)}>
                            Pin model
                        </Button>
                    </span>
                    <Button size="small" variant="danger" outline disabled={busy || bulkBusy} onClick={() => void bulk('delete')}>
                        Delete
                    </Button>
                    <Button size="small" variant="secondary" outline onClick={() => setSelected(new Set())}>
                        Clear selection
                    </Button>
                </div>
            )}

            <HelperText text={reordering ? helpTexts.tasks.reorderActive : helpTexts.tasks.statuses} />

            <Table
                columns={columns}
                data={shown}
                rowKey={(t) => t.id}
                hoverable
                emptyMessage={
                    statusFilter === 'all'
                        ? 'No tasks yet — create one, import GitHub issues, or use the task creator on the Agents page.'
                        : `No ${statusFilter} tasks.`
                }
                onRowClick={(t) => !reordering && setOpenTask(t.id)}
            />

            {archived.length > 0 && (
                <div className="tf-stack-sm">
                    <Button size="small" variant="secondary" outline onClick={() => setShowArchived((v) => !v)}>
                        {showArchived ? '▾' : '▸'} Archived ({archived.length})
                    </Button>
                    {showArchived && (
                        <Table
                            columns={[
                                { key: 'id', header: '#', width: '30%', render: (a: { id: string; title: string }) => <code>archive/{a.id}</code> },
                                { key: 'title', header: 'Title', render: (a: { id: string; title: string }) => a.title },
                                {
                                    key: 'actions',
                                    header: '',
                                    width: '8rem',
                                    render: (a: { id: string; title: string }) => (
                                        <Button size="small" variant="secondary" outline disabled={busy} onClick={() => void restore(a.id)}>
                                            Restore
                                        </Button>
                                    ),
                                },
                            ]}
                            data={archived}
                            rowKey={(a) => a.id}
                        />
                    )}
                </div>
            )}

            <TaskDrawer
                project={project}
                taskId={openTask}
                task={openTaskInfo}
                running={busy}
                onReRun={onReRunTask}
                onClose={() => setOpenTask(null)}
                onTasksChanged={(t) => {
                    setTasks(t)
                    void refresh()
                }}
            />
        </div>
    )
}
