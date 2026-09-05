'use client'

import { useCallback, useState } from 'react'
import type { TableColumn } from '@toolcase/web-components'
import { escapeHtml } from '@/lib/tc'
import type { ReferencingInstance, SecretGenKind, SecretMeta } from '@/server/domain/types'
import { isValidKey, KEY_SHAPE_MESSAGE } from '@/server/domain/config-input'
import { iconBtnHtml } from '@/lib/action-icons'
import { AdminPage, json, useOwnerData } from './shared'
import { callApi } from '@/components/config/shared'
import { DataTable } from '@/components/DataTable'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormModal, FormGroup } from '@/components/FormModal'
import { SelectField, SwitchField, TextField, type SelectOption } from '@/components/fields'
import { useToast } from '@/components/Toast'

// Owner-only secret pool (move_wharf_to_perch.md §3, §4, §10): app-wide values
// encrypted at rest. Keys-only listing; values leave the server only through
// the audited reveal endpoint or an instance's fetch API. Delete is blocked
// (409 `secret_referenced`) while any env var still points at it.

interface RowT extends Record<string, unknown> {
    id: string
    key: string
    description?: string
    updatedAt: string
}

function fmtDate(iso: string): string {
    const d = new Date(iso)
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const COLUMNS: TableColumn[] = [
    {
        key: 'key',
        header: 'Key',
        render: (row: RowT) => `<span class="quaykeeper-admin-mono">${escapeHtml(row.key)}</span>`,
    },
    {
        key: 'description',
        header: 'Description',
        render: (row: RowT) => (row.description ? escapeHtml(row.description) : `<span class="quaykeeper-admin-hint">—</span>`),
    },
    {
        key: 'updatedAt',
        header: 'Updated',
        render: (row: RowT) => `<span class="quaykeeper-admin-hint">${escapeHtml(fmtDate(row.updatedAt))}</span>`,
    },
    {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row: RowT) =>
            `<span class="quaykeeper-admin-domain-controls">` +
            iconBtnHtml({ icon: 'view', label: `Reveal ${row.key}`, data: { action: 'reveal', id: row.id, key: row.key } }) +
            iconBtnHtml({ icon: 'edit', label: `Edit ${row.key}`, data: { action: 'edit', id: row.id } }) +
            iconBtnHtml({ icon: 'remove', label: `Delete ${row.key}`, danger: true, data: { action: 'delete', id: row.id, key: row.key } }) +
            `</span>`,
    },
]

const KIND_OPTIONS: SelectOption[] = [
    { value: 'password', label: 'Password' },
    { value: 'token', label: 'Token' },
    { value: 'hex', label: 'Hex' },
    { value: 'base64', label: 'Base64' },
]

export function AdminSecrets() {
    const fetcher = useCallback(async (): Promise<SecretMeta[] | null> => {
        try {
            return await fetch('/api/admin/secrets', { cache: 'no-store' }).then((r) => json<SecretMeta[]>(r))
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useOwnerData(fetcher)

    return (
        <AdminPage
            title="Secrets"
            subtitle="App-wide encrypted values. Keys-only listing — reveal is audited. Owner-only."
            icon="lock"
            iconColor="amber"
            state={state}
            onRetry={() => void reload()}
        >
            {(secrets) => <SecretsManager secrets={secrets} onChanged={() => void reload()} />}
        </AdminPage>
    )
}

interface CreateDraft {
    key: string
    description: string
    mode: 'manual' | 'generate'
    value: string
    kind: SecretGenKind
    length: string
}
const emptyDraft = (): CreateDraft => ({
    key: '',
    description: '',
    mode: 'manual',
    value: '',
    kind: 'password',
    length: '32',
})

function SecretsManager({ secrets, onChanged }: { secrets: SecretMeta[]; onChanged: () => void }) {
    const toast = useToast()
    const [form, setForm] = useState<CreateDraft | null>(null)
    const [editing, setEditing] = useState<{ id: string; key: string; value: string; description: string } | null>(
        null,
    )
    const [pending, setPending] = useState<{ id: string; key: string } | null>(null)
    const [revealed, setRevealed] = useState<{ key: string; value: string } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [referencedBy, setReferencedBy] = useState<ReferencingInstance[] | null>(null)
    const [busy, setBusy] = useState(false)

    const rows: RowT[] = secrets.map((s) => ({ id: s.id, key: s.key, description: s.description, updatedAt: s.updatedAt }))

    const openCreate = () => {
        setError(null)
        setForm(emptyDraft())
    }
    const closeForm = useCallback(() => {
        setForm(null)
        setError(null)
    }, [])

    const create = useCallback(async () => {
        if (!form || busy) return
        const key = form.key.trim()
        if (!key) {
            setError('A secret needs a key.')
            return
        }
        if (!isValidKey(key)) {
            setError(KEY_SHAPE_MESSAGE)
            return
        }
        setBusy(true)
        setError(null)
        const res =
            form.mode === 'generate'
                ? await callApi('/api/admin/secrets/generate', 'POST', {
                      key,
                      kind: form.kind,
                      length: Number(form.length) || 32,
                      description: form.description.trim() || undefined,
                  })
                : await callApi('/api/admin/secrets', 'POST', {
                      key,
                      value: form.value,
                      description: form.description.trim() || undefined,
                  })
        setBusy(false)
        if (!res.ok) {
            setError(`Couldn’t create “${key}”: ${res.message}`)
            return
        }
        toast.show(`Secret “${key}” created.`, { variant: 'success' })
        setForm(null)
        onChanged()
    }, [form, busy, onChanged, toast])

    const startEdit = useCallback(
        (id: string) => {
            const s = secrets.find((x) => x.id === id)
            if (!s) return
            setError(null)
            setEditing({ id: s.id, key: s.key, value: '', description: s.description ?? '' })
        },
        [secrets],
    )

    const saveEdit = useCallback(async () => {
        if (!editing || busy) return
        setBusy(true)
        setError(null)
        const payload: { value?: string; description?: string | null } = {
            description: editing.description.trim() || null,
        }
        if (editing.value) payload.value = editing.value
        const res = await callApi(`/api/admin/secrets/${encodeURIComponent(editing.id)}`, 'PATCH', payload)
        setBusy(false)
        if (!res.ok) {
            setError(`Couldn’t save “${editing.key}”: ${res.message}`)
            return
        }
        toast.show(`Saved “${editing.key}”.`, { variant: 'success' })
        setEditing(null)
        onChanged()
    }, [editing, busy, onChanged, toast])

    const doReveal = useCallback(
        async (id: string, key: string) => {
            const res = await callApi<{ value: string }>(`/api/admin/secrets/${encodeURIComponent(id)}/reveal`, 'GET')
            if (!res.ok || !res.body) {
                toast.show(`Couldn’t reveal “${key}”: ${res.message}`, { variant: 'error' })
                return
            }
            setRevealed({ key, value: res.body.value })
        },
        [toast],
    )

    const doDelete = useCallback(async () => {
        if (!pending || busy) return
        const { id, key } = pending
        setPending(null)
        setBusy(true)
        setError(null)
        setReferencedBy(null)
        const res = await callApi<{ instances?: ReferencingInstance[] }>(
            `/api/admin/secrets/${encodeURIComponent(id)}`,
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
            else if (action === 'reveal') void doReveal(id, dataset.key ?? '')
            else if (action === 'delete') setPending({ id, key: dataset.key ?? '' })
        },
        [startEdit, doReveal],
    )

    return (
        <>
            <tc-section-card title="Secrets" icon="lock">
                <div className="quaykeeper-admin-section">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        {secrets.length} secret{secrets.length === 1 ? '' : 's'}. Values are encrypted at rest and
                        never listed — reveal is one click, and audited.
                    </p>
                    {error && !form && !editing && <tc-banner variant="error">{error}</tc-banner>}
                    {referencedBy && (
                        <tc-banner variant="warning">
                            Still referenced by {referencedBy.map((i) => i.name).join(', ')} — remove those references
                            first.
                        </tc-banner>
                    )}
                    <div className="quaykeeper-list-actions">
                        <tc-button variant="primary" size="sm" onClick={openCreate}>
                            Add secret
                        </tc-button>
                    </div>
                    {rows.length === 0 ? (
                        <tc-empty-state icon="lock">No secrets yet.</tc-empty-state>
                    ) : (
                        <DataTable<RowT> columns={COLUMNS} rows={rows} rowKey={(row) => row.id} onAction={onAction} />
                    )}
                </div>
            </tc-section-card>

            {form && (
                <FormModal
                    key="new"
                    title="Add secret"
                    busy={busy}
                    submitLabel="Create secret"
                    onSubmit={() => void create()}
                    onClose={closeForm}
                >
                    {error && <tc-banner variant="error">{error}</tc-banner>}
                    <FormGroup title="Identity">
                        <TextField
                            label="Key"
                            placeholder="DB_PASSWORD"
                            value={form.key}
                            onValue={(v) => setForm((p) => (p ? { ...p, key: v } : p))}
                        />
                        <TextField
                            label="Description"
                            placeholder="Optional"
                            value={form.description}
                            onValue={(v) => setForm((p) => (p ? { ...p, description: v } : p))}
                        />
                    </FormGroup>
                    <FormGroup title="Value">
                        <SwitchField
                            label="Generate a value"
                            checked={form.mode === 'generate'}
                            onChecked={(c) => setForm((p) => (p ? { ...p, mode: c ? 'generate' : 'manual' } : p))}
                        />
                        {form.mode === 'manual' ? (
                            <TextField
                                type="password"
                                label="Value"
                                value={form.value}
                                onValue={(v) => setForm((p) => (p ? { ...p, value: v } : p))}
                            />
                        ) : (
                            <div className="quaykeeper-form-grid">
                                <SelectField
                                    label="Kind"
                                    value={form.kind}
                                    options={KIND_OPTIONS}
                                    onValue={(v) => setForm((p) => (p ? { ...p, kind: v as SecretGenKind } : p))}
                                />
                                <TextField
                                    type="number"
                                    label="Length"
                                    min={1}
                                    max={4096}
                                    value={form.length}
                                    onValue={(v) => setForm((p) => (p ? { ...p, length: v } : p))}
                                />
                            </div>
                        )}
                        <p className="quaykeeper-admin-hint">The value is never shown at creation — reveal it afterwards.</p>
                    </FormGroup>
                </FormModal>
            )}

            {editing && (
                <FormModal
                    key={editing.id}
                    title={`Edit secret — ${editing.key}`}
                    busy={busy}
                    submitLabel="Save changes"
                    onSubmit={() => void saveEdit()}
                    onClose={() => {
                        setEditing(null)
                        setError(null)
                    }}
                >
                    {error && <tc-banner variant="error">{error}</tc-banner>}
                    <FormGroup title="Value">
                        <TextField
                            type="password"
                            label="New value"
                            placeholder="Leave blank to keep the current value"
                            value={editing.value}
                            onValue={(v) => setEditing((p) => (p ? { ...p, value: v } : p))}
                        />
                        <TextField
                            label="Description"
                            value={editing.description}
                            onValue={(v) => setEditing((p) => (p ? { ...p, description: v } : p))}
                        />
                    </FormGroup>
                </FormModal>
            )}

            {revealed && (
                <FormModal
                    key="revealed"
                    title={`Secret value — ${revealed.key}`}
                    busy={false}
                    submitLabel="Done"
                    onSubmit={() => setRevealed(null)}
                    onClose={() => setRevealed(null)}
                >
                    <tc-banner variant="warning">Audited — this reveal was logged.</tc-banner>
                    <tc-code-snippet code={revealed.value} show-copy-button="" />
                </FormModal>
            )}

            <ConfirmDialog
                open={!!pending}
                title="Delete secret?"
                message={pending ? `Delete “${pending.key}”. Blocked if any instance still references it.` : undefined}
                confirmLabel="Delete"
                danger
                onConfirm={() => void doDelete()}
                onCancel={() => setPending(null)}
            />
        </>
    )
}
