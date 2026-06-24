'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from '@/lib/toast'
import { useTc, useTcProps, useTcEvents } from '@/lib/tc'
import type { ChipGroupItem } from '@toolcase/web-components'
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
type Col = { key: string; header: React.ReactNode; width?: string; render: (t: TaskInfo) => React.ReactNode }

const MODEL_ALIASES = ['fast', 'mid', 'deep']

// Archived sub-table header descriptors (tc-advanced-table; rows are slotted
// React <tr> so the per-row Restore button keeps its handler).
const ARCHIVE_COLUMNS = [
    { key: 'id', label: '#', width: '30%' },
    { key: 'title', label: 'Title' },
    { key: 'actions', label: '', width: '8rem' },
]

// Bare checkbox with its own change listener (React 18 won't fire onChange on tc-check).
function Chk({ checked, indeterminate, onChange }: { checked: boolean; indeterminate?: boolean; onChange: (c: boolean) => void }) {
    const ref = useTcEvents<HTMLElement>({ change: (e) => onChange((e.target as HTMLInputElement).checked) })
    return <tc-check ref={ref} checked={checked || undefined} indeterminate={indeterminate || undefined} />
}

export function TasksClient() {
    const { project, tasks, running, busy, modelOptions, onReRunTask, onRunTasks, onResetErrors, setTasks, refresh } =
        useProject()
    const confirm = useConfirm()
    const openNewTask = useNewTaskModal()
    const openImportIssues = useImportIssuesModal()
    const searchParams = useSearchParams()

    const [openTask, setOpenTask] = useState<string | null>(null)
    // Default to the actionable view; fall back to All when nothing is pending.
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

    const pinRef = useTcEvents<HTMLElement>({ change: (e) => setPinModel((e.target as HTMLSelectElement).value) })

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
        { id: 'all', label: 'All', selected: statusFilter === 'all', count: tasks.length },
        { id: 'pending', label: 'Pending', selected: statusFilter === 'pending', count: counts.pending },
        { id: 'running', label: 'Running', selected: statusFilter === 'running', count: counts.running },
        { id: 'done', label: 'Done', selected: statusFilter === 'done', count: counts.done },
        ...(counts['needs-review'] > 0
            ? [{ id: 'needs-review', label: 'Needs review', selected: statusFilter === 'needs-review', count: counts['needs-review'] } as ChipGroupItem]
            : []),
        { id: 'error', label: 'Error', selected: statusFilter === 'error', count: counts.error },
    ]

    const chipRef = useTcProps<HTMLElement>({ items: chips, onToggle: (id: string) => setStatusFilter(id as Filter) })

    const shown = useMemo(() => {
        if (reordering) {
            const byId = new Map(tasks.map((t) => [t.id, t]))
            return (orderIds ?? []).map((id) => byId.get(id)).filter((t): t is TaskInfo => !!t)
        }
        return statusFilter === 'all' ? tasks : tasks.filter((t) => t.status === statusFilter)
    }, [tasks, statusFilter, reordering, orderIds])

    const openTaskInfo = openTask ? tasks.find((t) => t.id === openTask) : undefined
    const pendingIds = useMemo(() => tasks.filter((t) => t.status === 'pending').map((t) => t.id), [tasks])

    // Prune the bulk-selection set to ids still present in the live task list, so
    // SSE removals/changes don't leave ghost ids that skew the select-all math.
    useEffect(() => {
        setSelected((prev) => {
            if (prev.size === 0) return prev
            const live = new Set(tasks.map((t) => t.id))
            let changed = false
            const next = new Set<string>()
            for (const id of prev) {
                if (live.has(id)) next.add(id)
                else changed = true
            }
            return changed ? next : prev
        })
    }, [tasks])

    // While reordering, keep orderIds in sync with the live pending ids so a task
    // that disappears (or appears) via SSE never gets posted as a stale id on save.
    useEffect(() => {
        if (!reordering) return
        setOrderIds((prev) => {
            if (!prev) return prev
            const live = new Set(pendingIds)
            const kept = prev.filter((id) => live.has(id))
            const added = pendingIds.filter((id) => !prev.includes(id))
            const next = [...kept, ...added]
            const same = next.length === prev.length && next.every((id, i) => id === prev[i])
            return same ? prev : next
        })
    }, [pendingIds, reordering])

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
    const columns: Col[] = [
        ...(!reordering
            ? [
                  {
                      key: 'select',
                      header: (
                          <Chk
                              checked={allShownSelected}
                              indeterminate={!allShownSelected && shown.some((t) => selected.has(t.id))}
                              onChange={(checked) => setSelected(checked ? new Set(shown.map((t) => t.id)) : new Set())}
                          />
                      ),
                      width: '2.5rem',
                      render: (t: TaskInfo) => (
                          <span onClick={(e) => e.stopPropagation()}>
                              <Chk checked={selected.has(t.id)} onChange={(checked) => toggleSelect(t.id, checked)} />
                          </span>
                      ),
                  } as Col,
              ]
            : [
                  {
                      key: 'move',
                      header: 'Order',
                      width: '6rem',
                      render: (t: TaskInfo) => (
                          <span style={{ display: 'inline-flex', gap: '0.25rem' }} onClick={(e) => e.stopPropagation()}>
                              <tc-icon-button icon="ArrowUp" label="Move up" size="sm" variant="secondary" outline onClick={() => move(t.id, -1)} />
                              <tc-icon-button icon="ArrowDown" label="Move down" size="sm" variant="secondary" outline onClick={() => move(t.id, 1)} />
                          </span>
                      ),
                  } as Col,
              ]),
        { key: 'id', header: '#', width: '26%', render: (t) => <code>{t.id}</code> },
        { key: 'title', header: 'Title', render: (t) => t.title },
        {
            key: 'facets',
            header: 'Facets',
            render: (t) => (
                <span style={{ display: 'inline-flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {t.severity && <tc-tag static variant="warning">{t.severity}</tc-tag>}
                    {t.project && <tc-tag static variant="info">{t.project}</tc-tag>}
                    {t.model && <tc-tag static variant="secondary"><tc-icon name="Zap" /> {t.model}</tc-tag>}
                    {t.depends && t.depends.length > 0 && (
                        <tc-tooltip content={`Depends on: ${t.depends.join(', ')}`}>
                            <tc-tag static variant="secondary"><tc-icon name="Link" /> {t.depends.join(',')}</tc-tag>
                        </tc-tooltip>
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
                    <tc-tooltip content={`${(t.tokensIn ?? 0).toLocaleString()} in / ${(t.tokensOut ?? 0).toLocaleString()} out`}>
                        <code>${t.costUsd.toFixed(2)}</code>
                    </tc-tooltip>
                ) : (
                    <span style={{ opacity: 0.4 }}>—</span>
                ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (t) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <tc-status-dot status={STATUS_DOT[t.status]} pulse={t.status === 'running' || undefined} />
                    <tc-badge variant={STATUS_BADGE[t.status]}>{t.status}</tc-badge>
                </span>
            ),
        },
    ]

    const selectedCount = selected.size

    const archiveTableKey = archived.map((a) => a.id).join('_')
    const archiveTableRef = useTc<HTMLElement>({ columns: ARCHIVE_COLUMNS })

    return (
        <tc-stack gap="1.25rem">
            <tc-stack direction="horizontal" gap="0.75rem" wrap align="center">
                <tc-chip-group ref={chipRef} />
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <tc-button
                        size="sm"
                        variant="primary"
                        disabled={busy || reordering || undefined}
                        onClick={() => openNewTask({ project, onCreated: (t) => setTasks(t) })}
                    >
                        <tc-icon name="Plus" /> New task
                    </tc-button>
                    <tc-button
                        size="sm"
                        variant="secondary"
                        outline
                        disabled={busy || reordering || undefined}
                        onClick={() => openImportIssues({ project, onImported: (t) => setTasks(t) })}
                    >
                        <tc-icon name="Download" /> Import from GitHub
                    </tc-button>
                    {!reordering ? (
                        <tc-button
                            size="sm"
                            variant="secondary"
                            outline
                            disabled={busy || pendingIds.length < 2 || undefined}
                            title={helpTexts.tasks.reorder}
                            onClick={() => {
                                setStatusFilter('pending')
                                setSelected(new Set())
                                setOrderIds(pendingIds)
                            }}
                        >
                            <tc-icon name="ArrowUpDown" /> Reorder
                        </tc-button>
                    ) : (
                        <>
                            <tc-button size="sm" variant="success" onClick={() => void saveOrder()}>
                                Save order
                            </tc-button>
                            <tc-button size="sm" variant="secondary" outline onClick={() => setOrderIds(null)}>
                                Cancel
                            </tc-button>
                        </>
                    )}
                    <tc-button
                        size="sm"
                        variant="secondary"
                        outline
                        disabled={busy || reordering || counts.done + counts['needs-review'] === 0 || undefined}
                        title={helpTexts.tasks.archive}
                        onClick={() => void archiveDone()}
                    >
                        <tc-icon name="Archive" /> Archive completed
                    </tc-button>
                    <tc-tooltip content={helpTexts.tasks.resetErrors}>
                        <tc-button
                            size="sm"
                            variant="warning"
                            outline
                            disabled={busy || counts.error === 0 || reordering || undefined}
                            title={running ? 'Stop the active run first.' : ''}
                            onClick={onResetErrors}
                        >
                            Move errors to pending{counts.error > 0 ? ` (${counts.error})` : ''}
                        </tc-button>
                    </tc-tooltip>
                </span>
            </tc-stack>

            {selectedCount > 0 && !reordering && (
                <tc-stack direction="horizontal" gap="0.5rem" wrap align="center">
                    <tc-badge variant="info">{selectedCount} selected</tc-badge>
                    {/* TODO: onRunTasks returns Promise<void> with no started/cancelled signal,
                        so we can't tell whether the confirm was cancelled — selection is cleared
                        unconditionally to preserve existing behavior. Surface a boolean from
                        ProjectContext.onRunTasks to only clear on an actual run. */}
                    <tc-button size="sm" variant="primary" outline disabled={busy || bulkBusy || undefined} onClick={() => void onRunTasks([...selected]).then(() => setSelected(new Set()))}>
                        <tc-icon name="Play" /> Re-run selected
                    </tc-button>
                    <tc-button size="sm" variant="warning" outline disabled={busy || bulkBusy || undefined} onClick={() => void bulk('reset')}>
                        Reset to pending
                    </tc-button>
                    <span style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                        <tc-select ref={pinRef} value={pinModel}>
                            <tc-option value="">Run default</tc-option>
                            {MODEL_ALIASES.filter((a) => !modelOptions.some((o) => o.value === a)).map((a) => (
                                <tc-option key={a} value={a}>
                                    {a}
                                </tc-option>
                            ))}
                            {modelOptions.map((o) => (
                                <tc-option key={o.value} value={o.value}>
                                    {o.label}
                                </tc-option>
                            ))}
                        </tc-select>
                        <tc-button size="sm" variant="secondary" outline disabled={busy || bulkBusy || undefined} onClick={() => void bulk('pin', pinModel)}>
                            Pin model
                        </tc-button>
                    </span>
                    <tc-button size="sm" variant="danger" outline disabled={busy || bulkBusy || undefined} onClick={() => void bulk('delete')}>
                        Delete
                    </tc-button>
                    <tc-button size="sm" variant="secondary" outline onClick={() => setSelected(new Set())}>
                        Clear selection
                    </tc-button>
                </tc-stack>
            )}

            <tc-helper-text text={reordering ? helpTexts.tasks.reorderActive : helpTexts.tasks.statuses} />

            {/* The main task table stays a raw <table>: its header carries a React
                select-all <tc-check> and its columns switch between select/reorder
                modes — neither is expressible through tc-advanced-table's
                string-label, component-rendered header. It keeps the .table skin. */}
            <table className="table table-hover">
                <thead>
                    <tr>
                        {columns.map((c) => (
                            <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                                {c.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {shown.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} style={{ textAlign: 'center', opacity: 0.6 }}>
                                {statusFilter === 'all'
                                    ? 'No tasks yet — create one, import GitHub issues, or use the task creator on the Agents page.'
                                    : `No ${statusFilter} tasks.`}
                            </td>
                        </tr>
                    ) : (
                        shown.map((t) => (
                            <tr
                                key={t.id}
                                style={{ cursor: reordering ? 'default' : 'pointer' }}
                                tabIndex={reordering ? undefined : 0}
                                role={reordering ? undefined : 'button'}
                                aria-label={reordering ? undefined : `Open task ${t.id}`}
                                onClick={() => !reordering && setOpenTask(t.id)}
                                onKeyDown={(e) => {
                                    if (!reordering && (e.key === 'Enter' || e.key === ' ')) {
                                        e.preventDefault()
                                        setOpenTask(t.id)
                                    }
                                }}
                            >
                                {columns.map((c) => (
                                    <td key={c.key}>{c.render(t)}</td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            {archived.length > 0 && (
                <tc-stack gap="0.75rem">
                    <tc-button size="sm" variant="secondary" outline onClick={() => setShowArchived((v) => !v)}>
                        <tc-icon name={showArchived ? 'ChevronDown' : 'ChevronRight'} /> Archived ({archived.length})
                    </tc-button>
                    {showArchived && (
                        <tc-advanced-table key={archiveTableKey} ref={archiveTableRef}>
                            {archived.map((a) => (
                                <tr key={a.id}>
                                    <td>
                                        <code>archive/{a.id}</code>
                                    </td>
                                    <td>{a.title}</td>
                                    <td>
                                        <tc-button size="sm" variant="secondary" outline disabled={busy || undefined} onClick={() => void restore(a.id)}>
                                            Restore
                                        </tc-button>
                                    </td>
                                </tr>
                            ))}
                        </tc-advanced-table>
                    )}
                </tc-stack>
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
        </tc-stack>
    )
}
