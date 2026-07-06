'use client'

import { useCallback, useState } from 'react'
import type { TableColumn } from '@toolcase/web-components'
import { escapeHtml } from '@/lib/tc'
import type { GlobalVar, ReferencingInstance } from '@/server/domain/types'
import { isValidKey, KEY_SHAPE_MESSAGE } from '@/server/domain/config-input'
import { iconBtnHtml } from '@/lib/action-icons'
import { AdminPage, json, useOwnerData } from './shared'
import { callApi } from '@/components/config/shared'
import { DataTable } from '@/components/DataTable'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormModal, FormGroup } from '@/components/FormModal'
import { TextField } from '@/components/fields'
import { useToast } from '@/components/Toast'

// Owner-only global-variable pool (move_wharf_to_perch.md §3, §10): app-wide
// plain-text key/value pairs an instance's env vars can reference by id.
// Delete is blocked (409 `global_referenced`) while any env var still points
// at it — the response carries the referencing instances.

interface RowT extends Record<string, unknown> {
    id: string
    key: string
    value: string
    description?: string
}

const COLUMNS: TableColumn[] = [
    {
        key: 'key',
        header: 'Key',
        render: (row: RowT) => `<span class="quaykeeper-admin-mono">${escapeHtml(row.key)}</span>`,
    },
    {
        key: 'value',
        header: 'Value',
        render: (row: RowT) => `<span class="quaykeeper-admin-mono quaykeeper-admin-hint">${escapeHtml(row.value)}</span>`,
    },
    {
        key: 'description',
        header: 'Description',
        render: (row: RowT) => (row.description ? escapeHtml(row.description) : `<span class="quaykeeper-admin-hint">—</span>`),
    },
    {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row: RowT) =>
            `<span class="quaykeeper-admin-domain-controls">` +
            iconBtnHtml({ icon: 'edit', label: `Edit ${row.key}`, data: { action: 'edit', id: row.id } }) +
            iconBtnHtml({ icon: 'remove', label: `Delete ${row.key}`, danger: true, data: { action: 'delete', id: row.id, key: row.key } }) +
            `</span>`,
    },
]

export function AdminGlobalVars() {
    const fetcher = useCallback(async (): Promise<GlobalVar[] | null> => {
        try {
            return await fetch('/api/admin/global-vars', { cache: 'no-store' }).then((r) => json<GlobalVar[]>(r))
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useOwnerData(fetcher)

    return (
        <AdminPage
            title="Global variables"
            subtitle="App-wide plain-text key/value pairs. Reference one from an instance's Variables tab. Owner-only."
            icon="variable"
            iconColor="cyan"
            state={state}
            onRetry={() => void reload()}
        >
            {(vars) => <GlobalVarsManager vars={vars} onChanged={() => void reload()} />}
        </AdminPage>
    )
}

interface Draft {
    key: string
    value: string
    description: string
}
const emptyDraft = (): Draft => ({ key: '', value: '', description: '' })

function GlobalVarsManager({ vars, onChanged }: { vars: GlobalVar[]; onChanged: () => void }) {
    const toast = useToast()
    const [form, setForm] = useState<{ editing: string | null; draft: Draft } | null>(null)
    const [pending, setPending] = useState<{ id: string; key: string } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [referencedBy, setReferencedBy] = useState<ReferencingInstance[] | null>(null)
    const [busy, setBusy] = useState(false)

    const rows: RowT[] = vars.map((g) => ({ id: g.id, key: g.key, value: g.value, description: g.description }))

    const openCreate = () => {
        setError(null)
        setForm({ editing: null, draft: emptyDraft() })
    }
    const startEdit = useCallback(
        (id: string) => {
            const g = vars.find((v) => v.id === id)
            if (!g) return
            setError(null)
            setForm({ editing: g.id, draft: { key: g.key, value: g.value, description: g.description ?? '' } })
        },
        [vars],
    )
    const closeForm = useCallback(() => {
        setForm(null)
        setError(null)
    }, [])

    const save = useCallback(async () => {
        if (!form || busy) return
        const key = form.draft.key.trim()
        if (!key) {
            setError('A global variable needs a key.')
            return
        }
        if (!isValidKey(key)) {
            setError(KEY_SHAPE_MESSAGE)
            return
        }
        setBusy(true)
        setError(null)
        const payload = { key, value: form.draft.value, description: form.draft.description.trim() || undefined }
        const res = form.editing
            ? await callApi(`/api/admin/global-vars/${encodeURIComponent(form.editing)}`, 'PATCH', payload)
            : await callApi('/api/admin/global-vars', 'POST', payload)
        setBusy(false)
        if (!res.ok) {
            setError(`Couldn’t save “${key}”: ${res.message}`)
            return
        }
        toast.show(`Saved “${key}”.`, { variant: 'success' })
        setForm(null)
        onChanged()
    }, [form, busy, onChanged, toast])

    const doDelete = useCallback(async () => {
        if (!pending || busy) return
        const { id, key } = pending
        setPending(null)
        setBusy(true)
        setError(null)
        setReferencedBy(null)
        const res = await callApi<{ instances?: ReferencingInstance[] }>(
            `/api/admin/global-vars/${encodeURIComponent(id)}`,
            'DELETE',
        )
        setBusy(false)
        if (!res.ok) {
            if (res.body?.instances?.length) setReferencedBy(res.body.instances)
            else toast.show(`Couldn’t delete “${key}”: ${res.message}`, { variant: 'error' })
            return
        }
        toast.show(`Deleted “${key}”.`, { variant: 'success' })
        onChanged()
    }, [pending, busy, onChanged, toast])

    const onAction = useCallback(
        (action: string, dataset: DOMStringMap) => {
            const id = dataset.id
            if (!id) return
            if (action === 'edit') startEdit(id)
            else if (action === 'delete') setPending({ id, key: dataset.key ?? '' })
        },
        [startEdit],
    )

    return (
        <>
            <tc-section-card title="Global variables" icon="variable">
                <div className="quaykeeper-admin-section">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        {vars.length} variable{vars.length === 1 ? '' : 's'}. Plain text — anything sensitive belongs
                        in a secret instead.
                    </p>
                    {error && !form && <tc-banner variant="danger">{error}</tc-banner>}
                    {referencedBy && (
                        <tc-banner variant="warning">
                            Still referenced by {referencedBy.map((i) => i.name).join(', ')} — remove those references
                            first.
                        </tc-banner>
                    )}
                    <div className="quaykeeper-list-actions">
                        <tc-button variant="primary" size="sm" onClick={openCreate}>
                            Add variable
                        </tc-button>
                    </div>
                    {rows.length === 0 ? (
                        <tc-empty-state icon="variable">No global variables yet.</tc-empty-state>
                    ) : (
                        <DataTable<RowT> columns={COLUMNS} rows={rows} rowKey={(row) => row.id} onAction={onAction} />
                    )}
                </div>
            </tc-section-card>

            {form && (
                <FormModal
                    key={form.editing ?? 'new'}
                    title={form.editing ? 'Edit global variable' : 'Add global variable'}
                    busy={busy}
                    submitLabel={form.editing ? 'Save changes' : 'Create variable'}
                    onSubmit={() => void save()}
                    onClose={closeForm}
                >
                    {error && <tc-banner variant="danger">{error}</tc-banner>}
                    <FormGroup title="Identity">
                        <TextField
                            label="Key"
                            placeholder="REGION"
                            disabled={!!form.editing}
                            value={form.draft.key}
                            onValue={(v) => setForm((p) => (p ? { ...p, draft: { ...p.draft, key: v } } : p))}
                        />
                        <TextField
                            label="Value"
                            value={form.draft.value}
                            onValue={(v) => setForm((p) => (p ? { ...p, draft: { ...p.draft, value: v } } : p))}
                        />
                        <TextField
                            label="Description"
                            placeholder="Optional"
                            value={form.draft.description}
                            onValue={(v) => setForm((p) => (p ? { ...p, draft: { ...p.draft, description: v } } : p))}
                        />
                    </FormGroup>
                </FormModal>
            )}

            <ConfirmDialog
                open={!!pending}
                title="Delete global variable?"
                message={pending ? `Delete “${pending.key}”. Blocked if any instance still references it.` : undefined}
                confirmLabel="Delete"
                danger
                onConfirm={() => void doDelete()}
                onCancel={() => setPending(null)}
            />
        </>
    )
}
