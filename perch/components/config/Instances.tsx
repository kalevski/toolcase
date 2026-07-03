'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TableColumn } from '@toolcase/web-components'
import { escapeHtml } from '@/lib/tc'
import type { InstanceListItem } from '@/server/domain/types'
import { iconBtnHtml } from '@/lib/action-icons'
import { ConfigPage, callApi, json, useConfigData } from './shared'
import { DataTable } from '@/components/DataTable'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormModal, FormGroup } from '@/components/FormModal'
import { SelectField, TextField } from '@/components/fields'
import { useToast } from '@/components/Toast'

// Flat instance list (move_wharf_to_perch.md §10) — the Config subsystem's
// entry page. Filtering by tag reproduces every grouping wharf's
// project/environment hierarchy provided (§2). Maintainer access.

function badge(variant: string, text: string): string {
    return `<span class="badge text-bg-${variant}">${escapeHtml(text)}</span>`
}
function muted(text: string): string {
    return `<span class="perch-admin-hint">${escapeHtml(text)}</span>`
}
function fmtDate(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface InstanceRow extends Record<string, unknown> {
    id: string
    name: string
    project?: string
    tags: string[]
    hasKey: boolean
    lastFetchAt?: string
    pending: boolean
}

const INSTANCE_COLUMNS: TableColumn[] = [
    {
        key: 'name',
        header: 'Name',
        render: (row: InstanceRow) =>
            `<button type="button" class="btn btn-link p-0 perch-admin-mono" data-action="view" data-id="${escapeHtml(row.id)}">${escapeHtml(row.name)}</button>`,
    },
    {
        key: 'project',
        header: 'Project',
        render: (row: InstanceRow) => (row.project ? badge('info', row.project) : muted('—')),
    },
    {
        key: 'tags',
        header: 'Tags',
        render: (row: InstanceRow) =>
            row.tags.length ? row.tags.map((t) => badge('secondary', t)).join(' ') : muted('—'),
    },
    {
        key: 'key',
        header: 'Key',
        render: (row: InstanceRow) => (row.hasKey ? badge('success', 'set') : badge('secondary', 'none')),
    },
    {
        key: 'lastFetchAt',
        header: 'Last fetch',
        render: (row: InstanceRow) => (row.lastFetchAt ? escapeHtml(fmtDate(row.lastFetchAt)) : muted('never')),
    },
    {
        key: 'pending',
        header: 'Pending',
        render: (row: InstanceRow) => (row.pending ? badge('warning', 'un-applied changes') : muted('—')),
    },
    {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row: InstanceRow) =>
            `<span class="perch-admin-domain-controls">` +
            iconBtnHtml({ icon: 'clone', label: `Clone ${row.name}`, data: { action: 'clone', id: row.id, name: row.name } }) +
            iconBtnHtml({ icon: 'remove', label: `Delete ${row.name}`, danger: true, data: { action: 'delete', id: row.id, name: row.name } }) +
            `</span>`,
    },
]

export function Instances() {
    const fetcher = useCallback(async (): Promise<InstanceListItem[] | null> => {
        try {
            return await fetch('/api/instances', { cache: 'no-store' }).then((r) => json<InstanceListItem[]>(r))
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useConfigData(fetcher)

    return (
        <ConfigPage
            title="Variables"
            subtitle="Flat list of instances carrying variables and flags, organized by project and tags. Maintainer access."
            icon="server"
            iconColor="cyan"
            state={state}
            onRetry={() => void reload()}
        >
            {(instances) => <InstancesTable instances={instances} onChanged={() => void reload()} />}
        </ConfigPage>
    )
}

interface CreateDraft {
    name: string
    description: string
    project: string
    tags: string
}

interface CloneDraft {
    id: string
    name: string
    newName: string
}

function InstancesTable({ instances, onChanged }: { instances: InstanceListItem[]; onChanged: () => void }) {
    const router = useRouter()
    const toast = useToast()
    // Multi-tag filter: each tag toggles on/off independently; an instance must
    // carry every active tag (AND). No tags active = no filter (show all).
    const [activeTags, setActiveTags] = useState<string[]>([])
    // Project filter: single-select ('' = all). Combines with the tag filter (AND).
    const [activeProject, setActiveProject] = useState('')
    const [form, setForm] = useState<CreateDraft | null>(null)
    const [cloning, setCloning] = useState<CloneDraft | null>(null)
    const [pending, setPending] = useState<{ id: string; name: string } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const allTags = useMemo(() => {
        const set = new Set<string>()
        for (const inst of instances) for (const t of inst.tags) set.add(t)
        return [...set].sort()
    }, [instances])

    const projectOptions = useMemo(() => {
        const set = new Set<string>()
        for (const inst of instances) if (inst.project) set.add(inst.project)
        return [
            { value: '', label: 'All projects' },
            ...[...set].sort().map((p) => ({ value: p, label: p })),
        ]
    }, [instances])

    const toggleTag = useCallback((tag: string) => {
        setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
    }, [])

    const rows = useMemo<InstanceRow[]>(
        () =>
            instances
                .filter((i) => activeTags.every((t) => i.tags.includes(t)))
                .filter((i) => !activeProject || i.project === activeProject)
                .map((i) => ({
                    id: i.id,
                    name: i.name,
                    project: i.project,
                    tags: i.tags,
                    hasKey: i.hasKey,
                    lastFetchAt: i.lastFetchAt,
                    pending: i.pending,
                })),
        [instances, activeTags, activeProject],
    )

    const onAction = useCallback(
        (action: string, dataset: DOMStringMap) => {
            const id = dataset.id
            if (!id) return
            if (action === 'view') router.push(`/instances/${encodeURIComponent(id)}`)
            else if (action === 'clone') setCloning({ id, name: dataset.name ?? '', newName: '' })
            else if (action === 'delete') setPending({ id, name: dataset.name ?? '' })
        },
        [router],
    )

    const openCreate = () => {
        setError(null)
        setForm({ name: '', description: '', project: '', tags: '' })
    }
    const closeForm = useCallback(() => {
        setForm(null)
        setError(null)
    }, [])

    const create = useCallback(async () => {
        if (!form || busy) return
        const name = form.name.trim()
        if (!name) {
            setError('An instance needs a name.')
            return
        }
        setBusy(true)
        setError(null)
        const tags = form.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        const res = await callApi('/api/instances', 'POST', {
            name,
            description: form.description.trim() || undefined,
            project: form.project.trim() || undefined,
            tags,
        })
        setBusy(false)
        if (!res.ok) {
            setError(`Couldn’t create instance: ${res.message}`)
            return
        }
        toast.show(`Instance “${name}” created.`, { variant: 'success' })
        setForm(null)
        onChanged()
    }, [form, busy, onChanged, toast])

    const doClone = useCallback(async () => {
        if (!cloning || busy) return
        const newName = cloning.newName.trim()
        if (!newName) {
            setError('Give the clone a name.')
            return
        }
        setBusy(true)
        setError(null)
        const res = await callApi(`/api/instances/${encodeURIComponent(cloning.id)}/clone`, 'POST', {
            name: newName,
        })
        setBusy(false)
        if (!res.ok) {
            setError(`Couldn’t clone “${cloning.name}”: ${res.message}`)
            return
        }
        toast.show(`Cloned “${cloning.name}” → “${newName}”.`, { variant: 'success' })
        setCloning(null)
        onChanged()
    }, [cloning, busy, onChanged, toast])

    const doDelete = useCallback(async () => {
        if (!pending || busy) return
        const { id, name } = pending
        setPending(null)
        setBusy(true)
        setError(null)
        const res = await callApi(`/api/instances/${encodeURIComponent(id)}`, 'DELETE')
        setBusy(false)
        if (!res.ok) {
            setError(`Couldn’t delete “${name}”: ${res.message}`)
            return
        }
        toast.show(`Instance “${name}” deleted.`, { variant: 'success' })
        onChanged()
    }, [pending, busy, onChanged, toast])

    return (
        <>
            <tc-section-card title="Instances" icon="server">
                <div className="perch-admin-section">
                    <p className="perch-home-lead perch-admin-hint">
                        {instances.length} instance{instances.length === 1 ? '' : 's'}. Group instances with a project
                        label and tags — e.g. project <code>acme-shop</code>, tags <code>api</code> +{' '}
                        <code>production</code>. Both are filters only.
                    </p>
                    {error && !form && !cloning && <tc-banner variant="danger">{error}</tc-banner>}

                    <div className="perch-instance-toolbar">
                        {projectOptions.length > 1 && (
                            <div className="perch-project-filter">
                                <SelectField
                                    size="sm"
                                    value={activeProject}
                                    onValue={setActiveProject}
                                    options={projectOptions}
                                    ariaLabel="Filter by project"
                                />
                            </div>
                        )}
                        <div className="perch-tag-filter" role="group" aria-label="Filter by tags">
                            {allTags.map((t) => {
                                const active = activeTags.includes(t)
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        className={`btn btn-sm ${active ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                        aria-pressed={active}
                                        onClick={() => toggleTag(t)}
                                    >
                                        {t}
                                    </button>
                                )
                            })}
                        </div>
                        <tc-button variant="primary" size="sm" onClick={openCreate}>
                            New instance
                        </tc-button>
                    </div>

                    {rows.length === 0 ? (
                        <tc-empty-state icon="server">
                            {activeTags.length || activeProject
                                ? 'No instances match ' +
                                  [
                                      activeProject ? `project “${activeProject}”` : '',
                                      ...activeTags.map((t) => `“${t}”`),
                                  ]
                                      .filter(Boolean)
                                      .join(' + ') +
                                  '.'
                                : 'No instances yet.'}
                        </tc-empty-state>
                    ) : (
                        <DataTable<InstanceRow>
                            columns={INSTANCE_COLUMNS}
                            rows={rows}
                            rowKey={(row) => row.id}
                            onAction={onAction}
                        />
                    )}
                </div>
            </tc-section-card>

            {form && (
                <FormModal
                    key="new"
                    title="New instance"
                    busy={busy}
                    submitLabel="Create instance"
                    onSubmit={() => void create()}
                    onClose={closeForm}
                >
                    {error && <tc-banner variant="danger">{error}</tc-banner>}
                    <FormGroup title="Identity">
                        <TextField
                            label="Name"
                            placeholder="api-prod-1"
                            help="Lowercase letters/digits/hyphens, e.g. api-prod-1."
                            value={form.name}
                            onValue={(v) => setForm((p) => (p ? { ...p, name: v } : p))}
                        />
                        <TextField
                            label="Description"
                            placeholder="Optional"
                            value={form.description}
                            onValue={(v) => setForm((p) => (p ? { ...p, description: v } : p))}
                        />
                        <TextField
                            label="Project"
                            placeholder="acme-shop"
                            help="Optional label shared across instances — one more way to group/filter."
                            value={form.project}
                            onValue={(v) => setForm((p) => (p ? { ...p, project: v } : p))}
                        />
                        <TextField
                            label="Tags"
                            placeholder="api, production"
                            help="Comma-separated. Filter/group by tag."
                            value={form.tags}
                            onValue={(v) => setForm((p) => (p ? { ...p, tags: v } : p))}
                        />
                    </FormGroup>
                </FormModal>
            )}

            {cloning && (
                <FormModal
                    key={cloning.id}
                    title={`Clone “${cloning.name}”`}
                    busy={busy}
                    submitLabel="Clone"
                    onSubmit={() => void doClone()}
                    onClose={() => {
                        setCloning(null)
                        setError(null)
                    }}
                >
                    {error && <tc-banner variant="danger">{error}</tc-banner>}
                    <FormGroup title="New instance">
                        <TextField
                            label="Name"
                            placeholder="api-prod-2"
                            help="Tags, vars (by reference), and flags are copied. A new fetch key must be minted."
                            value={cloning.newName}
                            onValue={(v) => setCloning((p) => (p ? { ...p, newName: v } : p))}
                        />
                    </FormGroup>
                </FormModal>
            )}

            <ConfirmDialog
                open={!!pending}
                title="Delete instance?"
                message={
                    pending
                        ? `Delete “${pending.name}”. Its tags, variables, and flags are removed. This cannot be undone.`
                        : undefined
                }
                confirmLabel="Delete"
                danger
                onConfirm={() => void doDelete()}
                onCancel={() => setPending(null)}
            />
        </>
    )
}
