'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TableColumn } from '@toolcase/web-components'
import { escapeHtml } from '@/lib/tc'
import { parse as parseDotenv } from '@/server/domain/env-file'
import { isValidKey, KEY_SHAPE_MESSAGE } from '@/server/domain/config-input'
import type { EnvVar, EnvVarSource, GlobalVar, Instance, ResolvedConfig, SecretMeta } from '@/server/domain/types'
import { iconBtnHtml } from '@/lib/action-icons'
import { callApi, json } from './shared'
import { DataTable } from '@/components/DataTable'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormModal, FormGroup } from '@/components/FormModal'
import { SelectField, TextAreaField, TextField, type SelectOption } from '@/components/fields'
import { LoadingState, ErrorState } from '@/components/states'
import { useToast } from '@/components/Toast'

// Instance Variables tab (move_wharf_to_perch.md §10): the editable env-var
// list (literal / global / secret references), a `.env` import flow with a
// re-point-to-global/secret preview, and dotenv/JSON export.

interface VarsData {
    vars: EnvVar[]
    globals: GlobalVar[]
    secrets: SecretMeta[]
    resolved: ResolvedConfig
}

type LoadState = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; data: VarsData }

async function loadVarsData(instanceId: string): Promise<VarsData | null> {
    try {
        const [vars, globals, secrets, resolved] = await Promise.all([
            fetch(`/api/instances/${instanceId}/vars`, { cache: 'no-store' }).then((r) => json<EnvVar[]>(r)),
            fetch('/api/admin/global-vars', { cache: 'no-store' })
                .then((r) => json<GlobalVar[]>(r))
                .catch(() => [] as GlobalVar[]),
            fetch('/api/admin/secrets', { cache: 'no-store' })
                .then((r) => json<SecretMeta[]>(r))
                .catch(() => [] as SecretMeta[]),
            fetch(`/api/instances/${instanceId}/config`, { cache: 'no-store' }).then((r) => json<ResolvedConfig>(r)),
        ])
        return { vars, globals, secrets, resolved }
    } catch {
        return null
    }
}

function badge(variant: string, text: string): string {
    return `<span class="badge text-bg-${variant}">${escapeHtml(text)}</span>`
}
function muted(text: string): string {
    return `<span class="quaykeeper-admin-hint">${escapeHtml(text)}</span>`
}

const SOURCE_VARIANT: Record<EnvVarSource, string> = { literal: 'secondary', global: 'info', secret: 'warning' }
const SOURCE_OPTIONS: SelectOption[] = [
    { value: 'literal', label: 'Literal' },
    { value: 'global', label: 'Global variable' },
    { value: 'secret', label: 'Secret' },
]

interface VarRow extends Record<string, unknown> {
    id: string
    key: string
    source: EnvVarSource
    display: string
    description?: string
    pending: boolean
}

const VAR_COLUMNS: TableColumn[] = [
    {
        key: 'key',
        header: 'Key',
        render: (row: VarRow) => `<span class="quaykeeper-admin-mono">${escapeHtml(row.key)}</span>`,
    },
    { key: 'source', header: 'Source', render: (row: VarRow) => badge(SOURCE_VARIANT[row.source], row.source) },
    {
        key: 'value',
        header: 'Value',
        render: (row: VarRow) => `<span class="quaykeeper-admin-mono quaykeeper-admin-hint">${escapeHtml(row.display)}</span>`,
    },
    { key: 'pending', header: '', render: (row: VarRow) => (row.pending ? badge('warning', 'pending') : '') },
    {
        key: 'description',
        header: 'Description',
        render: (row: VarRow) => (row.description ? escapeHtml(row.description) : muted('—')),
    },
    {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row: VarRow) =>
            `<span class="quaykeeper-admin-domain-controls">` +
            iconBtnHtml({ icon: 'edit', label: `Edit ${row.key}`, data: { action: 'edit', id: row.id } }) +
            iconBtnHtml({ icon: 'remove', label: `Delete ${row.key}`, danger: true, data: { action: 'delete', id: row.id, key: row.key } }) +
            `</span>`,
    },
]

interface VarDraft {
    key: string
    source: EnvVarSource
    value: string
    globalVarId: string
    secretId: string
    description: string
}
const emptyDraft = (): VarDraft => ({
    key: '',
    source: 'literal',
    value: '',
    globalVarId: '',
    secretId: '',
    description: '',
})

export function InstanceVars({ instance }: { instance: Instance }) {
    const [state, setState] = useState<LoadState>({ phase: 'loading' })

    const load = useCallback(async () => {
        setState({ phase: 'loading' })
        const data = await loadVarsData(instance.id)
        setState(data ? { phase: 'ready', data } : { phase: 'error' })
    }, [instance.id])

    useEffect(() => {
        void load()
    }, [load])

    if (state.phase === 'loading') return <LoadingState shape="rows" count={3} />
    if (state.phase === 'error') {
        return (
            <ErrorState
                title="Couldn’t load variables"
                message="The variables didn’t come back. This is usually temporary."
                onRetry={() => void load()}
            />
        )
    }
    return <VarsBody data={state.data} instance={instance} onChanged={() => void load()} />
}

interface ImportRow {
    key: string
    value: string
    source: EnvVarSource
    globalVarId: string
    secretId: string
    conflict: boolean
}

function VarsBody({ data, instance, onChanged }: { data: VarsData; instance: Instance; onChanged: () => void }) {
    const toast = useToast()
    const [form, setForm] = useState<{ editing: string | null; draft: VarDraft } | null>(null)
    const [importText, setImportText] = useState<string | null>(null)
    const [importRows, setImportRows] = useState<ImportRow[] | null>(null)
    const [pending, setPending] = useState<{ id: string; key: string } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const globalOptions: SelectOption[] = useMemo(
        () => data.globals.map((g) => ({ value: g.id, label: g.key })),
        [data.globals],
    )
    const secretOptions: SelectOption[] = useMemo(
        () => data.secrets.map((s) => ({ value: s.id, label: s.key })),
        [data.secrets],
    )
    const globalById = useMemo(() => new Map(data.globals.map((g) => [g.id, g])), [data.globals])
    const pendingKeys = useMemo(() => new Set(data.resolved.pending), [data.resolved])

    const rows = useMemo<VarRow[]>(
        () =>
            data.vars.map((v) => {
                const display =
                    v.source === 'literal'
                        ? v.value ?? ''
                        : v.source === 'global'
                          ? globalById.get(v.globalVarId ?? '')?.value ?? ''
                          : `<hidden:${v.secretKey ?? v.key}>`
                return {
                    id: v.id,
                    key: v.key,
                    source: v.source,
                    display,
                    description: v.description,
                    pending: pendingKeys.has(v.key),
                }
            }),
        [data.vars, globalById, pendingKeys],
    )

    const patchDraft = (p: Partial<VarDraft>) => setForm((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...p } } : prev))

    const openCreate = () => {
        setError(null)
        setForm({ editing: null, draft: emptyDraft() })
    }
    const startEdit = useCallback(
        (varId: string) => {
            const v = data.vars.find((x) => x.id === varId)
            if (!v) return
            setError(null)
            setForm({
                editing: v.id,
                draft: {
                    key: v.key,
                    source: v.source,
                    value: v.value ?? '',
                    globalVarId: v.globalVarId ?? '',
                    secretId: v.secretId ?? '',
                    description: v.description ?? '',
                },
            })
        },
        [data.vars],
    )
    const closeForm = useCallback(() => {
        setForm(null)
        setError(null)
    }, [])

    const buildSourcePayload = (draft: VarDraft): Record<string, unknown> | null => {
        if (draft.source === 'literal') return { value: draft.value }
        if (draft.source === 'global') {
            if (!draft.globalVarId) {
                setError('Pick a global variable.')
                return null
            }
            return { globalVarId: draft.globalVarId }
        }
        if (!draft.secretId) {
            setError('Pick a secret.')
            return null
        }
        return { secretId: draft.secretId }
    }

    const save = useCallback(async () => {
        if (!form || busy) return
        const key = form.draft.key.trim()
        if (!key) {
            setError('A variable needs a key.')
            return
        }
        if (!isValidKey(key)) {
            setError(KEY_SHAPE_MESSAGE)
            return
        }
        const sourcePayload = buildSourcePayload(form.draft)
        if (!sourcePayload) return

        setBusy(true)
        setError(null)
        const payload = { key, source: form.draft.source, description: form.draft.description.trim() || undefined, ...sourcePayload }
        const res = form.editing
            ? await callApi(`/api/instances/${instance.id}/vars/${encodeURIComponent(form.editing)}`, 'PATCH', payload)
            : await callApi(`/api/instances/${instance.id}/vars`, 'POST', payload)
        setBusy(false)
        if (!res.ok) {
            setError(`Couldn’t save “${key}”: ${res.message}`)
            return
        }
        toast.show(`Saved “${key}”.`, { variant: 'success' })
        setForm(null)
        onChanged()
    }, [form, busy, instance.id, onChanged, toast])

    const doDelete = useCallback(async () => {
        if (!pending || busy) return
        const { id, key } = pending
        setPending(null)
        setBusy(true)
        const res = await callApi(`/api/instances/${instance.id}/vars/${encodeURIComponent(id)}`, 'DELETE')
        setBusy(false)
        if (!res.ok) {
            toast.show(`Couldn’t delete “${key}”: ${res.message}`, { variant: 'error' })
            return
        }
        toast.show(`Deleted “${key}”.`, { variant: 'success' })
        onChanged()
    }, [pending, busy, instance.id, onChanged, toast])

    const onAction = useCallback(
        (action: string, dataset: DOMStringMap) => {
            const id = dataset.id
            if (!id) return
            if (action === 'edit') startEdit(id)
            else if (action === 'delete') setPending({ id, key: dataset.key ?? '' })
        },
        [startEdit],
    )

    // ── import (.env → literal/re-pointed vars) ──────────────────────────────

    const openImport = () => {
        setImportText('')
        setImportRows(null)
        setError(null)
    }
    const closeImport = () => {
        setImportText(null)
        setImportRows(null)
        setError(null)
    }

    const buildPreview = useCallback(() => {
        if (importText === null) return
        const existingKeys = new Set(data.vars.map((v) => v.key))
        const parsed = parseDotenv(importText)
        const byKey = new Map<string, string>()
        for (const { key, value } of parsed) byKey.set(key, value)
        const preview: ImportRow[] = [...byKey.entries()].map(([key, value]) => ({
            key,
            value,
            source: 'literal',
            globalVarId: '',
            secretId: '',
            conflict: existingKeys.has(key),
        }))
        setImportRows(preview)
    }, [importText, data.vars])

    const patchImportRow = (i: number, p: Partial<ImportRow>) =>
        setImportRows((prev) => prev?.map((r, idx) => (idx === i ? { ...r, ...p } : r)) ?? prev)

    const doImport = useCallback(async () => {
        if (!importRows || busy) return
        const entries = importRows
            .filter((r) => !r.conflict)
            .map((r) => {
                if (r.source === 'global') return { key: r.key, source: 'global' as const, globalVarId: r.globalVarId }
                if (r.source === 'secret') return { key: r.key, source: 'secret' as const, secretId: r.secretId }
                return { key: r.key, source: 'literal' as const, value: r.value }
            })
        setBusy(true)
        setError(null)
        const res = await callApi<{ created: number; skipped: string[] }>(
            `/api/instances/${instance.id}/vars/import`,
            'POST',
            { entries },
        )
        setBusy(false)
        if (!res.ok) {
            setError(`Couldn’t import: ${res.message}`)
            return
        }
        const created = res.body?.created ?? 0
        const skipped = res.body?.skipped.length ?? 0
        toast.show(`Imported ${created} var${created === 1 ? '' : 's'}${skipped ? `, skipped ${skipped}` : ''}.`, {
            variant: 'success',
        })
        closeImport()
        onChanged()
    }, [importRows, busy, instance.id, onChanged, toast])

    // ── export ────────────────────────────────────────────────────────────────

    const doExport = useCallback(
        async (format: 'dotenv' | 'json') => {
            const res = await fetch(`/api/instances/${instance.id}/export?format=${format}`, { cache: 'no-store' })
            if (!res.ok) {
                toast.show(`Couldn’t export (${format}).`, { variant: 'error' })
                return
            }
            const text = await res.text()
            const blob = new Blob([text], { type: format === 'json' ? 'application/json' : 'text/plain' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${instance.name}.${format === 'json' ? 'json' : 'env'}`
            a.click()
            URL.revokeObjectURL(url)
        },
        [instance.id, instance.name, toast],
    )

    const importSourceOptions: SelectOption[] = useMemo(
        () => [
            { value: 'literal', label: 'Literal' },
            ...data.globals.map((g) => ({ value: `global:${g.id}`, label: `Global: ${g.key}` })),
            ...data.secrets.map((s) => ({ value: `secret:${s.id}`, label: `Secret: ${s.key}` })),
        ],
        [data.globals, data.secrets],
    )

    const draft = form?.draft

    return (
        <>
            <tc-section-card title="Environment variables" icon="variable">
                <div className="quaykeeper-admin-section">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        {data.vars.length} variable{data.vars.length === 1 ? '' : 's'}. Each is a literal value, or a
                        reference to a global variable or secret.
                    </p>
                    {error && !form && !importRows && <tc-banner variant="danger">{error}</tc-banner>}

                    <div className="quaykeeper-instance-toolbar">
                        <tc-button variant="primary" size="sm" onClick={openCreate}>
                            Add variable
                        </tc-button>
                        <div className="quaykeeper-instance-toolbar-group" role="group" aria-label="Import and export">
                            <tc-button variant="secondary" outline size="sm" onClick={openImport}>
                                Import .env
                            </tc-button>
                            <tc-button variant="secondary" outline size="sm" onClick={() => void doExport('dotenv')}>
                                Export .env
                            </tc-button>
                            <tc-button variant="secondary" outline size="sm" onClick={() => void doExport('json')}>
                                Export JSON
                            </tc-button>
                        </div>
                    </div>

                    {rows.length === 0 ? (
                        <tc-empty-state icon="variable">No variables yet.</tc-empty-state>
                    ) : (
                        <DataTable<VarRow> columns={VAR_COLUMNS} rows={rows} rowKey={(row) => row.id} onAction={onAction} />
                    )}
                </div>
            </tc-section-card>

            {form && draft && (
                <FormModal
                    key={form.editing ?? 'new'}
                    title={form.editing ? 'Edit variable' : 'Add variable'}
                    busy={busy}
                    submitLabel={form.editing ? 'Save changes' : 'Create variable'}
                    onSubmit={() => void save()}
                    onClose={closeForm}
                >
                    {error && <tc-banner variant="danger">{error}</tc-banner>}
                    <FormGroup title="Identity">
                        <TextField
                            label="Key"
                            placeholder="DATABASE_URL"
                            disabled={!!form.editing}
                            value={draft.key}
                            onValue={(v) => patchDraft({ key: v })}
                        />
                        <TextField
                            label="Description"
                            placeholder="Optional"
                            value={draft.description}
                            onValue={(v) => patchDraft({ description: v })}
                        />
                    </FormGroup>
                    <FormGroup title="Source">
                        <SelectField
                            label="Source"
                            value={draft.source}
                            options={SOURCE_OPTIONS}
                            onValue={(v) => patchDraft({ source: v as EnvVarSource })}
                        />
                        {draft.source === 'literal' && (
                            <TextField
                                label="Value"
                                value={draft.value}
                                onValue={(v) => patchDraft({ value: v })}
                            />
                        )}
                        {draft.source === 'global' && (
                            <SelectField
                                label="Global variable"
                                placeholder="— pick a global variable —"
                                value={draft.globalVarId}
                                options={globalOptions}
                                onValue={(v) => patchDraft({ globalVarId: v })}
                            />
                        )}
                        {draft.source === 'secret' && (
                            <SelectField
                                label="Secret"
                                placeholder="— pick a secret —"
                                value={draft.secretId}
                                options={secretOptions}
                                onValue={(v) => patchDraft({ secretId: v })}
                            />
                        )}
                    </FormGroup>
                </FormModal>
            )}

            {importText !== null && (
                <FormModal
                    key="import"
                    title="Import .env"
                    busy={busy}
                    submitLabel={importRows ? 'Import' : 'Preview'}
                    onSubmit={() => (importRows ? void doImport() : buildPreview())}
                    onClose={closeImport}
                >
                    {error && <tc-banner variant="danger">{error}</tc-banner>}
                    {!importRows ? (
                        <FormGroup title="Paste a .env file">
                            <TextAreaField
                                label=".env contents"
                                rows={10}
                                placeholder={'DATABASE_URL=postgres://…\nDEBUG=true'}
                                value={importText}
                                onValue={setImportText}
                            />
                        </FormGroup>
                    ) : (
                        <FormGroup title={`Preview (${importRows.length} keys)`}>
                            <p className="quaykeeper-admin-hint">
                                Conflicting keys (already on this instance) are skipped. Re-point a key at an
                                existing global/secret instead of importing it as a literal.
                            </p>
                            <div className="quaykeeper-form-import-rows">
                                {importRows.map((row, i) => (
                                    <div key={row.key} className="quaykeeper-form-item">
                                        <div className="quaykeeper-form-row">
                                            <span className="quaykeeper-admin-mono">{row.key}</span>
                                            {row.conflict && <span className="badge text-bg-secondary">already exists — skipped</span>}
                                        </div>
                                        {!row.conflict && (
                                            <SelectField
                                                size="sm"
                                                label="Import as"
                                                value={
                                                    row.source === 'literal'
                                                        ? 'literal'
                                                        : row.source === 'global'
                                                          ? `global:${row.globalVarId}`
                                                          : `secret:${row.secretId}`
                                                }
                                                options={importSourceOptions}
                                                onValue={(v) => {
                                                    if (v === 'literal') patchImportRow(i, { source: 'literal', globalVarId: '', secretId: '' })
                                                    else if (v.startsWith('global:'))
                                                        patchImportRow(i, { source: 'global', globalVarId: v.slice(7), secretId: '' })
                                                    else patchImportRow(i, { source: 'secret', secretId: v.slice(7), globalVarId: '' })
                                                }}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </FormGroup>
                    )}
                </FormModal>
            )}

            <ConfirmDialog
                open={!!pending}
                title="Delete variable?"
                message={pending ? `Delete “${pending.key}” from this instance.` : undefined}
                confirmLabel="Delete"
                danger
                onConfirm={() => void doDelete()}
                onCancel={() => setPending(null)}
            />
        </>
    )
}
