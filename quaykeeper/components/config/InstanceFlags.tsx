'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import { escapeHtml, useTc } from '@/lib/tc'
import type { FeatureFlag } from '@/server/domain/types'
import { isValidKey, KEY_SHAPE_MESSAGE } from '@/server/domain/config-input'
import { iconBtnHtml } from '@/lib/action-icons'
import { callApi, json } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormModal, FormGroup } from '@/components/FormModal'
import { SwitchField, TextField } from '@/components/fields'
import { LoadingState, ErrorState } from '@/components/states'
import { useToast } from '@/components/Toast'

// Instance Flags tab (move_wharf_to_perch.md §5, §10): boolean-only flags
// defined directly on the instance — key + enabled + description, no shared
// catalog, no per-environment values. Rendered as a `tc-advanced-table` with
// the rows injected into the projected <tbody> as an HTML string (the
// canonical pattern — see /admin/sites), so no React subtree is captured by
// the slot-relocating table.

type LoadState = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; flags: FeatureFlag[] }

interface FlagDraft {
    key: string
    enabled: boolean
    description: string
}

const FLAG_COLUMNS: AdvancedTableColumn[] = [
    { key: 'flag', label: 'Flag' },
    { key: 'description', label: 'Description' },
    { key: 'updated', label: 'Updated', align: 'right', width: '11rem' },
    { key: 'actions', label: '', align: 'right' },
]

function fmtDate(iso: string): string {
    const d = new Date(iso)
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// The injected <tbody> HTML — every interpolated value is escaped. The Flag
// cell is a real <tc-switch> (custom elements upgrade on innerHTML injection,
// and the element manages its own clicks); its bubbling native `change` event
// and the delete button's click are both caught by ONE delegated listener on
// the table host via their `data-action` attributes.
function flagRowsHtml(flags: FeatureFlag[]): string {
    return flags
        .map((f) => {
            const key = escapeHtml(f.key)
            const id = escapeHtml(f.id)
            const toggle =
                `<tc-switch label="${key}" data-action="toggle" data-id="${id}" data-key="${key}"` +
                (f.enabled ? ' checked' : '') +
                `></tc-switch>`
            const description = f.description
                ? escapeHtml(f.description)
                : `<span class="quaykeeper-admin-hint">—</span>`
            const remove = iconBtnHtml({
                icon: 'remove',
                label: `Delete ${f.key}`,
                danger: true,
                data: { action: 'delete', id: f.id, key: f.key },
            })
            return (
                `<tr>` +
                `<td>${toggle}</td>` +
                `<td>${description}</td>` +
                `<td style="text-align:right"><span class="quaykeeper-admin-hint">${escapeHtml(fmtDate(f.updatedAt))}</span></td>` +
                `<td style="text-align:right">${remove}</td>` +
                `</tr>`
            )
        })
        .join('')
}

export function InstanceFlags({ instanceId }: { instanceId: string }) {
    const toast = useToast()
    const [state, setState] = useState<LoadState>({ phase: 'loading' })
    const [form, setForm] = useState<FlagDraft | null>(null)
    const [pending, setPending] = useState<{ id: string; key: string } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const flags = useMemo(() => (state.phase === 'ready' ? state.flags : []), [state])

    const load = useCallback(async () => {
        setState({ phase: 'loading' })
        try {
            const next = await fetch(`/api/instances/${instanceId}/flags`, { cache: 'no-store' }).then((r) =>
                json<FeatureFlag[]>(r),
            )
            setState({ phase: 'ready', flags: next })
        } catch {
            setState({ phase: 'error' })
        }
    }, [instanceId])

    useEffect(() => {
        void load()
    }, [load])

    const toggle = useCallback(
        async (id: string, key: string, enabled: boolean) => {
            const res = await callApi(`/api/instances/${instanceId}/flags/${id}`, 'PATCH', { enabled })
            if (!res.ok) {
                toast.show(`Couldn’t update “${key}”: ${res.message}`, { variant: 'error' })
            }
            // Reload either way: sync updatedAt on success, revert the switch on failure.
            void load()
        },
        [instanceId, load, toast],
    )

    // One delegated handler for everything inside the injected rows: the
    // tc-switch's bubbling `change` (toggle) and the delete button's `click`.
    const onDelegated = useCallback(
        (event: Event) => {
            const el = (event.target as HTMLElement)?.closest?.('[data-action]') as HTMLElement | null
            if (!el) return
            const action = el.getAttribute('data-action')
            const id = el.getAttribute('data-id')
            const key = el.getAttribute('data-key') ?? ''
            if (!action || !id) return
            if (action === 'toggle' && event.type === 'change') {
                const checked = (el as HTMLElement & { checked?: boolean }).checked === true
                void toggle(id, key, checked)
            } else if (action === 'delete' && event.type === 'click') {
                setPending({ id, key })
            }
        },
        [toggle],
    )

    const tableProps = useMemo(
        () => ({
            columns: FLAG_COLUMNS,
            total: flags.length,
            limit: Math.max(flags.length, 1),
            offset: 0,
            // Body rows as the element-owned `rows` HTML string — relocation-safe,
            // re-applied by the component on every internal re-render.
            rows: flagRowsHtml(flags),
        }),
        [flags],
    )
    const tableRef = useTc<HTMLElement>(tableProps, { click: onDelegated, change: onDelegated })

    const openCreate = () => {
        setError(null)
        setForm({ key: '', enabled: false, description: '' })
    }
    const closeForm = () => {
        setForm(null)
        setError(null)
    }

    const create = useCallback(async () => {
        if (!form || busy) return
        const key = form.key.trim()
        if (!key) {
            setError('A flag needs a key.')
            return
        }
        if (!isValidKey(key)) {
            setError(KEY_SHAPE_MESSAGE)
            return
        }
        setBusy(true)
        setError(null)
        const res = await callApi(`/api/instances/${instanceId}/flags`, 'POST', {
            key,
            enabled: form.enabled,
            description: form.description.trim() || undefined,
        })
        setBusy(false)
        if (!res.ok) {
            setError(`Couldn’t create “${key}”: ${res.message}`)
            return
        }
        toast.show(`Flag “${key}” created.`, { variant: 'success' })
        setForm(null)
        void load()
    }, [form, busy, instanceId, load, toast])

    const doDelete = useCallback(async () => {
        if (!pending || busy) return
        const { id, key } = pending
        setPending(null)
        setBusy(true)
        const res = await callApi(`/api/instances/${instanceId}/flags/${id}`, 'DELETE')
        setBusy(false)
        if (!res.ok) {
            toast.show(`Couldn’t delete “${key}”: ${res.message}`, { variant: 'error' })
            return
        }
        toast.show(`Flag “${key}” deleted.`, { variant: 'success' })
        void load()
    }, [pending, busy, instanceId, load, toast])

    if (state.phase === 'loading') return <LoadingState shape="rows" count={3} />
    if (state.phase === 'error') {
        return (
            <ErrorState
                title="Couldn’t load flags"
                message="The flags didn’t come back. This is usually temporary."
                onRetry={() => void load()}
            />
        )
    }

    return (
        <>
            <tc-section-card title="Feature flags" icon="flag">
                <div className="quaykeeper-admin-section">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        {flags.length} flag{flags.length === 1 ? '' : 's'}. Boolean only — key + enabled + description.
                    </p>
                    {error && !form && <tc-banner variant="danger">{error}</tc-banner>}
                    <div className="quaykeeper-instance-toolbar">
                        <tc-button variant="primary" size="sm" onClick={openCreate}>
                            Add flag
                        </tc-button>
                    </div>
                    {flags.length === 0 ? (
                        <tc-empty-state icon="flag">No flags yet.</tc-empty-state>
                    ) : (
                        <tc-advanced-table ref={tableRef} className="quaykeeper-flags-table" />
                    )}
                </div>
            </tc-section-card>

            {form && (
                <FormModal key="new" title="Add flag" busy={busy} submitLabel="Create flag" onSubmit={() => void create()} onClose={closeForm}>
                    {error && <tc-banner variant="danger">{error}</tc-banner>}
                    <FormGroup title="Identity">
                        <TextField
                            label="Key"
                            placeholder="new_dashboard"
                            value={form.key}
                            onValue={(v) => setForm((p) => (p ? { ...p, key: v } : p))}
                        />
                        <TextField
                            label="Description"
                            placeholder="Optional"
                            value={form.description}
                            onValue={(v) => setForm((p) => (p ? { ...p, description: v } : p))}
                        />
                        <SwitchField
                            label="Enabled"
                            checked={form.enabled}
                            onChecked={(c) => setForm((p) => (p ? { ...p, enabled: c } : p))}
                        />
                    </FormGroup>
                </FormModal>
            )}

            <ConfirmDialog
                open={!!pending}
                title="Delete flag?"
                message={pending ? `Delete “${pending.key}” from this instance.` : undefined}
                confirmLabel="Delete"
                danger
                onConfirm={() => void doDelete()}
                onCancel={() => setPending(null)}
            />
        </>
    )
}
